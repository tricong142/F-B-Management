# RestoManager – Hệ thống Đặt món & Quản lý Nhà hàng

Ứng dụng web + mobile hoàn chỉnh phục vụ quy trình vận hành nhà hàng, gồm ba vai trò chính:

* **Waiter** (Nhân viên phục vụ) – xem sơ đồ bàn, gọi món, gửi đơn xuống bếp.
* **Cashier** (Thu ngân) – xem đơn, chỉnh sửa món, lập hoá đơn, thanh toán, in receipt.
* **Admin** (Quản trị) – dashboard doanh thu, CRUD nhân viên / thực đơn / bàn / hoá đơn, nhật ký hệ thống.

---

## 🛠️ Technology Stack

| Tầng              | Công nghệ                                                          |
| ----------------- | ------------------------------------------------------------------ |
| **Backend**        | Node.js 20 · Express 4 · PostgreSQL 16 · MinIO (S3-compatible) · JWT |
| **Frontend (Web)** | HTML · Tailwind CSS (CDN) · Vanilla JS (modular) · Nginx           |
| **Frontend (Mobile)** | Expo SDK 54 · React Native · React Navigation                  |
| **Triển khai**     | Docker Compose (5 services)                                        |

---

## 🚀 Chạy nhanh

**Yêu cầu:** Docker Desktop (hoặc Docker Engine + Compose v2).

```bash
# 1) Vào thư mục dự án
cd restomanager

# 2) (tuỳ chọn) chỉnh sửa cấu hình
cp .env.example .env          # sửa biến nếu cần

# 3) Build & khởi chạy toàn bộ stack
docker compose up -d --build

# 4) Theo dõi log backend
docker compose logs -f backend
```

Sau khi tất cả service sẵn sàng, mở trình duyệt:

| Dịch vụ                  | URL                              |
| ------------------------ | -------------------------------- |
| Trang POS / Đăng nhập    | http://localhost:8080/pos.html   |
| Trang Admin              | http://localhost:8080/admin.html |
| API REST                 | http://localhost:3000/api        |
| API Health Check          | http://localhost:3000/api/health |
| MinIO Console (S3 UI)    | http://localhost:9001            |
| MinIO API (object store) | http://localhost:9000            |

### Tài khoản mặc định (mật khẩu: `123`)

| Tên đăng nhập | Vai trò                |
| ------------- | ---------------------- |
| `admin`       | Quản trị viên          |
| `cashier`     | Thu ngân               |
| `waiter`      | Nhân viên phục vụ      |



---

## 📁 Cấu trúc thư mục

