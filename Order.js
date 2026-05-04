const db = require('../database/db');

class OrderModel {
  /**
   * Tạo order mới.
   * Tự động lấy table_code từ tables nếu truyền table_id.
   * 1 bàn chỉ được có 1 order pending/serving cùng lúc.
   */
  static async create({ table_id, table_code, waiter_id, waiter_name, items, notes }) {
    // Resolve table
    let resolvedTable;
    if (table_id) {
      resolvedTable = await db.queryOne('SELECT * FROM tables WHERE id = $1', [table_id]);
    } else if (table_code) {
      resolvedTable = await db.queryOne('SELECT * FROM tables WHERE code = $1', [table_code]);
    }
    if (!resolvedTable) throw new Error('Bàn không tồn tại');

    // Check for existing open order
    const existing = await db.queryOne(
      `SELECT id FROM orders WHERE table_id = $1 AND status IN ('pending','serving') LIMIT 1`,
      [resolvedTable.id]
    );
    if (existing) throw new Error(`Bàn ${resolvedTable.code} đang có order mở, không thể tạo mới`);

    return db.transaction(async (client) => {
      let totalAmount = 0;
      const prepared = items.map((it) => {
        const total_price = Number(it.quantity) * Number(it.price);
        totalAmount += total_price;
        return { ...it, total_price };
      });

      const { rows } = await client.query(
        `INSERT INTO orders (table_id, table_code, waiter_id, waiter_name, total_amount, notes)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [resolvedTable.id, resolvedTable.code, waiter_id || null, waiter_name, totalAmount, notes || null]
      );
      const order = rows[0];

      const insertedItems = [];
      for (const it of prepared) {
        const { rows: ir } = await client.query(
          `INSERT INTO order_items (order_id, menu_item_id, item_name, quantity, price, total_price, notes)
           VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
          [order.id, it.menu_item_id || null, it.item_name, it.quantity, it.price, it.total_price, it.notes || null]
        );
        insertedItems.push(ir[0]);
      }

      order.items = insertedItems;
      return order;
    });
  }

  static async findAll(filters = {}) {
    const conds = [];
    const params = [];
    if (filters.status) {
      const s = filters.status.split(',').map(x => x.trim()).filter(Boolean);
      const ph = s.map((_, i) => `$${params.length + i + 1}`);
      conds.push(`status IN (${ph.join(',')})`);
      params.push(...s);
    }
    if (filters.table_code) {
      params.push(filters.table_code);
      conds.push(`table_code = $${params.length}`);
    }
    if (filters.waiter_id) {
      params.push(filters.waiter_id);
      conds.push(`waiter_id = $${params.length}`);
    }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const orders = await db.query(
      `SELECT * FROM orders ${where} ORDER BY created_at DESC`,
      params
    );
    return Promise.all(orders.map(o => this._attachItems(o)));
  }

  static async findById(id) {
    const order = await db.queryOne('SELECT * FROM orders WHERE id = $1', [id]);
    if (!order) return null;
    return this._attachItems(order);
  }

  /** Find a single open order for a given table (pending or serving). */
  static async findOpenForTable(tableId) {
    const o = await db.queryOne(
      `SELECT * FROM orders
       WHERE table_id = $1 AND status IN ('pending','serving')
       ORDER BY created_at DESC LIMIT 1`,
      [tableId]
    );
    if (!o) return null;
    return this._attachItems(o);
  }

  static async updateStatus(id, status) {
    const order = await this.findById(id);
    if (!order) return null;
    if (order.status === 'completed') throw new Error('Không thể sửa order đã completed');
    if (order.status === 'cancelled') throw new Error('Không thể sửa order đã cancelled');
    const valid = {
      pending:  ['serving', 'cancelled'],
      serving:  ['completed', 'cancelled'],
    };
    if (!valid[order.status]?.includes(status)) {
      throw new Error(`Không thể chuyển từ "${order.status}" sang "${status}"`);
    }
    const upd = await db.queryOne(
      `UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status, id]
    );
    return this._attachItems(upd);
  }

  static async cancel(id) {
    const order = await this.findById(id);
    if (!order) return null;
    if (order.status === 'completed') throw new Error('Không thể hủy order đã completed');
    if (order.status === 'cancelled') throw new Error('Order đã bị hủy');
    const upd = await db.queryOne(
      `UPDATE orders SET status = 'cancelled', updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id]
    );
    return this._attachItems(upd);
  }

  /** Add items to existing pending/serving order */
  static async addItems(id, items) {
    const order = await this.findById(id);
    if (!order) throw new Error('Order không tồn tại');
    if (!['pending', 'serving'].includes(order.status)) throw new Error('Order đã đóng, không thể thêm món');

    return db.transaction(async (client) => {
      let added = 0;
      for (const it of items) {
        const total_price = Number(it.quantity) * Number(it.price);
        added += total_price;
        await client.query(
          `INSERT INTO order_items (order_id, menu_item_id, item_name, quantity, price, total_price, notes)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [id, it.menu_item_id || null, it.item_name, it.quantity, it.price, total_price, it.notes || null]
        );
      }
      await client.query(
        `UPDATE orders SET total_amount = total_amount + $1, updated_at = NOW() WHERE id = $2`,
        [added, id]
      );
      const updated = await client.query(`SELECT * FROM orders WHERE id = $1`, [id]);
      return updated.rows[0];
    }).then(o => this._attachItems(o));
  }

  static async getItems(orderId) {
    return db.query('SELECT * FROM order_items WHERE order_id = $1 ORDER BY created_at', [orderId]);
  }

  /**
   * Cập nhật một order_item (đổi quantity hoặc notes).
   * Tự động tính lại total_price của item và total_amount của order.
   */
  static async updateItem(orderId, itemId, { quantity, notes }) {
    const order = await db.queryOne('SELECT * FROM orders WHERE id = $1', [orderId]);
    if (!order) throw new Error('Order không tồn tại');
    if (!['pending', 'serving'].includes(order.status))
      throw new Error('Order đã đóng, không thể sửa');

    const item = await db.queryOne(
      'SELECT * FROM order_items WHERE id = $1 AND order_id = $2',
      [itemId, orderId]
    );
    if (!item) throw new Error('Order item không tồn tại');

    return db.transaction(async (client) => {
      const newQty = quantity !== undefined ? Number(quantity) : item.quantity;
      if (!Number.isFinite(newQty) || newQty < 1)
        throw new Error('quantity phải là số nguyên dương');
      const newTotal = newQty * Number(item.price);
      const delta = newTotal - Number(item.total_price);
      const newNotes = notes !== undefined ? notes : item.notes;

      await client.query(
        `UPDATE order_items
         SET quantity = $1, total_price = $2, notes = $3
         WHERE id = $4`,
        [newQty, newTotal, newNotes, itemId]
      );
      await client.query(
        `UPDATE orders SET total_amount = total_amount + $1, updated_at = NOW() WHERE id = $2`,
        [delta, orderId]
      );
      const updated = await client.query('SELECT * FROM orders WHERE id = $1', [orderId]);
      return updated.rows[0];
    }).then(o => this._attachItems(o));
  }

  /**
   * Xoá một order_item. Tự cập nhật lại total_amount của order.
   * Nếu là item cuối cùng → vẫn giữ order rỗng (không tự huỷ) để cashier quyết định.
   */
  static async removeItem(orderId, itemId) {
    const order = await db.queryOne('SELECT * FROM orders WHERE id = $1', [orderId]);
    if (!order) throw new Error('Order không tồn tại');
    if (!['pending', 'serving'].includes(order.status))
      throw new Error('Order đã đóng, không thể xoá món');

    const item = await db.queryOne(
      'SELECT * FROM order_items WHERE id = $1 AND order_id = $2',
      [itemId, orderId]
    );
    if (!item) throw new Error('Order item không tồn tại');

    return db.transaction(async (client) => {
      await client.query('DELETE FROM order_items WHERE id = $1', [itemId]);
      await client.query(
        `UPDATE orders SET total_amount = total_amount - $1, updated_at = NOW() WHERE id = $2`,
        [Number(item.total_price), orderId]
      );
      const updated = await client.query('SELECT * FROM orders WHERE id = $1', [orderId]);
      return updated.rows[0];
    }).then(o => this._attachItems(o));
  }

  /**
   * Chuyển bàn – Transfer order từ bàn nguồn sang bàn đích.
   *
   * Yêu cầu nghiệp vụ:
   *  1. Order nguồn phải OPEN (pending | serving)
   *  2. Bàn đích phải tồn tại và KHÔNG có order đang mở
   *  3. Toàn bộ thao tác wrapped trong 1 TRANSACTION (atomicity)
   *  4. Ghi transfer_log trên order + activity_log
   *
   * @param {string} orderId       - UUID của order cần chuyển
   * @param {string} toTableId     - UUID bàn đích
   * @param {string} operatorId    - UUID user thực hiện (waiter/admin)
   * @param {string} operatorName  - Tên user (cho log)
   */
  static async transferTable(orderId, toTableId, operatorId, operatorName) {
    return db.transaction(async (client) => {
      // ── 1. Lock order để tránh race condition (chống double-click / spam) ──
      const { rows: orderRows } = await client.query(
        `SELECT * FROM orders WHERE id = $1 FOR UPDATE`,
        [orderId]
      );
      const order = orderRows[0];
      if (!order) throw new Error('Order không tồn tại');
      if (!['pending', 'serving'].includes(order.status)) {
        throw new Error(`Chỉ chuyển được order đang mở (pending/serving). Trạng thái hiện tại: ${order.status}`);
      }

      // ── 2. Lock & kiểm tra bàn đích ──────────────────────────────────────
      const { rows: destRows } = await client.query(
        `SELECT * FROM tables WHERE id = $1 FOR UPDATE`,
        [toTableId]
      );
      const destTable = destRows[0];
      if (!destTable) throw new Error('Bàn đích không tồn tại');
      if (!destTable.is_active) throw new Error(`Bàn ${destTable.code} đang không hoạt động`);

      // ── 3. Kiểm tra bàn đích không có order đang mở ──────────────────────
      const { rows: conflictRows } = await client.query(
        `SELECT id, code FROM orders
         WHERE table_id = $1 AND status IN ('pending','serving')
         LIMIT 1`,
        [toTableId]
      );
      if (conflictRows.length > 0) {
        throw new Error(`Bàn ${destTable.code} đang có order mở (${conflictRows[0].code}), không thể chuyển đến`);
      }

      // ── 4. Không cho chuyển về bàn hiện tại ──────────────────────────────
      if (order.table_id === toTableId) {
        throw new Error('Bàn đích trùng với bàn hiện tại, vui lòng chọn bàn khác');
      }

      // ── 5. Xây dựng log entry ─────────────────────────────────────────────
      const logEntry = {
        from_table_id:    order.table_id,
        from_table_code:  order.table_code,
        to_table_id:      toTableId,
        to_table_code:    destTable.code,
        transferred_by:   operatorName,
        transferred_by_id: operatorId || null,
        transferred_at:   new Date().toISOString(),
      };
      // transfer_log là JSONB, có thể là array hoặc null tùy row cũ
      const existingLog = Array.isArray(order.transfer_log) ? order.transfer_log : [];

      // ── 6. Cập nhật order ─────────────────────────────────────────────────
      const { rows: updated } = await client.query(
        `UPDATE orders
         SET table_id     = $1,
             table_code   = $2,
             transfer_log = $3::jsonb,
             updated_at   = NOW()
         WHERE id = $4
         RETURNING *`,
        [
          toTableId,
          destTable.code,
          JSON.stringify([...existingLog, logEntry]),
          orderId,
        ]
      );
      return updated[0];
    }).then(o => this._attachItems(o));
  }

  static async _attachItems(order) {
    if (!order) return null;
    order.items = await this.getItems(order.id);
    return order;
  }
}

module.exports = OrderModel;
