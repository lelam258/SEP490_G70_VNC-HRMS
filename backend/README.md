# Backend

Mở **VNC.HRMS.sln** bằng Visual Studio 2022. Solution gồm 6 service ASP.NET Core 8, Gateway và BuildingBlocks; mỗi service có DbContext, entity và migration riêng.

```text
backend/
  Gateway/VNC.HRMS.Gateway/
  Services/
    IAM/VNC.HRMS.IAM.API/
    HR/VNC.HRMS.HR.API/
    Attendance/VNC.HRMS.Attendance.API/
    Payroll/VNC.HRMS.Payroll.API/
    Compliance/VNC.HRMS.Compliance.API/
    Notification/VNC.HRMS.Notification.API/
  BuildingBlocks/VNC.HRMS.BuildingBlocks/
  Database/{IAM,HR,Attendance,Payroll,Compliance,Notification}/
  Database/Reference/LatestSchema.sql
  Legacy/                    # Source/migration cũ, ngoài solution
  scripts/
  VNC.HRMS.sln
```

## Chạy

Từ thư mục gốc repository:

```powershell
powershell -ExecutionPolicy Bypass -File backend/scripts/Initialize-Local.ps1
cd backend
dotnet run
```

Để debug riêng một service:

```powershell
cd backend/Services/IAM/VNC.HRMS.IAM.API
dotnet run
```

Hằng ngày, chạy `dotnet run` tại `backend` để tự build solution và khởi động Gateway cùng 6 API. Log có nhãn tên service ngay trong terminal; Ctrl+C dừng toàn bộ. Swagger tự mở ở `http://localhost:5100/swagger`, có danh sách chọn tài liệu của cả 6 service; thao tác Try it out đi qua Gateway. Launcher `VNC.HRMS.Local.csproj` chỉ điều phối tiến trình local, nằm ngoài solution để không build đè lên chính launcher đang chạy. Có thể bỏ bước build service bằng `dotnet run -- --no-build` sau khi đã build bản Release, thêm `--no-browser` để không mở trình duyệt.

IAM cần HR đang chạy cho thao tác tạo tài khoản theo nhân viên/đăng ký. HR và các service nghiệp vụ cần IAM để kiểm tra phiên của request có xác thực. Gateway giữ các URL frontend hiện có. Script `Start-Local.ps1` vẫn là cách chạy thay thế.

## Cấu hình

Mỗi API đọc `ConnectionStrings:<TênService>`. Không dùng lại `DefaultConnection` của monolith. Sáu project dùng cùng User Secrets ID `vnc-hrms-auth-development` trên máy phát triển để giữ SMTP/Cloudinary đã cấu hình; mỗi service chỉ đăng ký các adapter cần dùng.

- `Jwt:Issuer`, `Jwt:Audience`, `Jwt:SigningKey`: thống nhất giữa các service.
- `InternalApi:Key`: khóa ít nhất 32 ký tự cho API nội bộ, khác khóa JWT.
- `Services:IAM`, `Services:HR`: địa chỉ gọi trực tiếp, không qua Gateway.
- `Cors:Origins`: danh sách frontend được phép truy cập; thêm origin triển khai vào Gateway và IAM khi chạy ngoài localhost.
- `ForwardedHeaders:KnownProxies`: địa chỉ Gateway đáng tin cậy ngoài loopback; không tin toàn bộ mạng công cộng.

Production dùng biến môi trường, ví dụ `ConnectionStrings__IAM`, `Jwt__SigningKey`, `InternalApi__Key`. Cấu hình production cần connection string và tài khoản SQL riêng cho từng service, chỉ có quyền trên database của service đó. Compose là môi trường phát triển; tài khoản `sa` ở Compose dùng cho bootstrap tiện lợi.

Thiết lập SMTP trên Windows vẫn dùng:

```powershell
powershell -NoProfile -STA -ExecutionPolicy Bypass -File backend/scripts/Configure-Email.ps1
```

SMTP gửi OTP thuộc IAM; Cloudinary và `/api/files` thuộc HR. Không commit User Secrets, `.local`, `.env` hay khóa tích hợp.

## Migration

```powershell
cd backend
dotnet ef migrations add AddField --project Services/HR/VNC.HRMS.HR.API --startup-project Services/HR/VNC.HRMS.HR.API --output-dir Persistence/Migrations
powershell -ExecutionPolicy Bypass -File scripts/Update-Database.ps1
```

`Update-Database.ps1` mặc định nhắm database tên `VNC_<Service>_DB` trên localhost và dùng Windows Authentication. Đặt `-Server`, `-DatabasePrefix` nếu cần. Khi dùng SQL Authentication hoặc cấu hình khác, chạy EF CLI với `--connection` riêng cho service, hoặc dùng chế độ `--MigrateOnly=true` và biến môi trường.

SQL trong `Database/<Service>/Schema.sql` được xuất từ migration và dùng bên trong database đã chọn, có lịch sử EF. Không chạy bản tham chiếu `Database/Reference/LatestSchema.sql` chồng lên database đã có migration.

`/health` kiểm tra tiến trình; `/health/ready` kiểm tra kết nối database. Swagger chỉ bật ở Development. `/internal/*` yêu cầu khóa nội bộ và không có route qua Gateway.

Xem [kiến trúc](../docs/ARCHITECTURE.md) và [chuyển dữ liệu](../docs/MIGRATION.md).