```
restomanager/
├── docker-compose.yml          # Orchestrate 5 services
├── .env / .env.example         # Biến môi trường (DB, JWT, MinIO, ports)
├── README.md
│
├── backend/                    # ─── REST API Server ───
│   ├── Dockerfile
│   ├── package.json            # Express + pg + minio + jwt + multer
│   ├── app.js                  # Express app (routes, middleware, CORS)
│   ├── server.js               # Entry point (init DB → init MinIO → seed → listen)
│   ├── migrations/
│   │   ├── 001_init.sql        # Schema gốc (users, menu_items, tables, orders, invoices, logs)
│   │   ├── 002_dedupe_menu.sql # Unique constraint cho menu
│   │   └── 003_invoice_payment_fields.sql  # Thêm trường paid/change cho invoice
│   └── src/
│       ├── database/
│       │   ├── db.js           # Pool PostgreSQL, auto-migrate, retry kết nối
│       │   └── seed.js         # Seed dữ liệu mẫu (3 user, bàn, menu)
│       ├── storage/
│       │   └── minio.js        # MinIO client, init bucket, upload helper
│       ├── middleware/
│       │   ├── auth.js         # JWT verify → req.user
│       │   ├── errorHandler.js # 404 + global error handler (envelope format)
│       │   └── validate.js     # Request validation (body, params, query)
│       ├── utils/
│       │   └── response.js     # Envelope helpers: ok(), created(), paginated(), fail()
│       ├── models/
│       │   ├── User.js         # CRUD users + bcrypt hash
│       │   ├── MenuItem.js     # CRUD menu_items + category
│       │   ├── Table.js        # CRUD tables + status tính toán
│       │   ├── Order.js        # CRUD orders + order_items + status flow
│       │   ├── Invoice.js      # Checkout → invoice + items snapshot
│       │   └── Log.js          # Activity log (200 gần nhất)
│       ├── controllers/
│       │   ├── authController.js
│       │   ├── userController.js
│       │   ├── menuController.js
│       │   ├── tableController.js
│       │   ├── orderController.js
│       │   ├── invoiceController.js
│       │   ├── fileController.js
│       │   ├── statController.js
│       │   └── logController.js
│       └── routes/
│           ├── authRoutes.js       # POST /login, GET /me, POST /logout
│           ├── userRoutes.js       # CRUD /users (admin only)
│           ├── menuRoutes.js       # CRUD /menu + GET /menu/categories
│           ├── tableRoutes.js      # CRUD /tables
│           ├── orderRoutes.js      # CRUD /orders + items + checkout
│           ├── invoiceRoutes.js    # GET /invoices
│           ├── fileRoutes.js       # POST /files/upload (multipart → MinIO)
│           ├── statRoutes.js       # GET /stats/overview, /stats/daily
│           └── logRoutes.js        # GET /logs
│
├── frontend/                   # ─── Web UI (static, served by Nginx) ───
│   ├── Dockerfile              # nginx:1.27-alpine + COPY static files
│   ├── nginx.conf              # Proxy /api/ → backend:3000, serve static
│   ├── index.html              # Router: redirect → pos.html hoặc admin.html
│   ├── pos.html                # POS UI (waiter + cashier), HTML template only
│   ├── admin.html              # Admin dashboard UI (monolithic)
│   ├── css/
│   │   └── pos.css             # POS custom styles (page system, bottom nav,
│   │                           #   toast, overlay, card, pills, chip, keypad...)
│   └── js/
│       ├── api.js              # API client dùng chung (IIFE → window.Api)
│       │                       #   ├── Token management (localStorage)
│       │                       #   ├── Request wrapper (envelope unwrap, auto-logout 401)
│       │                       #   └── Shortcut methods: Auth, Users, Menu, Tables,
│       │                       #       Orders, Invoices, Files, Stats, Logs
│       ├── pos-utils.js        # Shared helpers: fmt(), togglePwd(), toast(),
│       │                       #   showLogoutDlg(), closeDlg(), overlay outside-click
│       ├── pos-app.js          # App core: global state, data loaders (menu, tables,
│       │                       #   orders, invoices), page router goPage(), session resume
│       ├── pos-auth.js         # Login/Logout: doLogin(), doLogout(), Enter-key handlers
│       ├── pos-waiter.js       # Waiter module:
│       │                       #   ├── initWaiter(), renderWaiterTables(), waiterZone()
│       │                       #   ├── openWaiterMenu() – detect existing order
│       │                       #   ├── Menu: renderMenuList(), menuCat(), filterBySearch()
│       │                       #   ├── Cart: addToCart(), removeFromCart(), updateCartBar()
│       │                       #   ├── Confirm: renderConfirmList(), confirmAdd/Remove()
│       │                       #   ├── sendOrder() – create or append to existing order
│       │                       #   └── renderWaiterOrders() – đơn của waiter
│       ├── pos-cashier.js      # Cashier module:
│       │                       #   ├── initCashier(), refreshCashierTables(), cashierZone()
│       │                       #   ├── openCashierDetail() – chi tiết đơn + sửa món
│       │                       #   ├── cashierItemInc/Dec/Delete() – CRUD order items
│       │                       #   ├── cashierAddMore() – mở menu để thêm món
│       │                       #   └── renderCashierOrders() – danh sách đơn
│       ├── pos-payment.js      # Payment module:
│       │                       #   ├── goPayment() – tính sub/VAT/total
│       │                       #   ├── 6 phương thức TT (cash/transfer/card/vnpay/banking/momo)
│       │                       #   ├── Keypad số + quick amounts
│       │                       #   ├── confirmPayment() → Api.checkout()
│       │                       #   ├── showReceipt() – receipt modal
│       │                       #   └── printReceipt() – popup cửa sổ in
│       └── pos-stats.js        # Stats module: updateCashierStats() – KPI + top items
│
├── docs/
│   ├── API.md                  # Đặc tả REST API chi tiết (envelope, endpoints, payload)
│   └── server.js               # Entry point mẫu (legacy/reference)
│
└── mobile/                     # ─── Expo / React Native App ───
    ├── App.js                  # Stack + Tab navigation (Waiter/Cashier tabs)
    ├── package.json            # expo, react-native, react-navigation, ...
    ├── app.json                # Expo config (SDK 54)
    ├── babel.config.js
    └── src/
        ├── api.js              # REST client + AsyncStorage (token, server URL)
        ├── AuthContext.js      # Auth state toàn cục (React Context)
        ├── theme.js            # Bảng màu Material Design 3
        └── screens/
            ├── SettingsScreen.js   # Cấu hình URL server
            ├── LoginScreen.js      # Đăng nhập
            ├── TablesScreen.js     # Sơ đồ bàn (waiter & cashier)
            ├── MenuScreen.js       # Gọi món / thêm món vào đơn
            ├── DetailScreen.js     # Cashier xem & sửa đơn
            ├── PaymentScreen.js    # Thanh toán + receipt modal
            ├── OrdersScreen.js     # Đơn hàng (đang mở + đã TT)
            └── ProfileScreen.js    # KPI cá nhân + cài đặt + logout
```

