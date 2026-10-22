# Database và chuyển dữ liệu cũ

Mã nguồn mới không sửa/xóa database `VNC_HRMS_Iteration1`. Sáu database mới có migration độc lập. Bản SQL người dùng cung cấp được lưu nguyên văn tại `backend/Database/Reference/LatestSchema.sql`; mapping EF và migration là nguồn schema triển khai thực tế.

## Khởi tạo không lấy dữ liệu cũ

```powershell
powershell -ExecutionPolicy Bypass -File backend/scripts/Initialize-Local.ps1
```

Script tạo/cập nhật sáu database, thiết lập development secrets và tạo admin nếu chưa có. Thông tin admin nằm ở `backend/.local/microservices-admin.txt`. Những database mới đã có admin sẽ không phù hợp với script import yêu cầu đích trống; không tự xóa dữ liệu để import.

## Chuyển từ monolith hiện tại

Đây là chuyển đổi offline trên cùng SQL Server instance. Backup database nguồn và dừng các tiến trình ghi vào nguồn để có dữ liệu nhất quán trước khi thực hiện.

1. Chuẩn bị database đích trống, không bootstrap admin:

   ```powershell
   powershell -ExecutionPolicy Bypass -File backend/scripts/Initialize-Local.ps1 -SkipBootstrap
   ```

2. Chuyển bảng tài khoản và nhân sự:

   ```powershell
   powershell -ExecutionPolicy Bypass -File backend/scripts/Import-LegacyData.ps1
   ```

   Có thể truyền `-Server`, `-SourceDatabase`, `-DatabasePrefix`. Tài khoản Windows chạy script cần đọc nguồn, ghi các database đích. Các script này không hỗ trợ trực tiếp SQL Authentication; dùng connection string và công cụ quản trị phù hợp cho môi trường đó.

3. Khởi động hệ thống mới:

   ```powershell
   cd backend
   dotnet run
   ```

4. Đăng nhập bằng tài khoản cũ, kiểm tra số nhân viên/khoa phòng và chức năng phân quyền. Người dùng phải đăng nhập lại vì refresh token và OTP cũ không được chuyển. Nếu cần quay lại, dừng hệ thống mới và dùng lại bản monolith/database nguồn đã giữ nguyên; dữ liệu phát sinh mới cần đối soát trước khi quay lại.

Script import dùng transaction cho đợt sao chép offline; yêu cầu cả bảy bảng đích còn trống, bỏ qua rowversion để SQL Server sinh lại, kiểm tra số dòng, xử lý vòng liên kết trưởng khoa/nhân viên và kiểm tra liên kết tài khoản-nhân viên. Gặp lỗi thì rollback toàn bộ đợt import. Nguồn chỉ được đọc. Không ghi đè hoặc upsert vào dữ liệu đích đã có.

Các bảng được chuyển:

| Nguồn | Đích |
| --- | --- |
| users.users | VNC_IAM_DB.iam.users |
| auth.credentials | VNC_IAM_DB.iam.credentials |
| organization.positions / departments | VNC_HR_DB.hr.positions / departments |
| employees.staff / contracts / degrees | VNC_HR_DB.hr.staff / contracts / degrees |

Đây là importer cho **schema monolith trong repository**, không phải importer tự động cho mọi database từng được tạo từ SQL tham chiếu. Các domain Attendance/Payroll/Compliance/Notification chưa có dữ liệu trong backend cũ, nên được tạo trống.

## SQL script độc lập

`backend/Database/<Service>/Schema.sql` là script EF idempotent, có `__EFMigrationsHistory`, dùng trên một database đích đã được tạo và chọn sẵn. Không cần chạy script nếu đã dùng EF/Initialize-Local. Không chạy đồng thời hai bộ công cụ migration trên cùng database.

Xuất lại sau khi sửa model và tạo migration, ví dụ:

```powershell
cd backend
dotnet ef migrations script --idempotent --project Services/HR/VNC.HRMS.HR.API --startup-project Services/HR/VNC.HRMS.HR.API --output Database/HR/Schema.sql
```

## Docker

`Initialize-Docker.ps1` dùng các database trong SQL Server container riêng, không tự lấy dữ liệu SQL Server Windows. Compose dùng `sa` để thuận tiện thiết lập môi trường phát triển; khi triển khai cần provision user riêng và quyền giới hạn theo database. Không xóa volume để cập nhật schema; chạy migration từng service.
