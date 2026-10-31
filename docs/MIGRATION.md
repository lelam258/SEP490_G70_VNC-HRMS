# Database và migration

Ứng dụng dùng một `AppDbContext`, một database **VNC_HRMS_Iteration1**, EF Core 8 Code First. Các bảng đang sử dụng nằm trong schema `dbo` theo thiết kế 2.0.

## Cập nhật database đã có

Dừng backend bằng Ctrl+C trước khi cập nhật. Từ thư mục gốc repository:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File backend/scripts/Initialize-Local.ps1
```

Script sao lưu database đã tồn tại bằng `COPY_ONLY, CHECKSUM` trước khi chạy migration. Nếu sao lưu thất bại, script dừng. Không đổi mật khẩu tài khoản đã có, không tự nhập lại dữ liệu từ những database microservice cũ. SMTP/JWT/Cloudinary vẫn đọc cấu hình riêng trên từng máy qua User Secrets.

`InitialApplication` được giữ nguyên vì đã chia sẻ. `AlignSchemaVersion2` chuyển các bảng sang `dbo`, sao chép hash mật khẩu và thông tin khóa đăng nhập từ `iam.credentials` vào `dbo.users`, chuyển liên kết nhân viên sang `dbo.staff.user_id`, rồi mới bỏ bảng/cột cũ. ID, vai trò, mật khẩu và dữ liệu nghiệp vụ được giữ. Khóa ngoại được bổ sung theo bản 2.0; dữ liệu liên kết sai làm migration thất bại và rollback thay vì tự xóa hoặc đoán liên kết.

Các bảng nguồn lịch sử trong schema `auth`, `employees`, `organization`, `users` có thể còn trên máy đã chạy bản cũ. Chúng không được runtime đọc và không bị migration này xóa. Trong SSMS, xem **dbo.users**, **dbo.staff** và các bảng `dbo` để đối chiếu dữ liệu đang dùng. Importer cũ dành cho microservice đã được bỏ.

## Máy mới

Chạy cùng lệnh khởi tạo ở trên. EF áp dụng toàn bộ chuỗi migration; không cần scaffold hoặc chạy script SQL bằng tay. Script tạo admin ban đầu khi chưa có admin được cấp tài khoản. Thông tin riêng nằm trong `backend/.local/admin-credentials.txt`, không đưa lên Git.

Sau khi khởi tạo:

```powershell
cd backend
dotnet run
```

Swagger: http://localhost:5100/swagger.

## Phần bổ sung trên thiết kế 2.0

`backend/Database/Reference/LatestSchema.sql` giữ nguyên bản SQL 2.0 của nhóm để đối chiếu. **Migration và model EF là cấu trúc thực tế của ứng dụng**; không chạy file tham chiếu này vào database đã được EF quản lý.

- Giữ 36 bảng nghiệp vụ của bản 2.0, bổ sung `dbo.password_reset_tokens` để lưu hash OTP, hạn dùng, số lần nhập và trạng thái sử dụng. Tổng cộng **37 bảng ứng dụng**, chưa tính `__EFMigrationsHistory` và các bảng nguồn lịch sử.
- `dbo.users` bổ sung `normalized_username`, `email`, `is_provisioned`, `security_version`, `version`; `dbo.refresh_tokens` giữ `account_version`. Các trường này phục vụ đăng nhập bằng email, admin chưa có hồ sơ nhân viên, tài khoản chưa được cấp quyền, thu hồi phiên và cập nhật đồng thời.
- Mật khẩu, số lần đăng nhập sai, thời gian khóa và lần đăng nhập gần nhất nằm trực tiếp trong `dbo.users`; không còn bảng `credentials` trong cấu trúc runtime.
- Liên kết duy nhất là `dbo.staff.user_id NOT NULL`, có khóa ngoại tới `dbo.users`. `employeeId` trong DTO được suy ra từ quan hệ này; không còn cột `users.employee_id`.
- Tạo hồ sơ nhân viên sẽ tạo kèm một tài khoản dự trữ chưa được cấp quyền, trạng thái `inactive`, trong cùng transaction. Tài khoản này không đăng nhập được và không xuất hiện trong danh sách tài khoản đã cấp. Quản trị viên cấp tài khoản sẽ kích hoạt chính tài khoản đó; hệ thống không hỗ trợ tự đăng ký. Admin/HR Manager có thể được cấp trước khi có hồ sơ.
- Hồ sơ cũ chưa liên kết được migration tạo tài khoản dự trữ tương ứng. Nếu email hoặc liên kết xung đột với tài khoản đang có, cần đối chiếu và sửa rõ ràng trước khi chạy lại migration.
- Giữ UTC (`SYSUTCDATETIME()`/`DateTime.UtcNow`), filtered unique index cho các cột tùy chọn, check constraint hiện có và các cột bắt buộc phục vụ ứng dụng. Vì vậy bản chạy thực tế có một số ràng buộc chặt hơn SQL tham chiếu.

## Thay đổi model về sau

```powershell
cd backend
dotnet tool restore
dotnet ef migrations add TenThayDoi --output-dir Persistence/Migrations
dotnet ef database update
```

Sao lưu trước các thay đổi dữ liệu. Commit entity/mapping, migration và `AppDbContextModelSnapshot.cs` cùng nhau. Thành viên pull code chỉ áp dụng migration đã có; không tạo lại migration cho cùng thay đổi. Không sửa/xóa migration đã dùng chung. Khi cần khôi phục, dùng backup và phiên bản code tương ứng.
