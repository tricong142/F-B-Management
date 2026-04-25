const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');

// POST   /orders           → Tạo order mới
router.post('/', orderController.createOrder);

// GET    /orders           → Danh sách orders
router.get('/', orderController.getOrders);

// GET    /orders/:id       → Chi tiết 1 order
router.get('/:id', orderController.getOrderById);

// PUT    /orders/:id/status → Cập nhật trạng thái
router.put('/:id/status', orderController.updateOrderStatus);

// DELETE /orders/:id       → Hủy order
router.delete('/:id', orderController.cancelOrder);

// POST   /orders/:id/checkout → Thanh toán (cashier)
router.post('/:id/checkout', orderController.checkout);

module.exports = router;
