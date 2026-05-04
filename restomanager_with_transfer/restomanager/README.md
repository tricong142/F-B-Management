# RestoManager – Hệ thống Đặt món & Quản lý Nhà hàng

Một ứng dụng web hoàn chỉnh gồm hai vai trò chính:

* **POS** (`pos.html`) – dành cho **nhân viên phục vụ** (gọi món, thêm món vào bàn) và **thu ngân** (xem đơn, lập hoá đơn, thanh toán).
* **Admin** (`admin.html`) – dành cho **quản trị viên**: dashboard, nhân viên, thực đơn, bàn, hoá đơn, nhật ký hệ thống.

Stack:

* **Backend**: Node.js 20 + Express 4 + PostgreSQL 16 + MinIO (S3-compatible) + JWT
* **Frontend**: HTML + Tailwind (CDN) + Vanilla JS, phục vụ qua **Nginx**
* **Triển khai**: Docker Compose (5 services: `postgres`, `minio`, `minio-init`, `backend`, `frontend`)

---

## 🚀 Chạy nhanh

Yêu cầu: Docker Desktop (hoặc Docker Engine + Compose v2).

```bash
# 1) Vào thư mục dự án
cd restomanager

# 2) (tuỳ chọn) chỉnh sửa cấu hình
cp .env.example .env

# 3) Build & chạy toàn bộ stack
docker compose up -d --build

# 4) Theo dõi log
docker compose logs -f backend
```

Sau khi tất cả service đã sẵn sàng, mở trình duyệt:

| Dịch vụ                  | URL                              |
| ------------------------ | -------------------------------- |
| Trang POS / Đăng nhập    | http://localhost:8080/pos.html   |
| Trang Admin              | http://localhost:8080/admin.html |
| API REST                 | http://localhost:3000/api        |
| MinIO Console (S3 UI)    | http://localhost:9001            |
| MinIO API (object store) | http://localhost:9000            |

### Tài khoản mặc định (mật khẩu: `123`)

| Tên đăng nhập | Vai trò                |
| ------------- | ---------------------- |
| `admin`       | Quản trị viên          |
| `cashier`     | Thu ngân               |
| `waiter`      | Nhân viên phục vụ      |

> ⚠️ Hãy đổi mật khẩu các tài khoản trên ngay khi triển khai thật, và đặt `JWT_SECRET` mới trong `.env`.

---

## 📁 Cấu trúc thư mục

```
restomanager/
├── docker-compose.yml
├── .env / .env.example
├── README.md
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   ├── server.js / app.js
│   ├── migrations/                  # SQL khởi tạo (chạy tự động)
│   │   └── 001_init.sql
│   └── src/
│       ├── database/   (db.js, seed.js)
│       ├── storage/    (minio.js)
│       ├── middleware/ (auth.js)
│       ├── models/     (User, MenuItem, Table, Order, Invoice, Log)
│       ├── controllers/
│       └── routes/
├── frontend/
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── index.html      (router)
│   ├── pos.html        (POS – waiter / cashier)
│   ├── admin.html      (Admin)
│   └── js/api.js       (API client dùng chung)
└── mobile/             (Expo / React Native — xem mobile/README.md)
    ├── App.js
    ├── package.json
    ├── app.json
    └── src/
        ├── api.js
        ├── AuthContext.js
        ├── theme.js
        └── screens/    (Login, Tables, Menu, Detail, Payment, Orders, Profile, Settings)
```

App mobile (`mobile/`) gọi cùng REST API → đồng bộ thời gian thực với web. Xem `mobile/README.md` để chạy.

---

## 🔌 Tính năng chính

### Vai trò Nhân viên phục vụ (waiter)
* Sơ đồ bàn theo khu vực (`indoor`, `outdoor`, `vip`).
* Mở thực đơn, thêm món vào giỏ, ghi chú món.
* Tự nhận biết bàn đã có **đơn mở**: thêm món sẽ **append** vào đơn cũ thay vì tạo đơn mới.
* Gửi đơn xuống bếp (`status = sent`).

### Vai trò Thu ngân (cashier)
* Danh sách đơn đang chờ thanh toán theo bàn.
* Xem chi tiết đơn, áp dụng **VAT** (mặc định 8%, có thể đổi).
* Thanh toán bằng **Tiền mặt / Chuyển khoản (QR) / Thẻ**.
* Xem hoá đơn đã thanh toán trong ngày, bộ chỉ số nhanh.

