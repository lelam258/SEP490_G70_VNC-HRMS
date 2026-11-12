# Hợp đồng phân quyền

Base giữ 6 mã role để các thành viên dùng thống nhất: admin, hr_manager, hr_staff, accountant, department_head, employee.

| Chức năng khi triển khai | Role |
| --- | --- |
| Quản lý tài khoản | Administrator (admin) |
| Danh mục/gán vai trò, audit log hệ thống | Administrator (admin); chỉ vai trò có sẵn, không sửa danh mục quyền |
| Xem chấm công, chi tiết và ca trực | HR Staff/HR Manager/Administrator toàn bộ; Department Manager theo khoa của bản ghi; Medical Staff chỉ bản ghi cá nhân |
| Nhập file, sửa lỗi nhập, tạo/sửa ca trực | HR Staff (hr_staff); chặn kỳ khóa, kiểm tra phiên bản và giữ bằng chứng |
| Xem đợt nhập/file gốc/báo cáo lỗi | HR Staff, HR Manager, Administrator |
| Phân tích tệp không lưu, liên kết/xóa liên kết mã máy có căn cứ | HR Staff; Administrator/HR Manager chỉ tra cứu danh sách liên kết |
| Lịch sử chấm công/ca | HR Staff, HR Manager, Administrator, Accountant; Department Manager chỉ khoa được giao |
| Xuất lịch sử chấm công/ca | HR Staff, HR Manager, Administrator, Accountant trong phạm vi được phép |
| Hồ sơ nhân viên và khoa/phòng | HR Manager (hr_manager) |
| Hợp đồng lao động: danh sách, tạo, chi tiết, sửa (`/api/contracts`) | HR Manager (hr_manager); danh sách không trả số tiền lương |
| Đãi ngộ hợp đồng: điều chỉnh lương, bảo hiểm, thuế, phụ cấp (`/api/compensation`) | Accountant (accountant) |
| Nghiệp vụ các UC khác | Thành viên phụ trách xác nhận theo yêu cầu |

JWT policy và middleware phiên SQL kiểm tra quyền trên API; guard frontend phục vụ điều hướng. Các module chấm công kiểm tra thêm phạm vi bản ghi theo nhân viên/khoa, giữ quyền đọc tách khỏi quyền thao tác.

Các module xác thực cần quản lý phiên, xoay vòng/thu hồi token và security version. Module tài khoản cần ngăn tự nâng quyền, bảo vệ admin cuối cùng và kiểm tra cập nhật đồng thời bằng rowversion.
