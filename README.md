# 🍽️ Restaurant Management System

> **Order → Cashier → Invoice** — Hệ thống quản lý nhà hàng hoàn chỉnh

## 🚀 Khởi động nhanh

```bash
npm install
node server.js
# Server chạy tại http://localhost:3000
```

---

## 🗄️ Database Schema

```
orders (1) ──────────── (n) order_items
  │
  └── (1) ─────────────── (1) invoices (1) ──────── (n) invoice_items
```

### Bảng `orders`
| Column | Type | Mô tả |
|--------|------|-------|
| id | TEXT PK | UUID |
| table_number | INTEGER | Số bàn |
| waiter_name | TEXT | Tên nhân viên phục vụ |
| status | TEXT | pending → serving → completed / cancelled |
| total_amount | REAL | Tổng tiền |
| check_in_time | TEXT | Giờ vào |
| check_out_time | TEXT | Giờ ra (sau checkout) |
| notes | TEXT | Ghi chú |

### Bảng `order_items`
| Column | Type | Mô tả |
|--------|------|-------|
| id | TEXT PK | UUID |
| order_id | TEXT FK | Liên kết orders |
| item_name | TEXT | Tên món |
| quantity | INTEGER | Số lượng |
| price | REAL | Đơn giá |
| total_price | REAL | quantity × price |

### Bảng `invoices`
| Column | Type | Mô tả |
|--------|------|-------|
| id | TEXT PK | UUID |
| order_id | TEXT FK UNIQUE | Liên kết orders (1-1) |
| table_number | INTEGER | Số bàn |
| waiter_name | TEXT | Nhân viên phục vụ |
| cashier_name | TEXT | Thu ngân |
| total_amount | REAL | Tổng tiền gốc |
| discount | REAL | Giảm giá |
| discount_note | TEXT | Ghi chú giảm giá |
| final_amount | REAL | total_amount − discount |
| check_in_time | TEXT | Giờ vào |
| check_out_time | TEXT | Giờ thanh toán |
| payment_method | TEXT | cash / card / transfer |

### Bảng `invoice_items`
| Column | Type | Mô tả |
|--------|------|-------|
| id | TEXT PK | UUID |
| invoice_id | TEXT FK | Liên kết invoices |
| order_item_id | TEXT | Tham chiếu order_items gốc |
| item_name | TEXT | Tên món |
| quantity | INTEGER | Số lượng |
| price | REAL | Đơn giá |
| total_price | REAL | Thành tiền |

---

## 📡 API Reference

### `POST /orders` — Tạo order mới

**Request:**
```json
{
  "table_number": 5,
  "waiter_name": "Nguyễn Văn A",
  "notes": "Khách dị ứng hải sản",
  "items": [
    { "item_name": "Phở bò tái",    "quantity": 2, "price": 75000 },
    { "item_name": "Cơm tấm sườn",  "quantity": 1, "price": 65000 },
    { "item_name": "Nước cam tươi", "quantity": 3, "price": 35000 }
  ]
}
```

**Response 201:**
```json
{
  "success": true,
  "message": "Tạo order thành công",
  "data": {
    "id": "d64f55a5-...",
    "table_number": 5,
    "waiter_name": "Nguyễn Văn A",
    "status": "pending",
    "total_amount": 320000,
    "check_in_time": "2026-04-25T03:00:00.000Z",
    "items": [ ... ]
  }
}
```

---

### `GET /orders` — Danh sách orders

Query params: `?status=pending&table_number=5`

**Response 200:**
```json
{
  "success": true,
  "message": "Lấy danh sách orders thành công (3 orders)",
  "data": [ ... ]
}
```

---

### `PUT /orders/:id/status` — Cập nhật trạng thái

**Trạng thái hợp lệ:**
- `pending` → `serving` hoặc `cancelled`
- `serving` → `completed` hoặc `cancelled`

**Request:**
```json
{ "status": "serving" }
```

---

### `DELETE /orders/:id` — Hủy order

❌ Không thể hủy nếu `status = completed`

**Response 200:**
```json
{
  "success": true,
  "message": "Hủy order thành công",
  "data": { "status": "cancelled", ... }
}
```

---

### `POST /orders/:id/checkout` — Thu ngân thanh toán ⭐

**Business Logic:**
- `total_amount` = SUM(order_items.total_price)
- `final_amount` = total_amount − discount
- Tạo `invoice` + copy tất cả `order_items` → `invoice_items`
- Cập nhật order: `status = completed`, `check_out_time = now`
- **Dùng transaction** → đảm bảo atomicity

**Request:**
```json
{
  "cashier_name": "Trần Thị B",
  "discount": 50000,
  "discount_note": "Khách thân thiết",
  "payment_method": "cash"
}
```

**Response 201:**
```json
{
  "success": true,
  "message": "Thanh toán thành công! Invoice đã được tạo.",
  "data": {
    "id": "5eb74899-...",
    "order_id": "d64f55a5-...",
    "table_number": 5,
    "waiter_name": "Nguyễn Văn A",
    "cashier_name": "Trần Thị B",
    "total_amount": 320000,
    "discount": 50000,
    "discount_note": "Khách thân thiết",
    "final_amount": 270000,
    "check_in_time": "2026-04-25T03:00:00.000Z",
    "check_out_time": "2026-04-25T03:45:00.000Z",
    "payment_method": "cash",
    "items": [
      {
        "item_name": "Phở bò tái",
        "quantity": 2,
        "price": 75000,
        "total_price": 150000
      }
    ]
  }
}
```

---

### `GET /invoices/:id` — Chi tiết hóa đơn

**Response đầy đủ:**
```json
{
  "success": true,
  "message": "Lấy chi tiết hóa đơn thành công",
  "data": {
    "id": "...",
    "order_id": "...",
    "table_number": 5,
    "waiter_name": "Nguyễn Văn A",
    "cashier_name": "Trần Thị B",
    "total_amount": 320000,
    "discount": 50000,
    "final_amount": 270000,
    "check_in_time": "...",
    "check_out_time": "...",
    "payment_method": "cash",
    "items": [ ... ]
  }
}
```

---

## 🔒 Business Rules

| Rule | Chi tiết |
|------|----------|
| ❌ Checkout cancelled | Không checkout order bị hủy |
| ❌ Checkout completed | Không checkout order đã thanh toán |
| ❌ Edit completed | Không sửa status order đã completed |
| ❌ Delete completed | Không hủy order đã completed |
| ✅ Transaction | Checkout dùng DB transaction (atomic) |
| ✅ Discount | Không được âm, không được > total_amount |

---

## 🧪 Test

```bash
# End-to-end test tất cả business logic
node test-flow.js

# Import Postman collection
# File: Restaurant_API.postman_collection.json
```

---

## 📁 Cấu trúc Project

```
restaurant-system/
├── server.js                  # Entry point
├── app.js                     # Express config
├── restaurant.db              # SQLite database (auto-created)
├── test-flow.js               # E2E test script
├── Restaurant_API.postman_collection.json
└── src/
    ├── database/
    │   └── db.js              # DB init, helpers, transaction
    ├── models/
    │   ├── Order.js           # Order + OrderItem logic
    │   └── Invoice.js         # Invoice + InvoiceItem logic
    ├── controllers/
    │   ├── orderController.js
    │   └── invoiceController.js
    ├── routes/
    │   ├── orderRoutes.js
    │   └── invoiceRoutes.js
    ├── middleware/
    │   └── errorHandler.js    # 404 + 500 handler
    └── utils/
        └── response.js        # Standard response format
```
