# VNC HRMS

Ứng dụng quản lý nhân sự dùng **React SPA (Vite + TypeScript)** và **ASP.NET Core 8 Web API phân lớp**, SQL Server và EF Core Code First.

## Chạy hằng ngày

Terminal backend:

```powershell
cd backend
dotnet run
```

Swagger: **http://localhost:5100/swagger** — một API cho toàn bộ module.

Terminal frontend:

```powershell
cd frontend
npm run dev
```

Ứng dụng: **http://localhost:5173** — mọi màn hình dùng chung địa chỉ này. Dừng bằng **Ctrl+C** trong terminal tương ứng trước khi chạy lại.

## Thành viên mới thiết lập lần đầu

Cần .NET SDK 8, Node.js 20.19+ hoặc 22.12+, SQL Server và EF CLI 8. Chạy từ thư mục gốc repository:

```powershell
dotnet tool restore
powershell -ExecutionPolicy Bypass -File backend/scripts/Initialize-Local.ps1
cd frontend
npm ci
```

Script tạo/cập nhật database `VNC_HRMS_Iteration1`, lưu JWT/connection string vào User Secrets và tạo admin nếu chưa có. Thông tin admin riêng của máy nằm trong `backend/.local/admin-credentials.txt`, được Git bỏ qua. Có thể truyền `-ConnectionString` cho script nếu SQL Server không ở `localhost`.

Gửi OTP qua Gmail cần thiết lập SMTP một lần trên từng máy chạy backend:

```powershell
powershell -NoProfile -STA -ExecutionPolicy Bypass -File backend/scripts/Configure-Email.ps1
```

Nhập Gmail gửi và mật khẩu ứng dụng trong cửa sổ riêng. Email nhận OTP phải khớp tài khoản HRMS đang hoạt động. Cấu hình email gửi mặc định không thay đổi email admin.

## Tài liệu

- [Kiến trúc, quy ước đặt tên và cách thêm module](docs/ARCHITECTURE.md)
- [Backend](backend/README.md)
- [Frontend](frontend/README.md)

Database và các migration đã có được giữ nguyên khi chuyển từ các service cũ sang một Web API. Không cần xóa database hoặc chạy scaffold ngược.
