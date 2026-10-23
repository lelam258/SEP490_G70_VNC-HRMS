# Backend base

Một ASP.NET Core 8 Web API: Backend.csproj. Chạy tại đây bằng dotnet run sau khi khởi tạo. Swagger: http://localhost:5100/swagger.

Chỉ có GET /health; controller/service/repository nghiệp vụ tổ chức theo cấu trúc lớp dùng chung. Base có Models, Configurations/Entities, Persistence/AppDbContext và Migrations; UnitOfWork, JWT/role policies, global exception middleware và adapter SMTP/Cloudinary. Chưa có đăng nhập, session validation SQL hoặc bootstrap admin. Các cơ chế đó được bổ sung cùng chức năng xác thực.

## Thiết lập

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/Initialize-Local.ps1
dotnet run
```

Đổi SQL bằng tham số -ConnectionString. Mặc định dùng localhost và VNC_HRMS_Iteration1, Windows Authentication. Script tạo JWT key riêng trong User Secrets, sao lưu database đích đã tồn tại, áp dụng migration và import nguồn cũ khi đích trống. Không reset mật khẩu hoặc tự tạo tài khoản.

## Thêm module

Thêm DTO, repository/interface, service/interface và controller; đăng ký DI tại Configurations/DependencyInjection.cs. Controller không truy vấn SQL trực tiếp. Dùng chung AppDbContext và UnitOfWork scoped. Thêm policy đúng nghiệp vụ; chưa có login thì route được bảo vệ chưa thể đăng nhập để sử dụng.

```powershell
dotnet ef migrations add TenThayDoi --output-dir Persistence/Migrations
dotnet ef database update
dotnet build VNC.HRMS.sln -c Release
```

SMTP/Cloudinary có options/adapter dùng chung. Secret cấu hình qua dotnet user-secrets hoặc biến môi trường, không điền trực tiếp vào appsettings.json. Không đưa .local, bin hoặc obj lên Git.