### Vai trò Quản trị (admin)
* **Dashboard**: doanh thu hôm nay, số HĐ, TB/HĐ, bàn đang phục vụ; biểu đồ doanh thu theo giờ; món bán chạy; tỷ trọng phương thức thanh toán.
* **Nhân viên**: CRUD tài khoản (admin / cashier / waiter), kích hoạt / khoá.
* **Thực đơn**: CRUD món; **upload ảnh** lên MinIO (bucket `restaurant`, public-read).
* **Bàn**: CRUD bàn theo khu vực và sức chứa.
* **Hoá đơn**: tra cứu lịch sử.
* **Nhật ký hệ thống**: 200 hoạt động gần nhất.

---

## 🌐 REST API tóm tắt (prefix `/api`)

> 📘 Đặc tả đầy đủ (envelope, error code, phân trang, payload từng endpoint) ở **[docs/API.md](docs/API.md)**.

| Method + Path                               | Mô tả                                |
| ------------------------------------------- | ------------------------------------ |
| `POST /auth/login`                          | Đăng nhập, trả JWT                   |
| `GET  /auth/me`                             | Lấy thông tin user hiện tại          |
| `GET  /users` (admin)                       | Danh sách nhân viên                  |
| `POST/PUT/DELETE /users[...]` (admin)       | CRUD nhân viên                       |
| `GET  /menu/categories`                     | Danh mục                             |
| `GET  /menu`                                | Thực đơn                             |
| `POST/PUT /menu` (multipart, admin)         | Thêm/sửa món + upload ảnh            |
| `DELETE /menu/:id` (admin)                  | Xoá món                              |
| `GET/POST/PUT/DELETE /tables[...]`          | CRUD bàn                             |
| `GET  /orders?status=open`                  | Danh sách đơn                        |
| `GET  /orders/by-table/:tableId`            | Đơn đang mở của 1 bàn                |
| `POST /orders`                              | Tạo đơn mới                          |
| `POST /orders/:id/items`                    | Thêm món vào đơn                     |
| `POST /orders/:id/checkout`                 | Lập hoá đơn & thanh toán             |
| `GET  /invoices`                            | Lịch sử hoá đơn                      |
| `POST /files/upload` (multipart)            | Upload tệp lên MinIO                 |
| `GET  /stats/overview`                      | Tổng quan dashboard                  |
| `GET  /logs`                                | Nhật ký hoạt động                    |

Tất cả endpoint (trừ `/auth/login`) đều yêu cầu header:
```
Authorization: Bearer <token>
```

---

## 🛠️ Phát triển ngoài Docker (tuỳ chọn)

```bash
# Backend
cd backend
cp .env.example .env       # rồi chỉnh DB_HOST=localhost, MINIO_ENDPOINT=localhost ...
npm install
npm start                  # cổng 3000

# Frontend
# Cách đơn giản nhất là phục vụ thư mục frontend qua một static server:
cd ../frontend
npx serve -l 5173
# Mở http://localhost:5173/pos.html  – api client sẽ gọi http://localhost:3000/api
```

---

## 🧰 Lệnh hữu ích

```bash
docker compose up -d --build       # build + chạy
docker compose ps                  # trạng thái
docker compose logs -f backend     # log backend
docker compose down                # dừng (vẫn giữ dữ liệu)
docker compose down -v             # dừng + xoá volume (mất hết DB & ảnh)
docker compose restart backend     # khởi động lại 1 service
```

---

## ❓ Khắc phục sự cố

* **Backend không kết nối DB**: backend tự retry tối đa 30 × 2s; xem `docker compose logs backend`. Đảm bảo container `postgres` đã `healthy`.
* **Ảnh món không hiển thị**: kiểm tra `MINIO_PUBLIC_URL` trong `.env` (mặc định `http://localhost:9000`). Nếu deploy server khác, đặt URL công khai tới MinIO.
* **Đăng nhập admin thất bại**: chắc chắn user là `admin / 123`; có thể tạo lại bằng cách `docker compose down -v && docker compose up -d --build` (sẽ seed lại).
* **Port bị chiếm**: chỉnh các biến `*_PORT_HOST` trong `.env`.

---

## 📜 Giấy phép

Phát hành cho mục đích nội bộ / học tập. Chỉnh sửa và sử dụng tự do.
