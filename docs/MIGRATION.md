# Database và migration

Một `AppDbContext`, một chuỗi migration trong `backend/Persistence/Migrations`, database mặc định **VNC_HRMS_Iteration1**. `InitialApplication` tạo các schema `iam`, `hr`, `attendance`, `payroll`, `compliance`, `notification` trong database chung.

## Máy mới

Từ thư mục gốc repository, khi SQL Server đang chạy:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File backend/scripts/Initialize-Local.ps1
```

Không cần scaffold hoặc tự tạo bảng. Script dùng EF Core để tạo/cập nhật schema. Bản base chưa tạo admin hoặc cung cấp API đăng nhập. Sau đó vào `backend` chạy `dotnet run`.

## Chuyển từ bản microservice

1. Dừng backend cũ bằng Ctrl+C. Không ghi dữ liệu nguồn trong lúc chuyển; có thể lưu thêm backup database nguồn bằng SSMS.
2. Pull code mới, chạy script khởi tạo trên. Script sao lưu database đích đã tồn tại bằng `COPY_ONLY, CHECKSUM` vào thư mục backup mặc định của SQL Server, in đường dẫn ra terminal. Nếu backup thất bại, dừng trước khi sửa schema.
3. Áp dụng migration chung. Khi `iam.users` đích trống và IAM nguồn có dữ liệu, importer ưu tiên `VNC_IAM_DB`, `VNC_HR_DB`, `VNC_Attendance_DB`, `VNC_Payroll_DB`, `VNC_Compliance_DB`, `VNC_Notification_DB`. Sao chép bảng nghiệp vụ trong một transaction, giữ ID, password hash, role và liên kết hồ sơ.
4. Nếu không có dữ liệu microservice, tìm bản cũ trong schema `users`, `auth`, `employees`, `organization` của `VNC_HRMS_Iteration1`. Ánh xạ role cũ `hr` thành `hr_manager`. Nếu chưa có dữ liệu cũ thì giữ database trống để các module triển khai.
5. Chạy `dotnet run`, kiểm tra Swagger và `/health`. Kiểm tra dữ liệu bằng SSMS; API xác thực và nghiệp vụ sẽ được thêm sau. Refresh token/OTP cũ không được chuyển.

Database nguồn và các bảng schema cũ giữ nguyên. Runtime chỉ đọc schema mới. Trên máy từng chạy bản cũ, SSMS có thể hiển thị thêm các bảng cũ; không xóa trước khi đối chiếu và sao lưu.

Khởi tạo lại khi `iam.users` đã có dữ liệu sẽ bỏ qua import, giữ nguyên tài khoản. Import thủ công bằng `scripts/Import-ExistingData.ps1` đòi toàn bộ bảng nghiệp vụ đích trống và kiểm tra số dòng, hash mật khẩu, liên kết, constraint trước commit. Lỗi rollback toàn bộ import; schema đã áp dụng vẫn giữ để sửa nguồn rồi chạy lại. Không hòa trộn hai bộ tài khoản khác nhau.

Tham số khởi tạo: `-ConnectionString` đổi đích; `-DatabasePrefix` đổi tiền tố nguồn (mặc định `VNC`); `-LegacySourceDatabase` đổi tên database bản cũ. Nguồn và đích phải ở cùng SQL Server instance.

User Secrets ID giữ nguyên nên SMTP/JWT/Cloudinary trên máy tiếp tục được đọc. Runtime chỉ đọc `ConnectionStrings:DefaultConnection`. `.local/application-secrets.json` giữ metadata khởi tạo riêng; các lần sau ưu tiên file này. Mật khẩu hiện tại trong database không bị reset về metadata.

## Thay đổi model về sau

```powershell
cd backend
dotnet tool restore
dotnet ef migrations add TenThayDoi --output-dir Persistence/Migrations
dotnet ef database update
```

Commit entity/mapping, migration và `AppDbContextModelSnapshot.cs` cùng nhau. Thành viên pull code chỉ chạy `dotnet ef database update`, hoặc script `powershell -ExecutionPolicy Bypass -File scripts/Update-Database.ps1`.

Không sửa/xóa migration đã chia sẻ và áp dụng để đổi schema. Tạo migration mới, kiểm tra SQL nếu thay đổi/xóa cột có dữ liệu. Khi cần khôi phục, dùng backup và phiên bản code phù hợp; không xóa database để xử lý lỗi thông thường.
