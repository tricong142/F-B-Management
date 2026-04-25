require('dotenv').config();
const { Client } = require('pg');

const c = new Client({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: String(process.env.DB_PASSWORD)
});
c.connect().then(() => {
  return c.query(`
    SELECT table_name, column_name, data_type 
    FROM information_schema.columns 
    WHERE table_schema='public' AND table_name IN ('orders', 'invoices', 'order_items', 'invoice_items')
  `);
}).then(res => {
  console.log(JSON.stringify(res.rows, null, 2));
  return c.end();
}).catch(console.error);
