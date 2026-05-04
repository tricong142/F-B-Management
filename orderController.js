const OrderModel    = require('../models/Order');
const InvoiceModel  = require('../models/Invoice');
const LogModel      = require('../models/Log');
const { ok, created, paged, paginateArray, asyncHandler, ApiError } = require('../utils/response');

const PAY_METHODS = ['cash', 'card', 'transfer', 'online', 'grab', 'vnpay', 'banking', 'momo', 'zalopay'];

function validateCreateOrder(body) {
  const errs = [];
  if (!body.table_id && !body.table_code) errs.push('table_id hoặc table_code: bắt buộc');
  if (!body.waiter_name || String(body.waiter_name).trim() === '') errs.push('waiter_name: bắt buộc');
  if (!Array.isArray(body.items) || body.items.length === 0) {
    errs.push('items: phải là mảng và có ít nhất 1 phần tử');
  } else {
    body.items.forEach((it, i) => {
      if (!it.item_name || String(it.item_name).trim() === '')
        errs.push(`items[${i}].item_name: bắt buộc`);
      if (!it.quantity || isNaN(Number(it.quantity)) || Number(it.quantity) < 1)
        errs.push(`items[${i}].quantity: phải là số nguyên dương`);
      if (it.price === undefined || isNaN(Number(it.price)) || Number(it.price) < 0)
        errs.push(`items[${i}].price: phải là số >= 0`);
    });
  }
  return errs;
}

function validateCheckout(body) {
  const errs = [];
  if (!body.cashier_name || String(body.cashier_name).trim() === '') errs.push('cashier_name: bắt buộc');
  if (body.discount !== undefined && (isNaN(Number(body.discount)) || Number(body.discount) < 0))
    errs.push('discount: phải là số >= 0');
  if (body.payment_method && !PAY_METHODS.includes(body.payment_method))
    errs.push(`payment_method: phải thuộc {${PAY_METHODS.join('|')}}`);
  if (body.vat_rate !== undefined && (isNaN(Number(body.vat_rate)) || Number(body.vat_rate) < 0))
    errs.push('vat_rate: phải là số >= 0');
  if (body.paid_amount !== undefined && body.paid_amount !== null &&
      (isNaN(Number(body.paid_amount)) || Number(body.paid_amount) < 0))
    errs.push('paid_amount: phải là số >= 0');
  return errs;
}

exports.createOrder = asyncHandler(async (req, res) => {
  const errs = validateCreateOrder(req.body || {});
  if (errs.length) throw ApiError.validation('Dữ liệu không hợp lệ', errs);

  const order = await OrderModel.create({
    table_id:    req.body.table_id   || null,
    table_code:  req.body.table_code || null,
    waiter_id:   req.user?.id || null,
    waiter_name: String(req.body.waiter_name).trim(),
    items: req.body.items.map(i => ({
      menu_item_id: i.menu_item_id || null,
      item_name:    String(i.item_name).trim(),
      quantity:     parseInt(i.quantity),
      price:        parseFloat(i.price),
      notes:        i.notes || null,
    })),
    notes: req.body.notes || null,
  });
  LogModel.write({
    user_id: req.user?.id, user_name: req.user?.full_name,
    action: 'CREATE_ORDER', entity: 'ORDER', entity_id: order.id,
    details: { table: order.table_code, total: order.total_amount },
  }).catch(() => {});
  return created(res, order, 'Tạo order thành công');
});

exports.getOrders = asyncHandler(async (req, res) => {
  const { status, table_code, waiter_id, page, limit } = req.query;
  const all = await OrderModel.findAll({ status, table_code, waiter_id });
  const r = paginateArray(all, { page, limit });
  return paged(res, { ...r, message: `Lấy danh sách orders (${r.total})` });
});

exports.getOrderById = asyncHandler(async (req, res) => {
  const o = await OrderModel.findById(req.params.id);
  if (!o) throw ApiError.notFound('Order không tồn tại');
  return ok(res, o);
});

exports.getOpenOrderForTable = asyncHandler(async (req, res) => {
  const o = await OrderModel.findOpenForTable(req.params.tableId);
  // Cho phép null khi chưa có đơn mở.
  return ok(res, o ?? null);
});

exports.updateOrderStatus = asyncHandler(async (req, res) => {
  const { status } = req.body || {};
  if (!status) throw ApiError.validation('Dữ liệu không hợp lệ', ['status: bắt buộc']);
  const o = await OrderModel.updateStatus(req.params.id, status);
  if (!o) throw ApiError.notFound('Order không tồn tại');
  LogModel.write({
    user_id: req.user?.id, user_name: req.user?.full_name,
    action: 'UPDATE_ORDER_STATUS', entity: 'ORDER', entity_id: o.id, details: { status },
  }).catch(() => {});
  return ok(res, o, { message: `Cập nhật trạng thái: ${status}` });
});

exports.cancelOrder = asyncHandler(async (req, res) => {
  const o = await OrderModel.cancel(req.params.id);
  if (!o) throw ApiError.notFound('Order không tồn tại');
  LogModel.write({
    user_id: req.user?.id, user_name: req.user?.full_name,
    action: 'CANCEL_ORDER', entity: 'ORDER', entity_id: o.id,
  }).catch(() => {});
  return ok(res, o, { message: 'Hủy order thành công' });
});

