const express = require('express');
const { notFoundHandler, globalErrorHandler } = require('./src/middleware/errorHandler');
const orderRoutes = require('./src/routes/orderRoutes');
const invoiceRoutes = require('./src/routes/invoiceRoutes');

const app = express();

// ─── MIDDLEWARE ──────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// ─── HEALTH CHECK ────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: '🍽️  Restaurant Management System đang chạy',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      orders: {
        'POST /orders': 'Tạo order mới',
        'GET /orders': 'Danh sách orders',
        'GET /orders/:id': 'Chi tiết order',
        'PUT /orders/:id/status': 'Cập nhật trạng thái',
        'DELETE /orders/:id': 'Hủy order',
        'POST /orders/:id/checkout': 'Thanh toán (cashier)',
      },
      invoices: {
        'GET /invoices': 'Danh sách hóa đơn',
        'GET /invoices/:id': 'Chi tiết hóa đơn',
      },
    },
  });
});

// ─── ROUTES ──────────────────────────────────────────────────────────────────
app.use('/orders', orderRoutes);
app.use('/invoices', invoiceRoutes);

// ─── ERROR HANDLERS ──────────────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(globalErrorHandler);

module.exports = app;
