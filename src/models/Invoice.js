const db = require('../database/db');
const OrderModel = require('./Order');

class InvoiceModel {
  // ─── CHECKOUT (transaction) ───────────────────────────────────────────────
  static async checkout({ order_id, cashier_name, discount = 0, discount_note, payment_method = 'cash' }) {
    const order = await OrderModel.findById(order_id);
    if (!order) throw new Error('Order không tồn tại');
    if (order.status === 'cancelled') throw new Error('Không thể checkout order đã bị hủy');
    if (order.status === 'completed') throw new Error('Order này đã được thanh toán');
    if (discount < 0) throw new Error('Giảm giá không thể âm');
    if (discount > order.total_amount) throw new Error('Giảm giá không thể lớn hơn tổng tiền');

    const finalAmount = parseFloat(order.total_amount) - discount;

    return db.transaction(async (client) => {
      // 1. Insert invoice
      const { rows } = await client.query(
        `INSERT INTO invoices
           (order_id, table_number, waiter_name, cashier_name,
            total_amount, discount, discount_note, final_amount,
            check_in_time, check_out_time, payment_method)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),$10)
         RETURNING *`,
        [
          order_id, order.table_number, order.waiter_name, cashier_name,
          order.total_amount, discount, discount_note || null, finalAmount,
          order.check_in_time, payment_method,
        ]
      );
      const invoice = rows[0];

      // 2. Copy order_items → invoice_items
      const insertedItems = [];
      for (const item of order.items) {
        const { rows: itemRows } = await client.query(
          `INSERT INTO invoice_items
             (invoice_id, order_item_id, item_name, quantity, price, total_price, notes)
           VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
          [invoice.id, item.id, item.item_name, item.quantity, item.price, item.total_price, item.notes]
        );
        insertedItems.push(itemRows[0]);
      }

      // 3. Update order → completed
      await client.query(
        `UPDATE orders
         SET status = 'completed', check_out_time = NOW(), updated_at = NOW()
         WHERE id = $1`,
        [order_id]
      );

      invoice.items = insertedItems;
      return invoice;
    });
  }

  // ─── FIND BY ID ───────────────────────────────────────────────────────────
  static async findById(id) {
    const invoice = await db.queryOne('SELECT * FROM invoices WHERE id = $1', [id]);
    if (!invoice) return null;
    return this._attachItems(invoice);
  }

  // ─── FIND BY ORDER ID ─────────────────────────────────────────────────────
  static async findByOrderId(orderId) {
    const invoice = await db.queryOne('SELECT * FROM invoices WHERE order_id = $1', [orderId]);
    if (!invoice) return null;
    return this._attachItems(invoice);
  }

  // ─── FIND ALL ─────────────────────────────────────────────────────────────
  static async findAll(filters = {}) {
    const conditions = [];
    const params = [];

    if (filters.table_number) {
      params.push(filters.table_number);
      conditions.push(`table_number = $${params.length}`);
    }
    if (filters.cashier_name) {
      params.push(`%${filters.cashier_name}%`);
      conditions.push(`cashier_name ILIKE $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const invoices = await db.query(
      `SELECT * FROM invoices ${where} ORDER BY created_at DESC`,
      params
    );

    return Promise.all(invoices.map((inv) => this._attachItems(inv)));
  }

  // ─── PRIVATE ──────────────────────────────────────────────────────────────
  static async _attachItems(invoice) {
    invoice.items = await db.query(
      'SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY id',
      [invoice.id]
    );
    return invoice;
  }
}

module.exports = InvoiceModel;
