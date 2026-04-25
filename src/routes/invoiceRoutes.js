const express = require('express');
const router = express.Router();
const invoiceController = require('../controllers/invoiceController');

// GET /invoices       → Danh sách hóa đơn
router.get('/', invoiceController.getInvoices);

// GET /invoices/:id   → Chi tiết hóa đơn
router.get('/:id', invoiceController.getInvoiceById);

module.exports = router;
