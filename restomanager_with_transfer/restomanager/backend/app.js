const express = require('express');
const cors = require('cors');
const { ok } = require('./src/utils/response');
const { notFoundHandler, globalErrorHandler } = require('./src/middleware/errorHandler');

const authRoutes      = require('./src/routes/authRoutes');
const userRoutes      = require('./src/routes/userRoutes');
const menuRoutes      = require('./src/routes/menuRoutes');
const tableRoutes     = require('./src/routes/tableRoutes');
const orderRoutes     = require('./src/routes/orderRoutes');
const invoiceRoutes   = require('./src/routes/invoiceRoutes');
const fileRoutes      = require('./src/routes/fileRoutes');
const statRoutes      = require('./src/routes/statRoutes');
const logRoutes       = require('./src/routes/logRoutes');

const app = express();

// ─── MIDDLEWARE ──────────────────────────────────────────────────────────────
app.disable('x-powered-by');
app.set('trust proxy', true);
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Request log đơn giản (không log body để tránh lộ password)
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// ─── HEALTH ──────────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) =>
  ok(res, {
    status:    'ok',
    service:   'RestoManager API',
    version:   '2.0.0',
    timestamp: new Date().toISOString(),
  })
);

// ─── ROUTES ──────────────────────────────────────────────────────────────────
app.use('/api/auth',     authRoutes);
app.use('/api/users',    userRoutes);
app.use('/api/menu',     menuRoutes);
app.use('/api/tables',   tableRoutes);
app.use('/api/orders',   orderRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/files',    fileRoutes);
app.use('/api/stats',    statRoutes);
app.use('/api/logs',     logRoutes);

// ─── ERROR ───────────────────────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(globalErrorHandler);

module.exports = app;
