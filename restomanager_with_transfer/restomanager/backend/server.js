require('dotenv').config();
const { initDatabase, closePool } = require('./src/database/db');
const { initStorage } = require('./src/storage/minio');
const { runSeed } = require('./src/database/seed');
const app = require('./app');

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    await initDatabase();
    await initStorage();
    await runSeed();

    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log('');
      console.log('🍽️  ============================================');
      console.log('🍽️   RESTAURANT MANAGEMENT SYSTEM');
      console.log('🍽️   PostgreSQL + MinIO + Express');
      console.log('🍽️  ============================================');
      console.log(`🚀  Server: http://localhost:${PORT}`);
      console.log(`📋  Health: http://localhost:${PORT}/api/health`);
      console.log('🍽️  ============================================');
    });

    process.on('SIGTERM', shutdown(server));
    process.on('SIGINT', shutdown(server));
  } catch (err) {
    console.error('❌ Không thể khởi động server:', err);
    process.exit(1);
  }
}

function shutdown(server) {
  return async () => {
    console.log('🛑 Shutting down gracefully...');
    server.close(async () => {
      await closePool();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };
}

startServer();
