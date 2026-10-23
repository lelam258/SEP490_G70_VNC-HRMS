# Hợp đồng phân quyền

Base giữ 6 mã role để các thành viên dùng thống nhất: admin, hr_manager, hr_staff, accountant, department_head, employee.

| Chức năng khi triển khai | Role |
| --- | --- |
| Quản lý tài khoản | Administrator (admin) |
| Hồ sơ nhân viên và khoa/phòng | HR Manager (hr_manager) |
| Nghiệp vụ các UC khác | Thành viên phụ trách xác nhận theo yêu cầu |

Đã có JWT policy Admin và HRManager. Bản base chưa có màn/API nghiệp vụ, chưa cấp token, chưa kiểm tra phiên SQL. Guard frontend là khung dùng chung; không thay thế kiểm tra quyền trên API.

Các module xác thực cần quản lý phiên, xoay vòng/thu hồi token và security version. Module tài khoản cần ngăn tự nâng quyền, bảo vệ admin cuối cùng và kiểm tra cập nhật đồng thời bằng rowversion.
