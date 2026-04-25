require('dotenv').config(); // nếu dùng file .env
const { initDatabase, closePool } = require('./src/database/db');
const app = require('./app');

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    await initDatabase();
    const server = app.listen(PORT, () => {
      console.log('');
      console.log('🍽️  ============================================');
      console.log('🍽️   RESTAURANT MANAGEMENT SYSTEM (PostgreSQL)');
      console.log('🍽️  ============================================');
      console.log(`🚀  Server: http://localhost:${PORT}`);
      console.log(`📋  Health: http://localhost:${PORT}/health`);
      console.log('');
      console.log('📌  ENDPOINTS:');
      console.log(`   POST   /orders`);
      console.log(`   GET    /orders`);
      console.log(`   GET    /orders/:id`);
      console.log(`   PUT    /orders/:id/status`);
      console.log(`   DELETE /orders/:id`);
      console.log(`   POST   /orders/:id/checkout`);
      console.log(`   GET    /invoices`);
      console.log(`   GET    /invoices/:id`);
      console.log('🍽️  ============================================');
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      console.log('🛑 Shutting down...');
      server.close(async () => {
        await closePool();
        process.exit(0);
      });
    });
  } catch (err) {
    console.error('❌ Không thể khởi động server:', err.message);
    process.exit(1);
  }
}

startServer();
