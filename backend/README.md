# Backend

Một ASP.NET Core 8 Web API phân lớp: Controllers → Services → Repositories → AppDbContext → SQL Server. Các module cùng dùng một database **VNC_HRMS_Iteration1**, schema `dbo` theo thiết kế 2.0.

## Chạy ứng dụng

Tại thư mục `backend`, với SQL Server đang chạy:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/Initialize-Local.ps1
dotnet run
```

Swagger: http://localhost:5100/swagger. Những lần chạy sau chỉ cần `dotnet run`; chạy lại script khởi tạo khi cần áp dụng migration mới. Script sao lưu trước khi cập nhật database đã tồn tại và giữ nguyên mật khẩu hiện có. Admin ban đầu được tạo nếu chưa có; thông tin riêng lưu tại `.local/admin-credentials.txt`.

Đổi kết nối SQL bằng tham số `-ConnectionString`. Mặc định là localhost, Windows Authentication. JWT, SMTP và Cloudinary cấu hình trong User Secrets hoặc biến môi trường; không ghi secret vào Git. Người nhận OTP là email của tài khoản yêu cầu đặt lại mật khẩu.

## Database 2.0

36 bảng nghiệp vụ dùng `dbo`; thêm bảng OTP nên có 37 bảng ứng dụng. Mật khẩu nằm trong `dbo.users`, mỗi `dbo.staff` liên kết một tài khoản qua `user_id NOT NULL`. Tài khoản dự trữ được tạo cùng hồ sơ nhân viên, chưa được phép đăng nhập cho tới khi được quản trị viên cấp tài khoản. Hệ thống không hỗ trợ tự đăng ký.

Giữ các cột kỹ thuật phục vụ email đăng nhập, phân quyền, bảo vệ phiên và cập nhật đồng thời. Chi tiết chuyển dữ liệu, khác biệt với SQL tham chiếu và cách làm việc nhóm nằm trong [MIGRATION.md](../docs/MIGRATION.md).

## Thêm module

Thêm DTO, repository/interface, service/interface và controller; đăng ký DI tại `Configurations/DependencyInjection.cs`. Controller không truy vấn SQL trực tiếp. Dùng chung `AppDbContext` và `UnitOfWork` scoped, áp dụng role policy đúng nghiệp vụ.

```powershell
dotnet ef migrations add TenThayDoi --output-dir Persistence/Migrations
dotnet ef database update
dotnet build VNC.HRMS.sln -c Release
```

Sao lưu trước khi sửa database. Không đưa `.local`, `bin`, `obj`, mật khẩu hoặc khóa API lên Git. Không sửa migration đã chia sẻ.