exports.addItems = asyncHandler(async (req, res) => {
  if (!Array.isArray(req.body.items) || !req.body.items.length)
    throw ApiError.validation('Dữ liệu không hợp lệ', ['items: không được rỗng']);
  const o = await OrderModel.addItems(req.params.id, req.body.items.map(i => ({
    menu_item_id: i.menu_item_id || null,
    item_name:    String(i.item_name).trim(),
    quantity:     parseInt(i.quantity),
    price:        parseFloat(i.price),
    notes:        i.notes || null,
  })));
  LogModel.write({
    user_id: req.user?.id, user_name: req.user?.full_name,
    action: 'ADD_ORDER_ITEMS', entity: 'ORDER', entity_id: o.id,
    details: { count: req.body.items.length },
  }).catch(() => {});
  return ok(res, o, { message: 'Đã thêm món vào order' });
});

exports.updateItem = asyncHandler(async (req, res) => {
  const { quantity, notes } = req.body || {};
  if (quantity === undefined && notes === undefined)
    throw ApiError.validation('Dữ liệu không hợp lệ', ['cần truyền quantity hoặc notes']);
  if (quantity !== undefined && (isNaN(Number(quantity)) || Number(quantity) < 1))
    throw ApiError.validation('Dữ liệu không hợp lệ', ['quantity: phải là số nguyên dương']);

  let order;
  try {
    order = await OrderModel.updateItem(req.params.id, req.params.itemId, { quantity, notes });
  } catch (err) {
    if (String(err.message).includes('không tồn tại')) throw ApiError.notFound(err.message);
    throw ApiError.badRequest(err.message);
  }
  LogModel.write({
    user_id: req.user?.id, user_name: req.user?.full_name,
    action: 'UPDATE_ORDER_ITEM', entity: 'ORDER_ITEM', entity_id: req.params.itemId,
    details: { order_id: req.params.id, quantity, notes },
  }).catch(() => {});
  return ok(res, order, { message: 'Đã cập nhật món' });
});

exports.removeItem = asyncHandler(async (req, res) => {
  let order;
  try {
    order = await OrderModel.removeItem(req.params.id, req.params.itemId);
  } catch (err) {
    if (String(err.message).includes('không tồn tại')) throw ApiError.notFound(err.message);
    throw ApiError.badRequest(err.message);
  }
  LogModel.write({
    user_id: req.user?.id, user_name: req.user?.full_name,
    action: 'REMOVE_ORDER_ITEM', entity: 'ORDER_ITEM', entity_id: req.params.itemId,
    details: { order_id: req.params.id },
  }).catch(() => {});
  return ok(res, order, { message: 'Đã xoá món khỏi order' });
});

// ─── Transfer Table ────────────────────────────────────────────────────────
exports.transferTable = asyncHandler(async (req, res) => {
  const { to_table_id } = req.body || {};
  if (!to_table_id || typeof to_table_id !== 'string' || !to_table_id.trim()) {
    throw ApiError.validation('Dữ liệu không hợp lệ', ['to_table_id: bắt buộc (UUID bàn đích)']);
  }

  let order;
  try {
    order = await OrderModel.transferTable(
      req.params.id,
      to_table_id.trim(),
      req.user?.id   || null,
      req.user?.full_name || 'Không rõ',
    );
  } catch (err) {
    // Phân loại lỗi nghiệp vụ → HTTP code phù hợp
    const msg = String(err.message);
    if (msg.includes('không tồn tại'))      throw ApiError.notFound(msg);
    if (msg.includes('đang có order mở'))    throw ApiError.conflict(msg);
    if (msg.includes('không hoạt động'))     throw ApiError.badRequest(msg);
    if (msg.includes('trùng với bàn'))       throw ApiError.badRequest(msg);
    if (msg.includes('đang mở'))             throw ApiError.badRequest(msg);
    throw ApiError.badRequest(msg);
  }

  // Ghi activity log (fire-and-forget, không làm fail request)
  const lastLog = (order.transfer_log || []).slice(-1)[0] || {};
  LogModel.write({
    user_id:   req.user?.id,
    user_name: req.user?.full_name,
    action:    'TRANSFER_TABLE',
    entity:    'ORDER',
    entity_id: order.id,
    details: {
      order_code:      order.code,
      from_table_code: lastLog.from_table_code,
      to_table_code:   lastLog.to_table_code,
    },
  }).catch(() => {});

  return ok(res, order, {
    message: `Chuyển bàn thành công: ${lastLog.from_table_code} → ${lastLog.to_table_code}`,
  });
});

exports.checkout = asyncHandler(async (req, res) => {
  const errs = validateCheckout(req.body || {});
  if (errs.length) throw ApiError.validation('Dữ liệu không hợp lệ', errs);
  let inv;
  try {
    inv = await InvoiceModel.checkout({
      order_id:       req.params.id,
      cashier_id:     req.user?.id || null,
      cashier_name:   String(req.body.cashier_name).trim(),
      discount:       parseFloat(req.body.discount || 0),
      discount_note:  req.body.discount_note || null,
      vat_rate:       req.body.vat_rate !== undefined ? Number(req.body.vat_rate) : 8,
      payment_method: req.body.payment_method || 'cash',
      paid_amount:    req.body.paid_amount,
    });
  } catch (err) {
    if (String(err.message).includes('không tồn tại')) throw ApiError.notFound(err.message);
    throw ApiError.badRequest(err.message);
  }
  LogModel.write({
    user_id: req.user?.id, user_name: req.user?.full_name,
    action: 'CHECKOUT', entity: 'INVOICE', entity_id: inv.id,
    details: { table: inv.table_code, final: inv.final_amount, payment: inv.payment_method },
  }).catch(() => {});
  return created(res, inv, 'Thanh toán thành công');
});