---

##  Tính năng chính

### Vai trò Nhân viên phục vụ (Waiter)

* Sơ đồ bàn theo khu vực (`indoor`, `outdoor`, `vip`) – badge trạng thái Trống / Có khách / Chờ TT.
* Mở thực đơn, tìm kiếm món, lọc theo danh mục.
* Thêm món vào giỏ hàng với cộng/trừ số lượng.
* **Thông minh**: tự nhận biết bàn đã có đơn mở → **append** món vào đơn cũ thay vì tạo đơn mới.
* Xác nhận đơn → gửi xuống bếp (`status = sent`).
* Xem danh sách đơn hàng đã gửi.

### Vai trò Thu ngân (Cashier)

* Sơ đồ bàn với thông báo đơn mới (`Đơn mới: xxx đ`).
* Chi tiết đơn theo bàn – **sửa từng món**: tăng/giảm/xoá, thêm món mới.
* Thanh toán với **6 phương thức**: Tiền mặt · Chuyển khoản (QR) · Quẹt thẻ · VietQR Pro · Banking · MoMo.
* Bàn phím số + gợi ý nhanh (exact, +5K, +10K, +50K, +100K, +200K).
* VAT mặc định 8%, tự động tính tiền thừa.
* Receipt modal hiện hoá đơn + nút **In** (popup cửa sổ in).
* Xem tất cả đơn hàng trong ngày.
* Thống kê ca: doanh thu, số HĐ, trung bình/HĐ, doanh thu theo giờ, món bán chạy.

### Vai trò Quản trị (Admin)

* **Dashboard**: doanh thu hôm nay, số HĐ, TB/HĐ, bàn đang phục vụ; biểu đồ doanh thu theo giờ; món bán chạy; tỷ trọng phương thức thanh toán.
* **Nhân viên**: CRUD tài khoản (admin / cashier / waiter), kích hoạt / khoá.
* **Thực đơn**: CRUD món; **upload ảnh** lên MinIO (bucket `restaurant`, public-read).
* **Bàn**: CRUD bàn theo khu vực và sức chứa.
* **Hoá đơn**: tra cứu lịch sử.
* **Nhật ký hệ thống**: 200 hoạt động gần nhất.

### App Mobile (Expo)

* Giao diện Material Design 3 tối ưu cho điện thoại.
* **Waiter**: sơ đồ bàn → gọi món → gửi đơn (auto-detect đơn mở).
* **Cashier**: sơ đồ bàn → chi tiết đơn → sửa món → thanh toán → receipt.
* Pull-to-refresh, JWT auto-logout, cấu hình server URL linh hoạt.
* Xem `mobile/README.md` để chạy thử.

---

## 🏗️ Kiến trúc Frontend POS (Modular)

Trang `pos.html` đã được **tách thành các module JS riêng biệt** để dễ bảo trì:

```
pos.html                    ← HTML template (pages, overlays, bottom nav)
  ├── css/pos.css            ← Custom styles (page system, components)
  ├── js/api.js              ← API client (shared giữa POS & Admin)
  ├── js/pos-utils.js        ← Helpers: format tiền, toast, dialog
  ├── js/pos-app.js          ← Core: state, data loaders, router, session
  ├── js/pos-auth.js         ← Login / Logout
  ├── js/pos-waiter.js       ← Waiter: tables, menu, cart, send order
  ├── js/pos-cashier.js      ← Cashier: tables, detail, edit items
  ├── js/pos-payment.js      ← Payment: methods, keypad, receipt, print
  └── js/pos-stats.js        ← Stats: KPI, top items
```

**Thứ tự load** :

