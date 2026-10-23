# VNC HRMS

Một React SPA và một ASP.NET Core 8 Web API phân lớp, dùng chung SQL Server database **VNC_HRMS_Iteration1** và EF Core Code First.

## Phạm vi bản base

- Cấu trúc React: pages, components/ui, layouts, services, store, routes; Vite/TypeScript/Tailwind.
- Axios client, Zustand store, khung route guard và các UI dùng lại.
- Backend: Controller → Service → Repository → AppDbContext; một project, một tiến trình.
- Domain models, mapping và migration chung cho các module; UnitOfWork, xử lý lỗi và cấu hình JWT/6 role.
- Adapter SMTP/Cloudinary dùng chung, chưa có endpoint nghiệp vụ.

Bản này chỉ có trang khung và endpoint **GET /health**. Các module nghiệp vụ sử dụng cấu trúc lớp, hợp đồng dữ liệu và quy tắc phân quyền chung. Model/bảng tồn tại không có nghĩa nghiệp vụ đã triển khai. Chưa tạo admin hoặc cấp token trong bản base.

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

Script giữ dữ liệu đã có, sao lưu database đích trước DDL và không tạo tài khoản demo. Cấu hình riêng lưu trong User Secrets; không commit .local hoặc secret. Không cần SMTP/Cloudinary để chạy base; chỉ cấu hình khi sử dụng tích hợp đó.

- [Kiến trúc và quy ước](docs/ARCHITECTURE.md)
- [Database và migration](docs/MIGRATION.md)
- [Quyền dự kiến](docs/PERMISSIONS.md)
- [Database dùng chung](docs/DATABASE.md)
