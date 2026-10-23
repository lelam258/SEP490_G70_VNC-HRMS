# VNC HRMS

React SPA (Vite + TypeScript), ASP.NET Core 8 microservices, YARP API Gateway, SQL Server và EF Core Code First.

| Thành phần | Cổng local | Database |
| --- | --- | --- |
| Gateway | 5100 | Không có |
| IAM — tài khoản, đăng nhập, OTP, phiên | 5101 | VNC_IAM_DB |
| HR — nhân viên, khoa/phòng, hợp đồng, bằng cấp, upload | 5102 | VNC_HR_DB |
| Attendance — chấm công, ca trực, nghỉ phép | 5103 | VNC_Attendance_DB |
| Payroll — lương, hoa hồng, quyền lợi, khiếu nại | 5104 | VNC_Payroll_DB |
| Compliance — chứng chỉ, CME | 5105 | VNC_Compliance_DB |
| Notification — thông báo của tài khoản | 5106 | VNC_Notification_DB |
| Frontend | 5173 | Không truy cập database |

## Thiết lập mới trên Windows

Cần .NET SDK 8, Node.js 20+, SQL Server có Windows Authentication và quyền tạo database.

Chạy tại thư mục gốc repository:

```powershell
powershell -ExecutionPolicy Bypass -File backend/scripts/Initialize-Local.ps1
cd backend
dotnet run
```

Trong terminal khác:

```powershell
cd frontend
npm ci
npm run dev
```

Mở **http://localhost:5173**. Frontend tiếp tục gọi `/api` qua Gateway ở **http://localhost:5100**. Swagger tự mở tại **http://localhost:5100/swagger**, chọn IAM, HR, Attendance, Payroll, Compliance hoặc Notification trong danh sách để xem và gọi API. Swagger riêng của từng service vẫn có tại cổng 5101–5106.

Script khởi tạo lưu cấu hình vào User Secrets và thông tin admin mới vào `backend/.local/microservices-admin.txt`. Chạy lại giữ admin đã tồn tại. SQL Server khác localhost: thêm `-Server 'TEN-MAY\INSTANCE'`. Database cũ `VNC_HRMS_Iteration1` không bị sửa.

Hằng ngày chỉ cần `cd backend` rồi `dotnet run`. Project `VNC.HRMS.Local.csproj` tự build solution và chạy Gateway cùng 6 API trong các tiến trình riêng; Ctrl+C dừng toàn bộ. Có thể dùng `dotnet run -- --no-build` nếu các service đã build và không có thay đổi code, hoặc thêm `--no-browser` để không tự mở Swagger. Script `Start-Local.ps1` vẫn dùng được.

Nếu muốn **chuyển dữ liệu cũ**, dùng quy trình [migration](docs/MIGRATION.md) thay cho khởi tạo admin mới.

## Docker Compose

Sao chép `.env.example` thành `.env`, điền mật khẩu SQL Server, `JWT_SIGNING_KEY`, `INTERNAL_API_KEY` (hai khóa ít nhất 32 ký tự), mật khẩu admin và thông tin tích hợp cần dùng.

```powershell
powershell -ExecutionPolicy Bypass -File backend/scripts/Initialize-Docker.ps1
```

Script build image, chờ SQL Server, áp dụng migration của từng service, tạo admin rồi khởi động Gateway. Chỉ Gateway được công khai ở cổng 5100. Frontend vẫn chạy bằng Vite. Các container API không tự áp dụng migration khi khởi động hằng ngày.

## Kiểm tra

```powershell
cd backend
dotnet build VNC.HRMS.sln -c Release
cd ../frontend
npm run build
cd ..
powershell -ExecutionPolicy Bypass -File backend/scripts/Verify-Architecture.ps1 -NoBuild
```

Kiểm thử tích hợp tạo database tạm với tên ngẫu nhiên, chạy 7 tiến trình trên cổng 15100–15106, kiểm tra các luồng liên service, giữ mật khẩu/liên kết khi import dữ liệu cũ và từ chối import vào đích đã có dữ liệu, rồi dọn tài nguyên của lần chạy đó.

## Phạm vi nghiệp vụ

Các luồng tài khoản, đăng nhập, đăng ký theo hồ sơ nhân viên, OTP, quản lý nhân viên/phòng ban và upload được chuyển từ code hiện có. Attendance, Payroll và Compliance có model, migration và API đọc phân trang cho các nhóm dữ liệu chính. Notification có danh sách và đánh dấu đã đọc theo tài khoản hiện hành.

Các quy trình mới như import/chốt công, tính/chốt lương, phiên bản công thức, quét chứng chỉ và phát thông báo tự động cần triển khai tiếp theo yêu cầu nghiệp vụ; việc chuyển cấu trúc không tự tạo ra các quy trình này.

- [Kiến trúc và quy ước](docs/ARCHITECTURE.md)
- [Phân quyền UC-01, UC-02 và UC-07](docs/PERMISSIONS.md)
- [Database và chuyển dữ liệu cũ](docs/MIGRATION.md)
- [Backend](backend/README.md)
- [Frontend](frontend/README.md)
