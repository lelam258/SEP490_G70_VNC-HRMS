# Phân quyền trong phạm vi UC-01, UC-02 và UC-07

Phần triển khai này chỉ bao gồm các chức năng người phụ trách đã xác nhận:

| Chức năng | Vai trò |
| --- | --- |
| Đăng nhập bằng username/email, đăng xuất, chuyển hướng theo quyền | Cả 6 role có tài khoản hợp lệ |
| Tìm/lọc, xem, tạo và cập nhật tài khoản, role, trạng thái | Administrator |
| Xem, tạo, cập nhật khoa/phòng | HR Manager |
| Xem, tìm/lọc hồ sơ nhân viên; tạo hồ sơ và liên kết khoa/phòng | HR Manager |

Không triển khai các UC khác, không sửa quyền nghiệp vụ Attendance, Payroll, Compliance, Notification hoặc upload trong đợt này.

## Mã role

| Actor | Giá trị lưu trong IAM |
| --- | --- |
| Administrator | `admin` |
| HR Manager | `hr_manager` |
| HR Staff | `hr_staff` |
| Accountant | `accountant` |
| Department Manager | `department_head` |
| Medical Staff | `employee` |

Giữ hai mã `department_head` và `employee` để không buộc các phần của thành viên khác đổi hợp đồng dữ liệu. Role `hr` cũ được migration IAM chuyển thành `hr_manager`, đồng thời tăng security version để phiên cũ phải đăng nhập lại. Import dữ liệu từ monolith cũng áp dụng ánh xạ này. Không đổi mật khẩu hoặc ID tài khoản.

## Cấp quyền lần đầu

1. Đăng nhập Administrator, mở **Quản lý tài khoản → Tạo tài khoản**.
2. Chọn **HR Manager**. Role này có thể được tạo trước khi có hồ sơ nhân viên, để khởi tạo tổ chức mà không cấp quyền HR cho Administrator.
3. Đăng nhập HR Manager để tạo khoa/phòng và hồ sơ nhân viên.
4. Administrator dùng các hồ sơ đó để cấp tài khoản và role tương ứng. Với tài khoản HR Manager chưa liên kết hồ sơ, Administrator có thể liên kết một lần sau khi HR đã tạo hồ sơ. Hồ sơ đã liên kết không được đổi sang người khác.

Các role nhân viên khác bắt buộc có hồ sơ hợp lệ. Đăng ký công khai luôn tạo Medical Staff; gửi thêm trường role không thể tự nâng quyền.

## Tách quyền tài khoản khỏi quyền hồ sơ

Administrator không truy cập được `/api/employees` và `/api/departments`. Màn hình cấp tài khoản lấy danh sách nhân viên tối thiểu từ `/api/users/employee-options` trong IAM. IAM gọi HR qua API nội bộ được bảo vệ; kết quả chỉ gồm mã, tên, email, khoa/phòng và trạng thái cần để chọn nhân viên, không trả giấy tờ hoặc hồ sơ cá nhân chi tiết.

HR Manager không truy cập được `/api/users` hoặc danh sách chọn nhân viên dành cho quản trị tài khoản. Menu và route frontend áp dụng cùng phạm vi; backend vẫn kiểm tra độc lập và trả 403 nếu gọi trực tiếp sai quyền.

Sau đăng nhập, Administrator vào `/accounts`, HR Manager vào `/employees`, các role khác vào `/`. Liên kết quay lại sau đăng nhập chỉ được giữ nếu thuộc màn hình được phép. Các màn hình nghiệp vụ của UC khác chưa được thêm.

Thay role, trạng thái hoặc liên kết nhân viên làm tăng security version. Phiên cũ bị từ chối ngay trên API và khi refresh; người dùng đăng nhập lại với quyền mới. Cơ chế giữ ít nhất một admin hoạt động và kiểm tra rowversion khi cập nhật được giữ.

## Kiểm tra

```powershell
cd frontend
npm run test:permissions
npm run test:logout
npm run build
cd ..
powershell -ExecutionPolicy Bypass -File backend/scripts/Verify-Architecture.ps1
```

Kiểm thử tích hợp dùng database tạm, kiểm tra cả 6 role: allow/deny khi gọi API, cấp HR Manager đầu tiên, liên kết hồ sơ sau khởi tạo, từ chối tự nâng quyền khi đăng ký, quyền thay đổi ngay khi sửa role/trạng thái, và logout.
