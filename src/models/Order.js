const db = require('../database/db');

class OrderModel {
  // ─── CREATE ORDER + ITEMS (transaction) ───────────────────────────────────
  static async create({ table_number, waiter_name, items, notes }) {
    // 1. Đồng bộ trạng thái bàn: Kiểm tra xem bàn có khách không
    const existing = await db.queryOne(
      `SELECT id FROM orders WHERE table_number = $1 AND status IN ('pending', 'serving') LIMIT 1`,
      [table_number]
    );
    if (existing) {
      throw new Error(`Bàn ${table_number} đang có khách (order pending/serving), không thể tạo mới`);
    }

    return db.transaction(async (client) => {
      // Tính tổng tiền
      let totalAmount = 0;
      const preparedItems = items.map((item) => {
        const totalPrice = item.quantity * item.price;
        totalAmount += totalPrice;
        return { ...item, total_price: totalPrice };
      });

      // Insert order
      const { rows } = await client.query(
        `INSERT INTO orders (table_number, waiter_name, total_amount, notes)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [table_number, waiter_name, totalAmount, notes || null]
      );
      const order = rows[0];

      // Insert order_items
      const insertedItems = [];
      for (const item of preparedItems) {
        const { rows: itemRows } = await client.query(
          `INSERT INTO order_items (order_id, item_name, quantity, price, total_price, notes)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
          [order.id, item.item_name, item.quantity, item.price, item.total_price, item.notes || null]
        );
        insertedItems.push(itemRows[0]);
      }

      order.items = insertedItems;
      return order;
    });
  }

  // ─── FIND ALL ─────────────────────────────────────────────────────────────
  static async findAll(filters = {}) {
    const conditions = [];
    const params = [];

    if (filters.status) {
      const statuses = filters.status.split(',').map(s => s.trim());
      if (statuses.length > 1) {
        const placeholders = statuses.map((_, i) => `$${params.length + i + 1}`);
        conditions.push(`status IN (${placeholders.join(', ')})`);
        params.push(...statuses);
      } else {
        params.push(statuses[0]);
        conditions.push(`status = $${params.length}`);
      }
    }
    if (filters.table_number) {
      params.push(filters.table_number);
      conditions.push(`table_number = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const orders = await db.query(
      `SELECT * FROM orders ${where} ORDER BY created_at DESC`,
      params
    );

    return Promise.all(orders.map((o) => this._attachItems(o)));
  }

  // ─── FIND BY ID ───────────────────────────────────────────────────────────
  static async findById(id) {
    const order = await db.queryOne('SELECT * FROM orders WHERE id = $1', [id]);
    if (!order) return null;
    return this._attachItems(order);
  }

  // ─── UPDATE STATUS ────────────────────────────────────────────────────────
  static async updateStatus(id, status) {
    const order = await this.findById(id);
    if (!order) return null;

    if (order.status === 'completed') throw new Error('Không thể sửa order đã completed');
    if (order.status === 'cancelled') throw new Error('Không thể sửa order đã cancelled');

    const validTransitions = {
      pending: ['serving', 'cancelled'],
      serving: ['completed', 'cancelled'],
    };
    if (!validTransitions[order.status]?.includes(status)) {
      throw new Error(
        `Không thể chuyển từ "${order.status}" sang "${status}". Hợp lệ: ${validTransitions[order.status]?.join(', ')}`
      );
    }

    const updated = await db.queryOne(
      `UPDATE orders SET status = $1, updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [status, id]
    );
    return this._attachItems(updated);
  }

  // ─── CANCEL (DELETE) ──────────────────────────────────────────────────────
  static async cancel(id) {
    const order = await this.findById(id);
    if (!order) return null;
    if (order.status === 'completed') throw new Error('Không thể hủy order đã completed');
    if (order.status === 'cancelled') throw new Error('Order đã bị hủy trước đó');

    const updated = await db.queryOne(
      `UPDATE orders SET status = 'cancelled', updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id]
    );
    return this._attachItems(updated);
  }

  // ─── GET ITEMS ────────────────────────────────────────────────────────────
  static async getItems(orderId) {
    return db.query(
      'SELECT * FROM order_items WHERE order_id = $1 ORDER BY created_at',
      [orderId]
    );
  }

  // ─── PRIVATE ──────────────────────────────────────────────────────────────
  static async _attachItems(order) {
    order.items = await this.getItems(order.id);
    return order;
  }
}

module.exports = OrderModel;
