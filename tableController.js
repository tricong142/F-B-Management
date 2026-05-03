// =============================================================================
//  tableController.js
//  Quản lý bàn: CRUD + Chuyển bàn (Move Table)
// =============================================================================

const TableModel = require('../models/Table');
const LogModel   = require('../models/Log');
const db         = require('../database/db');
const {
  ok, created, paged,
  paginateArray, asyncHandler, ApiError,
} = require('../utils/response');

// Danh sách zone hợp lệ
const ZONES = ['indoor', 'outdoor', 'vip'];

// =============================================================================
//  Các handler hiện có (giữ nguyên, không thay đổi)
// =============================================================================

exports.list = asyncHandler(async (req, res) => {
  const { zone, with_status, page, limit } = req.query;
  let tables;

  if (with_status === 'true') {
    tables = await TableModel.findAllWithStatus(zone);
    tables = tables.map(t => {
      let status = 'empty';
      if (t.order_status === 'pending') status = 'busy';
      if (t.order_status === 'serving') status = 'pay';
      if (t.order_status === 'completed' || t.order_status === 'cancelled') status = 'empty';
      const mins = t.check_in_time
        ? Math.max(0, Math.round((Date.now() - new Date(t.check_in_time).getTime()) / 60000))
        : 0;
      return { ...t, status, mins };
    });
  } else {
    tables = await TableModel.findAll();
  }

  const r = paginateArray(tables, { page, limit });
  return paged(res, r);
});

exports.create = asyncHandler(async (req, res) => {
  const { code, zone, capacity } = req.body || {};
  const errs = [];
  if (!code)                          errs.push('code: bắt buộc');
  if (!zone || !ZONES.includes(zone)) errs.push(`zone: phải thuộc {${ZONES.join('|')}}`);
  if (!capacity || isNaN(Number(capacity)) || Number(capacity) < 1)
                                      errs.push('capacity: phải là số nguyên dương');
  if (errs.length) throw ApiError.validation('Dữ liệu không hợp lệ', errs);

  const t = await TableModel.create({
    code:     String(code).trim().toUpperCase(),
    zone,
    capacity: parseInt(capacity),
  });

  LogModel.write({
    user_id: req.user?.id, user_name: req.user?.full_name,
    action: 'CREATE_TABLE', entity: 'TABLE', entity_id: t.id,
    details: { code, zone },
  }).catch(() => {});

  return created(res, t, 'Tạo bàn thành công');
});

exports.update = asyncHandler(async (req, res) => {
  if (req.body && req.body.zone && !ZONES.includes(req.body.zone))
    throw ApiError.validation('Dữ liệu không hợp lệ', [`zone: phải thuộc {${ZONES.join('|')}}`]);

  const t = await TableModel.update(req.params.id, req.body || {});
  if (!t) throw ApiError.notFound('Bàn không tồn tại');

  LogModel.write({
    user_id: req.user?.id, user_name: req.user?.full_name,
    action: 'UPDATE_TABLE', entity: 'TABLE', entity_id: t.id,
    details: req.body,
  }).catch(() => {});

  return ok(res, t, { message: 'Cập nhật bàn thành công' });
});

exports.remove = asyncHandler(async (req, res) => {
  const r = await TableModel.remove(req.params.id);
  if (!r) throw ApiError.notFound('Bàn không tồn tại');

  LogModel.write({
    user_id: req.user?.id, user_name: req.user?.full_name,
    action: 'DELETE_TABLE', entity: 'TABLE', entity_id: req.params.id,
  }).catch(() => {});

  return ok(res, r, { message: 'Đã xoá bàn' });
});

