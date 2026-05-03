// =============================================================================
//  tableRoutes.js
//  Khai báo tất cả API endpoint cho resource /api/tables
// =============================================================================

const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/tableController');
const { requireAuth, requireRole } = require('../middleware/auth');
const { validateBody }             = require('../middleware/validate');

// =============================================================================
//  GET /api/tables
//  Lấy danh sách bàn. Query params tuỳ chọn:
//    ?with_status=true  → kèm trạng thái realtime từ orders
//    ?zone=indoor|outdoor|vip
//    ?page=1&limit=50
//  Yêu cầu: đăng nhập (mọi role)
// =============================================================================
router.get('/', requireAuth, ctrl.list);

// =============================================================================
//  POST /api/tables
//  Tạo bàn mới. Chỉ admin được phép.
//  Body: { code, zone, capacity }
// =============================================================================
router.post(
  '/',
  requireAuth,
  requireRole('admin'),
  validateBody({
    code:     { required: true,  type: 'string',  minLength: 1 },
    zone:     { required: true,  enum: ['indoor', 'outdoor', 'vip'] },
    capacity: { required: true,  type: 'integer', min: 1 },
  }),
  ctrl.create,
);

// =============================================================================
//  POST /api/tables/move          ← ENDPOINT MỚI: Chuyển bàn
//  Chuyển toàn bộ order chưa thanh toán từ bàn A sang bàn B.
//
//  Body:
//    from_table_id  {number} – ID bàn nguồn (phải đang có khách / có order mở)
//    to_table_id    {number} – ID bàn đích  (phải đang trống / không có order mở)
//
//  Điều kiện tiên quyết:
//    • Bàn nguồn phải có ít nhất 1 order với status IN ('pending','serving')
//    • Bàn đích KHÔNG được có order nào với status IN ('pending','serving')
//    • from_table_id ≠ to_table_id
//
//  Yêu cầu quyền: đăng nhập (waiter trở lên)
//  ─ Đặt TRƯỚC route /:id để tránh Express hiểu "move" là :id param ─
// =============================================================================
router.post(
  '/move',
  requireAuth,                    // Bắt buộc phải đăng nhập
  validateBody({
    from_table_id: { required: true, type: 'integer', min: 1 },
    to_table_id:   { required: true, type: 'integer', min: 1 },
  }),
  ctrl.moveTable,
);

// =============================================================================
//  PUT /api/tables/:id
//  Cập nhật thông tin bàn. Chỉ admin.
//  Body (tuỳ chọn): { code, zone, capacity, is_active }
// =============================================================================
router.put('/:id', requireAuth, requireRole('admin'), ctrl.update);

// =============================================================================
//  DELETE /api/tables/:id
//  Xoá bàn. Chỉ admin.
// =============================================================================
router.delete('/:id', requireAuth, requireRole('admin'), ctrl.remove);

module.exports = router;