```html
<script src="js/api.js"></script>       <!-- 1. API client (window.Api) -->
<script src="js/pos-utils.js"></script> <!-- 2. Shared helpers -->
<script src="js/pos-app.js"></script>   <!-- 3. State + router + loaders -->
<script src="js/pos-auth.js"></script>  <!-- 4. Auth (dùng Api, goPage) -->
<script src="js/pos-waiter.js"></script><!-- 5. Waiter (dùng state, Api, goPage) -->
<script src="js/pos-cashier.js"></script><!-- 6. Cashier (dùng state, waiter funcs) -->
<script src="js/pos-payment.js"></script><!-- 7. Payment (dùng state, cashier) -->
<script src="js/pos-stats.js"></script> <!-- 8. Stats (dùng state, Api) -->
```

> 💡 Tất cả module dùng **global scope** (không phải ES modules) vì chạy trên browser thuần, không có bundler.

---

## 🌐 REST API tóm tắt (prefix `/api`)

> 📘 Đặc tả đầy đủ (envelope, error code, phân trang, payload từng endpoint) ở **[docs/API.md](docs/API.md)**.

### Envelope format

```json
// Thành công
{ "success": true, "data": { ... }, "message": "...", "meta": { "page": 1, "total": 50 } }

// Thất bại
{ "success": false, "message": "Lỗi XYZ", "error": { "code": "ERROR_CODE", "details": "..." } }
```

### Endpoints

| Method + Path                               | Mô tả                                | Auth |
| ------------------------------------------- | ------------------------------------ | ---- |
| `POST /auth/login`                          | Đăng nhập, trả JWT                   | ✗    |
| `GET  /auth/me`                             | Lấy thông tin user hiện tại          | ✓    |
| `POST /auth/logout`                         | Đăng xuất                            | ✓    |
| `GET  /users`                               | Danh sách nhân viên                  | admin |
| `POST /users`                               | Tạo nhân viên                        | admin |
| `PUT  /users/:id`                           | Cập nhật nhân viên                   | admin |
| `PUT  /users/:id/password`                  | Reset mật khẩu                       | admin |
| `DELETE /users/:id`                         | Xoá nhân viên                        | admin |
| `GET  /menu/categories`                     | Danh mục                             | ✓    |
| `GET  /menu`                                | Thực đơn (filter: active, category)  | ✓    |
| `GET  /menu/:id`                            | Chi tiết món                         | ✓    |
| `POST /menu` (multipart)                    | Thêm món + upload ảnh                | admin |
| `PUT  /menu/:id` (multipart)                | Sửa món + upload ảnh                 | admin |
| `DELETE /menu/:id`                          | Xoá món                              | admin |
| `GET  /tables`                              | Danh sách bàn (with_status)          | ✓    |
| `POST /tables`                              | Tạo bàn                              | admin |
| `PUT  /tables/:id`                          | Sửa bàn                              | admin |
| `DELETE /tables/:id`                        | Xoá bàn                              | admin |
| `GET  /orders`                              | Danh sách đơn (filter: status)       | ✓    |
| `GET  /orders/:id`                          | Chi tiết đơn                         | ✓    |
| `GET  /orders/by-table/:tableId`            | Đơn đang mở của 1 bàn               | ✓    |
| `POST /orders`                              | Tạo đơn mới                          | ✓    |
| `POST /orders/:id/items`                    | Thêm món vào đơn đang mở            | ✓    |
| `PUT  /orders/:id/items/:itemId`            | Sửa số lượng món                     | ✓    |
| `DELETE /orders/:id/items/:itemId`          | Xoá món khỏi đơn                    | ✓    |
| `PUT  /orders/:id/status`                   | Đổi trạng thái đơn                   | ✓    |
| `DELETE /orders/:id`                        | Huỷ đơn                              | ✓    |
| `POST /orders/:id/checkout`                 | Lập hoá đơn & thanh toán            | ✓    |
| `GET  /invoices`                            | Lịch sử hoá đơn (filter: from)      | ✓    |
| `GET  /invoices/:id`                        | Chi tiết hoá đơn                     | ✓    |
| `POST /files/upload` (multipart)            | Upload tệp lên MinIO                 | ✓    |
| `GET  /stats/overview`                      | Tổng quan dashboard                  | ✓    |
| `GET  /stats/daily`                         | Thống kê theo ngày                   | ✓    |
| `GET  /logs`                                | Nhật ký hoạt động                    | ✓    |

Tất cả endpoint (trừ `/auth/login`) yêu cầu header:

```
Authorization: Bearer <token>
```

---

## ⚙️ Biến môi trường (`.env`)