// =============================================================================
//  moveTable — Chuyển bàn
//  POST /api/tables/move
//  Body: { from_table_id: number, to_table_id: number }
//
//  Luồng xử lý:
//   1. Validate input
//   2. Mở transaction PostgreSQL
//   3. Lock cả 2 bàn (SELECT FOR UPDATE) để tránh race condition
//   4. Kiểm tra bàn nguồn tồn tại và đang có order mở (occupied)
//   5. Kiểm tra bàn đích tồn tại và KHÔNG có order mở (available)
//   6. Cập nhật tất cả orders chưa thanh toán: đổi table_id + table_code
//   7. Commit — nếu có lỗi ở bất kỳ bước nào, tự động Rollback
//   8. Ghi log + trả về kết quả
//
//  Lưu ý kiến trúc:
//   - Bảng `tables` KHÔNG có cột `status`. Trạng thái "occupied / available"
//     được suy ra từ sự tồn tại của orders có status IN ('pending','serving').
//   - Dự án dùng PostgreSQL với placeholder $1, $2 ... (không phải MySQL ?).
//   - db.transaction(fn) tự xử lý BEGIN / COMMIT / ROLLBACK và release client.
// =============================================================================
exports.moveTable = asyncHandler(async (req, res) => {
  // ── Bước 1: Validate input ────────────────────────────────────────────────
  const { from_table_id, to_table_id } = req.body || {};

  const errs = [];
  if (!from_table_id || isNaN(Number(from_table_id)))
    errs.push('from_table_id: bắt buộc và phải là số nguyên');
  if (!to_table_id || isNaN(Number(to_table_id)))
    errs.push('to_table_id: bắt buộc và phải là số nguyên');
  if (errs.length) throw ApiError.validation('Dữ liệu không hợp lệ', errs);

  const fromId = parseInt(from_table_id);
  const toId   = parseInt(to_table_id);

  if (fromId === toId)
    throw ApiError.badRequest('Bàn nguồn và bàn đích không được trùng nhau');

  // ── Bước 2–7: Toàn bộ logic trong Transaction ─────────────────────────────
  // db.transaction() tự gọi BEGIN → fn(client) → COMMIT, hoặc ROLLBACK nếu throw
  const result = await db.transaction(async (client) => {

    // Bước 3: Lock cả 2 bàn theo thứ tự ID tăng dần để tránh deadlock
    // (nếu 2 request đồng thời swap bàn A↔B và B↔A)
    const [lockFirst, lockSecond] = fromId < toId
      ? [fromId, toId]
      : [toId,   fromId];

    await client.query(
      'SELECT id FROM tables WHERE id IN ($1, $2) ORDER BY id FOR UPDATE',
      [lockFirst, lockSecond]
    );

    // ── Bước 4: Kiểm tra bàn NGUỒN ────────────────────────────────────────
    const fromTable = await client.query(
      'SELECT * FROM tables WHERE id = $1',
      [fromId]
    );

    if (fromTable.rows.length === 0)
      throw ApiError.notFound(`Bàn nguồn (id=${fromId}) không tồn tại`);

    const sourceTable = fromTable.rows[0];

    // Trạng thái "occupied" = có ít nhất 1 order đang mở (pending hoặc serving)
    const openOrdersFromSource = await client.query(
      `SELECT id, code, status, total_amount
       FROM orders
       WHERE table_id = $1
         AND status IN ('pending', 'serving')
       ORDER BY created_at`,
      [fromId]
    );

    if (openOrdersFromSource.rows.length === 0)
      throw ApiError.conflict(
        `Bàn nguồn "${sourceTable.code}" không có order nào đang mở (trạng thái: available). Chuyển bàn không cần thiết.`
      );

    // ── Bước 5: Kiểm tra bàn ĐÍCH ─────────────────────────────────────────
    const toTableResult = await client.query(
      'SELECT * FROM tables WHERE id = $1',
      [toId]
    );

    if (toTableResult.rows.length === 0)
      throw ApiError.notFound(`Bàn đích (id=${toId}) không tồn tại`);

    const destTable = toTableResult.rows[0];

    // Bàn đích phải "available" = không có order nào đang mở
    const openOrdersAtDest = await client.query(
      `SELECT id FROM orders
       WHERE table_id = $1
         AND status IN ('pending', 'serving')
       LIMIT 1`,
      [toId]
    );

    if (openOrdersAtDest.rows.length > 0)
      throw ApiError.conflict(
        `Bàn đích "${destTable.code}" đang có khách. Chỉ có thể chuyển đến bàn trống.`
      );

    // ── Bước 6: Cập nhật tất cả orders chưa thanh toán ────────────────────
    // Đổi cả table_id (khoá ngoại) và table_code (denormalized display field)
    const updatedOrders = await client.query(
      `UPDATE orders
       SET table_id   = $1,
           table_code = $2,
           updated_at = NOW()
       WHERE table_id = $3
         AND status IN ('pending', 'serving')
       RETURNING id, code, status, total_amount`,
      [toId, destTable.code, fromId]
    );

    // Trả về dữ liệu kết quả để dùng bên ngoài transaction
    return {
      from_table:     { id: sourceTable.id, code: sourceTable.code },
      to_table:       { id: destTable.id,   code: destTable.code   },
      orders_moved:   updatedOrders.rows,
      orders_count:   updatedOrders.rowCount,
    };
  });

  // ── Bước 8: Ghi audit log (không chặn response nếu lỗi) ──────────────────
  LogModel.write({
    user_id:   req.user?.id,
    user_name: req.user?.full_name,
    action:    'MOVE_TABLE',
    entity:    'TABLE',
    entity_id: result.from_table.id,
    details: {
      from_table_id:  result.from_table.id,
      from_table_code: result.from_table.code,
      to_table_id:    result.to_table.id,
      to_table_code:  result.to_table.code,
      orders_moved:   result.orders_count,
    },
  }).catch(() => {});

  // ── Trả về response thành công ────────────────────────────────────────────
  return ok(res, result, {
    message: `Đã chuyển ${result.orders_count} order từ bàn "${result.from_table.code}" sang bàn "${result.to_table.code}" thành công`,
  });
});
