const { Pool } = require('pg');

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
      }
    : {
        host:     process.env.DB_HOST     || 'localhost',
        port:     parseInt(process.env.DB_PORT) || 5432,
        database: process.env.DB_NAME     || 'restaurant_db',
        user:     process.env.DB_USER     || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
      }
);

pool.on('error', (err) => {
  console.error('❌ PostgreSQL pool error:', err.message);
});

// ─── MIGRATIONS ──────────────────────────────────────────────────────────────
async function initDatabase() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        table_number   INTEGER NOT NULL CHECK (table_number > 0),
        waiter_name    TEXT NOT NULL,
        status         TEXT NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending','serving','completed','cancelled')),
        total_amount   NUMERIC(12,2) NOT NULL DEFAULT 0,
        check_in_time  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        check_out_time TIMESTAMPTZ,
        notes          TEXT,
        created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id    UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        item_name   TEXT NOT NULL,
        quantity    INTEGER NOT NULL CHECK (quantity > 0),
        price       NUMERIC(12,2) NOT NULL CHECK (price >= 0),
        total_price NUMERIC(12,2) NOT NULL,
        notes       TEXT,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS invoices (
        id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id       UUID NOT NULL UNIQUE REFERENCES orders(id),
        table_number   INTEGER NOT NULL,
        waiter_name    TEXT NOT NULL,
        cashier_name   TEXT NOT NULL,
        total_amount   NUMERIC(12,2) NOT NULL,
        discount       NUMERIC(12,2) NOT NULL DEFAULT 0,
        discount_note  TEXT,
        final_amount   NUMERIC(12,2) NOT NULL,
        check_in_time  TIMESTAMPTZ NOT NULL,
        check_out_time TIMESTAMPTZ NOT NULL,
        payment_method TEXT NOT NULL DEFAULT 'cash'
                         CHECK (payment_method IN ('cash','card','transfer')),
        created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS invoice_items (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        invoice_id    UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
        order_item_id UUID NOT NULL,
        item_name     TEXT NOT NULL,
        quantity      INTEGER NOT NULL,
        price         NUMERIC(12,2) NOT NULL,
        total_price   NUMERIC(12,2) NOT NULL,
        notes         TEXT
      )
    `);

    console.log('✅ Database initialized — all tables ready');
  } finally {
    client.release();
  }
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

/** Trả về tất cả rows */
async function query(sql, params = []) {
  const result = await pool.query(sql, params);
  return result.rows;
}

/** Trả về row đầu tiên hoặc null */
async function queryOne(sql, params = []) {
  const result = await pool.query(sql, params);
  return result.rows[0] ?? null;
}

/**
 * Atomic transaction.
 * Dùng: await transaction(async (client) => { await client.query(...) })
 */
async function transaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function closePool() {
  await pool.end();
}

module.exports = { initDatabase, query, queryOne, transaction, closePool, pool };
