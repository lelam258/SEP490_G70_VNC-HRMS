# Backend

Một ASP.NET Core 8 Web API, chia module Auth, Users, Employees, Organization. Mã nguồn đi theo `Controllers → Services → Repositories → Persistence/AppDbContext`, DTO và Entity riêng. SMTP/Cloudinary nằm trong `Integrations`; JWT và xử lý lỗi nằm trong middleware/configuration.

```powershell
cd backend
dotnet run
```

Swagger **http://localhost:5100/swagger**. Mọi endpoint nằm chung `/api`; không còn phải chạy các cổng 5101–5104. `Program.cs` chỉ cấu hình ứng dụng, route nghiệp vụ nằm trong Controller.

| Controller | Route | Nội dung |
| --- | --- | --- |
| AuthController | `/api/auth` | Login, register, me, refresh, logout, đổi/quên/đặt lại mật khẩu |
| UsersController | `/api/users` | Danh sách, chi tiết, tạo, sửa tài khoản |
| EmployeesController | `/api/employees` | Danh sách, chi tiết, thêm nhân viên |
| DepartmentsController | `/api/departments` | Danh sách, chi tiết, thêm khoa/phòng |
| FilesController | `/api/files` | Upload JPG/PNG/PDF qua Cloudinary, admin, tối đa 10 MB |

Users, Employees, Departments và Files yêu cầu admin. Đổi mật khẩu và me yêu cầu đăng nhập. Dán accessToken trả về từ login vào **Authorize** trong Swagger để gọi các endpoint được bảo vệ.

## Thiết lập lần đầu

Chạy tại thư mục gốc repository:

```powershell
dotnet tool restore
powershell -ExecutionPolicy Bypass -File backend/scripts/Initialize-Local.ps1
```

Mặc định SQL Server `localhost`, Windows Authentication, database `VNC_HRMS_Iteration1`. Có thể truyền `-ConnectionString 'Server=...;Database=...;...'` qua script. User Secrets và `.local` chứa thông tin riêng của máy. Không đưa các thông tin này vào Git.

Máy đã thiết lập trước khi chuyển kiến trúc vẫn dùng bộ User Secrets `vnc-hrms-auth-development`, bao gồm SMTP. Database đã có không cần khởi tạo lại; admin hiện có được giữ khi chạy lại setup.

## Migration

`AppDbContext` dùng chung lúc chạy API. Các context trong `Persistence/Migrations` chỉ phục vụ bốn chuỗi migration cũ theo schema, để giữ dữ liệu và lịch sử đã áp dụng.

Chạy tại `backend` khi cần cập nhật DB:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/Update-Database.ps1
```

Ví dụ thêm một trường của module Users:

```powershell
dotnet ef migrations add AddUserField --context UserDbContext --output-dir Persistence/Migrations/Users
```

Không scaffold database vì đây là Code First. Không tạo InitialCreate thứ hai trên AppDbContext cho DB hiện có. Xem [hướng dẫn kiến trúc](../docs/ARCHITECTURE.md) để chọn đúng context.

## Gửi OTP

Chạy từ gốc repository:

```powershell
powershell -NoProfile -STA -ExecutionPolicy Bypass -File backend/scripts/Configure-Email.ps1
```

Gmail sender cần mật khẩu ứng dụng Google. Công cụ nhập mật khẩu ẩn và lưu vào User Secrets, mặc định không cập nhật email admin. [Hướng dẫn Google](https://support.google.com/accounts/answer/185833?hl=vi).

Cấu hình `Smtp` trong User Secrets gồm Host, Port, Username, Password, FromEmail, FromName, UseStartTls. Gmail dùng `smtp.gmail.com:587`, STARTTLS. `Otp` mặc định Length=6, ExpiresInMinutes=5, MaxAttempts=5. Địa chỉ nhận lấy từ tài khoản đang hoạt động, không phải địa chỉ sender cố định.

Triển khai dùng biến môi trường, ví dụ `ConnectionStrings__DefaultConnection`, `Jwt__SigningKey`, `Smtp__Username`, `Smtp__Password`. Production dùng HTTPS và CORS đúng domain frontend. Cloudinary cần cấu hình riêng các khóa trong `CloudinaryOptions`; không chứa giá trị bí mật trong appsettings đã commit.

## Kiểm tra build

```powershell
dotnet build Backend.csproj
```

Nếu đang chạy Debug, dừng bằng Ctrl+C trước khi build để tránh khóa DLL. Muốn kiểm tra biên dịch riêng có thể dùng `dotnet build Backend.csproj --configuration Verify`.
