# VNC HRMS

Một React SPA và một ASP.NET Core 8 Web API phân lớp, dùng chung SQL Server database **VNC_HRMS_Iteration1** và EF Core Code First.

## Cấu trúc và chức năng

- Cấu trúc React: pages, components/ui, layouts, services, store, routes; Vite/TypeScript/Tailwind.
- Axios client, Zustand store, khung route guard và các UI dùng lại.
- Backend: Controller → Service → Repository → AppDbContext; một project, một tiến trình.
- Domain models, mapping và migration chung cho các module; UnitOfWork, xử lý lỗi và cấu hình JWT/6 role.
- Adapter SMTP gửi OTP và Cloudinary upload tệp.

Đã có xác thực và quản lý phiên, đổi/quên mật khẩu, quản lý tài khoản, khoa/phòng và nhân viên. Tài khoản do quản trị viên cấp; hệ thống không hỗ trợ tự đăng ký. Các API đọc dữ liệu chấm công, lương, tuân thủ và thông báo dùng chung cấu trúc lớp và phân quyền; model/bảng tồn tại không có nghĩa toàn bộ nghiệp vụ đã triển khai. Database theo thiết kế 2.0, dùng `dbo`, bổ sung bảng OTP và các cột bảo vệ tài khoản. Xem tài liệu migration trước khi cập nhật database đã có.

## Khởi tạo

Cần .NET SDK 8, Node.js 20+ và SQL Server với Windows Authentication/quyền tạo, cập nhật và sao lưu database.

Từ thư mục gốc repository:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File backend/scripts/Initialize-Local.ps1
cd backend
dotnet run
```

Terminal khác:

```powershell
cd frontend
npm ci
npm run dev
```

Frontend: http://localhost:5173. Swagger: http://localhost:5100/swagger. Health: http://localhost:5100/health. Ctrl+C dừng ứng dụng.

Script giữ dữ liệu đã có, sao lưu database đích trước DDL và tạo admin ban đầu khi chưa có. Cấu hình riêng lưu trong User Secrets; không commit .local hoặc secret. SMTP/Cloudinary chỉ cần cấu hình khi sử dụng gửi OTP hoặc upload.

- [Kiến trúc và quy ước](docs/ARCHITECTURE.md)
- [Database và migration](docs/MIGRATION.md)
- [Quyền dự kiến](docs/PERMISSIONS.md)
- [Database dùng chung](docs/DATABASE.md)
