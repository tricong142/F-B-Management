@echo off
chcp 65001 >nul
echo ==============================================================
echo 🚀 HỆ THỐNG QUẢN LÝ NHÀ HÀNG - AUTO RUN SCRIPT
echo ==============================================================
echo.

:: Bước 1: Cấu hình .env
if not exist ".env" (
    echo [BƯỚC 1] Khởi tạo file .env...
    copy .env.example .env >nul
    set /p dbpass="Nhập mật khẩu PostgreSQL của bạn (vd: 123456): "
    
    :: Cập nhật password vào file .env
    powershell -Command "(Get-Content .env) -replace 'your_password_here', '%dbpass%' | Set-Content .env"
    echo ✅ Đã lưu mật khẩu vào .env!
) else (
    echo ✅ File .env đã tồn tại. Bỏ qua bước tạo .env.
)
echo.

:: Bước 2: Test database luồng nghiệp vụ
echo [BƯỚC 2] Đang chạy luồng nghiệp vụ test database (test-flow.js)...
node test-flow.js
if %ERRORLEVEL% neq 0 (
    echo ❌ Test-flow gặp lỗi. Vui lòng kiểm tra lại mật khẩu PostgreSQL trong file .env hoặc chắc chắn service PostgreSQL đang chạy.
    pause
    exit /b %ERRORLEVEL%
)
echo.

:: Bước 3: Khởi động Server API
echo [BƯỚC 3] Đang khởi động Server API (server.js)...
node server.js

pause