| Biến                | Mặc định                    | Mô tả                           |
| ------------------- | --------------------------- | -------------------------------- |
| `DB_NAME`           | `restaurant_db`             | Tên database PostgreSQL          |
| `DB_USER`           | `postgres`                  | User PostgreSQL                  |
| `DB_PASSWORD`       | `postgres`                  | Password PostgreSQL              |
| `DB_PORT_HOST`      | `5432`                      | Cổng PostgreSQL trên host        |
| `JWT_SECRET`        | `please-change-me-in-prod`  | Secret ký JWT (PHẢI đổi khi deploy) |
| `JWT_EXPIRES`       | `12h`                       | Thời hạn JWT                     |
| `MINIO_ACCESS_KEY`  | `minioadmin`                | MinIO access key                 |
| `MINIO_SECRET_KEY`  | `minioadmin`                | MinIO secret key                 |
| `MINIO_BUCKET`      | `restaurant`                | Tên bucket MinIO                 |
| `MINIO_PORT_HOST`   | `9000`                      | Cổng MinIO API trên host         |
| `MINIO_CONSOLE_PORT`| `9001`                      | Cổng MinIO Console trên host     |
| `MINIO_PUBLIC_URL`  | `http://localhost:9000`     | URL công khai tới MinIO (cho ảnh) |
| `BACKEND_PORT_HOST` | `3000`                      | Cổng backend trên host           |
| `FRONTEND_PORT_HOST`| `8080`                      | Cổng frontend (Nginx) trên host  |

---

## 🐳 Docker Compose Services

| Service       | Image                | Vai trò                                |
| ------------- | -------------------- | -------------------------------------- |
| `postgres`    | `postgres:16-alpine` | Database chính                         |
| `minio`       | `minio/minio:latest` | Object storage (ảnh món)               |
| `minio-init`  | `minio/mc:latest`    | Init bucket + set public policy        |
| `backend`     | Custom (Node.js)     | REST API server (port 3000)            |
| `frontend`    | Custom (Nginx)       | Serve static files + proxy /api/ → backend |

---

## 🛠️ Phát triển ngoài Docker (tuỳ chọn)

```bash
# Backend
cd backend
cp .env.example .env       # chỉnh DB_HOST=localhost, MINIO_ENDPOINT=localhost, ...
npm install
npm start                  # cổng 3000
# hoặc hot-reload:
npm run dev                # node --watch server.js

# Frontend
# Cách đơn giản nhất là phục vụ thư mục frontend qua static server:
cd ../frontend
npx serve -l 5173
# Mở http://localhost:5173/pos.html
```

> 💡 Khi chạy ngoài Docker, API client (`js/api.js`) mặc định gọi IP LAN. Nếu cần, sửa `API_BASE` trong `js/api.js` thành `http://localhost:3000/api`.

---

## 🧰 Lệnh

```bash
docker compose up -d --build       # Build + chạy toàn bộ
docker compose ps                  # Xem trạng thái services
docker compose logs -f backend     # Theo dõi log backend
docker compose logs -f postgres    # Theo dõi log database
docker compose down                # Dừng (giữ dữ liệu)
docker compose down -v             # Dừng + xoá volume (mất hết DB & ảnh)
docker compose restart backend     # Khởi động lại 1 service
docker compose exec postgres psql -U postgres -d restaurant_db  # Truy cập DB
```

---

## ❓ Khắc phục sự cố

| Vấn đề | Giải pháp |
| ------ | --------- |
| Backend không kết nối DB | Backend tự retry tối đa 30 × 2s. Xem `docker compose logs backend`. Đảm bảo container `postgres` đã `healthy`. |
| Ảnh món không hiển thị | Kiểm tra `MINIO_PUBLIC_URL` trong `.env` (mặc định `http://localhost:9000`). Nếu deploy server khác, đặt URL công khai tới MinIO. |
| Đăng nhập thất bại | User mặc định: `admin / 123`. Tạo lại bằng `docker compose down -v && docker compose up -d --build` (sẽ seed lại). |
| Port bị chiếm | Chỉnh các biến `*_PORT_HOST` trong `.env`. |
| CORS error khi dev local | Đảm bảo `API_BASE` trong `js/api.js` trỏ đúng IP:port của backend. |
| Mobile không kết nối | Kiểm tra IP-LAN (`ipconfig`), cùng Wi-Fi, firewall không chặn port 3000. Xem `mobile/README.md`. |
| Token hết hạn | Đăng nhập lại. Mặc định token sống 12h (đổi `JWT_EXPIRES` trong `.env`). |

---

#
