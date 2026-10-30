# Bộ test case theo tính năng VNC HRMS

## 1. Mục đích và phạm vi

Bộ test này bao phủ các luồng đã có trong frontend/backend hiện tại: xác thực và phiên, tài khoản, nhân viên, khoa/phòng, hồ sơ cá nhân, nghỉ phép tự phục vụ, tham số/bồi thường/kỳ lương, chứng chỉ/CME, upload file và các API đọc chấm công/tuân thủ/thông báo.

Đây là bộ test chức năng thủ công, tập trung vào hành vi người dùng và API. Các mục được ghi rõ **API** khi hiện chỉ có API hoặc dữ liệu đọc, không hàm ý đã có màn hình tương ứng.

Không kiểm thử chức năng chưa được triển khai đầy đủ như phê duyệt nghỉ phép, nhập/chốt công, tính/chốt bảng lương, quy trình quét tuân thủ tự động hoặc tạo/gửi thông báo tự động.

## 2. Cách chạy và ghi nhận

### Kiểm tra tự động có sẵn

Từ thư mục `frontend`:

```powershell
npm ci
npm run build
npm run test:logout
npm run test:permissions
npm run test:leave-rules
```

Ba lệnh `test:*` là các kiểm tra tự động phía frontend/rules, không cần SQL Server. Chúng không thay thế các ca tích hợp API trong tài liệu này. Nếu test fail, ghi nguyên lệnh, môi trường và thông báo lỗi; không đánh dấu các testcase tích hợp là pass dựa trên build thành công.

### Kiểm thử tích hợp

- Khởi tạo và chạy backend/frontend theo [README](../README.md); cần SQL Server đã cấu hình.
- Thực hiện trên database local/test đã sao lưu; không dùng dữ liệu/mật khẩu của người dùng thật.
- Chuẩn bị tài khoản theo role: `admin`, `hr_manager`, `hr_staff`, `accountant`, `department_head`, `employee`.
- Chuẩn bị hồ sơ nhân viên có liên kết tài khoản, dữ liệu phòng ban, hợp đồng, kỳ lương và chứng chỉ phù hợp từng ca.
- Với gửi OTP hoặc ảnh/file, cấu hình email/Cloudinary hoặc adapter local theo môi trường.
- Mỗi ca cần ghi trạng thái **Pass / Fail / Blocked / Not run**, người chạy, ngày giờ, môi trường, dữ liệu kiểm thử và ảnh/response đã xóa token, cookie, OTP, mật khẩu.

## 3. Dữ liệu kiểm thử

Tất cả dữ liệu dưới đây là giả lập, dùng riêng trên database local/test. Đổi hậu tố `3010` thành ngày chạy hoặc chuỗi riêng để tránh trùng dữ liệu ở lần chạy trước. Tạo dữ liệu qua giao diện/API hợp lệ; không chèn trực tiếp vào database nếu chưa hiểu các quan hệ và ràng buộc.

### Tài khoản kiểm thử

Mật khẩu dùng riêng cho các tài khoản QA mới tạo: `QaTest!2026` (đạt quy tắc hiện tại: có chữ hoa, số, ký tự đặc biệt). Chỉ dùng trên máy/database test; không dùng lại mật khẩu này ở nơi khác. Với admin, dùng tài khoản bootstrap hiện có và không tạo admin thứ hai nếu hệ thống đã có admin.

| Username | Email | Role | Hồ sơ nhân viên |
|---|---|---|---|
| `qa.admin.3010` | `qa.admin.3010@example.invalid` | `admin` | Không bắt buộc |
| `qa.hr.3010` | `qa.hr.3010@example.invalid` | `hr_manager` | Không bắt buộc |
| `qa.staff.3010` | `qa.eqa1001@example.invalid` | `hr_staff` | `EQA1001` |
| `qa.payroll.3010` | `qa.eqa1002@example.invalid` | `accountant` | `EQA1002` |
| `qa.head.3010` | `qa.eqa1003@example.invalid` | `department_head` | `EQA1003` |
| `qa.employee.3010` | `qa.eqa1004@example.invalid` | `employee` | `EQA1004` |

Email `.invalid` là địa chỉ giả, không nhận thư. Dùng mailbox riêng do nhóm kiểm soát nếu chạy OTP; không ghi OTP hoặc mật khẩu thật vào tài liệu.

### Hồ sơ và dữ liệu nghiệp vụ

| Loại dữ liệu | Dữ liệu mẫu | Dùng cho |
|---|---|---|
| Khoa/phòng active | Mã `QA-3010-A`, tên `QA Khoa Nội`, trạng thái `active` | Tạo nhân viên, hồ sơ, nghỉ phép |
| Khoa/phòng thứ hai | Mã `QA-3010-B`, tên `QA Khoa Ngoại`, trạng thái `active` | Kiểm tra liên kết/lọc giữa khoa phòng |
| Nhân viên active A | Mã `EQA1001`, tên `QA Nguyễn An`, email `qa.eqa1001@example.invalid`, gắn `QA-3010-A` | Tạo tài khoản `hr_staff`, hồ sơ/đơn nghỉ |
| Nhân viên active B | Mã `EQA1002`, tên `QA Trần Bình`, email `qa.eqa1002@example.invalid`, gắn `QA-3010-B` | Tạo tài khoản accountant, kiểm tra phân tách dữ liệu |
| Nhân viên active C | Mã `EQA1003`, tên `QA Lê Chi`, email `qa.eqa1003@example.invalid`, gắn `QA-3010-A` | Tạo tài khoản department_head, dữ liệu đối chiếu |
| Nhân viên active D | Mã `EQA1004`, tên `QA Phạm Dũng`, email `qa.eqa1004@example.invalid`, gắn `QA-3010-A` | Tài khoản employee, self-service/đơn nghỉ |
| Nhân viên active chưa cấp tài khoản | Mã `EQA1005`, tên `QA Hoàng Em`, email `qa.eqa1005@example.invalid`, gắn `QA-3010-A` | Đăng ký, provision tài khoản |
| Nhân viên inactive | Mã `EQA1006`, tên `QA Vũ inactive`, email `qa.eqa1006@example.invalid`, trạng thái `inactive` | Từ chối đăng nhập/tạo đơn |
| Nhân viên chưa phân khoa | Mã `EQA1007`, tên `QA Đỗ NoDept`, trạng thái `active`, không gắn khoa phòng | Kiểm tra chặn tạo đơn nghỉ |
| Leave type | Chọn một loại đang active, ưu tiên `annual` nếu được cấu hình | Tạo/đọc/thu hồi đơn nghỉ |
| Khoảng nghỉ hợp lệ mẫu | `2026-11-02` đến `2026-11-04`, lý do `Nghi phep kiem thu QA` | Hợp lệ khi chạy từ 2026-10-30; nếu chạy ngày khác, thay bằng ngày hiện tại hoặc tương lai |
| Khoảng Chủ nhật | `2026-11-01` đến `2026-11-01` | Từ chối vì không có ngày làm việc |
| Lý do không hợp lệ | `QA` (dưới 10 ký tự) | Validation đơn nghỉ |
| File upload hợp lệ | Tệp giả PDF/PNG/JPG nhỏ hơn 1 MB, tên `qa-attachment.pdf` | Upload/file đính kèm |
| File quá cỡ | Tệp giả lớn hơn 10 MB cho đơn nghỉ; lớn hơn 2 MB cho avatar | Kiểm tra giới hạn theo từng chức năng |
| Kỳ lương kiểm thử | Tháng `2026-12`, chỉ dùng nếu chưa tồn tại; nếu đã có, chọn tháng tương lai khác chưa có | Tạo/trùng/chi tiết kỳ lương |
| Chứng chỉ | Bản ghi giả gắn `EQA1001`, loại chứng chỉ hỗ trợ CME, ngày hết hạn tương lai | CRUD chứng chỉ và chu kỳ CME |
| Bằng cấp | Bản ghi giả gắn `EQA1001`, phân loại degree | Xác nhận không áp dụng chu kỳ CME |
| Thông báo | Hai thông báo giả cho hai user khác nhau, nếu môi trường có chức năng tạo seed | Đọc/đánh dấu đã đọc và phân tách user |

Các email và mã mẫu cần được kiểm tra chưa tồn tại trước khi tạo. Nếu có xung đột, đổi hậu tố đồng nhất trên tất cả dữ liệu của lần chạy. Mã phòng, nhân viên, kỳ lương và ngày cố định trong ví dụ chỉ là dữ liệu gợi ý; không ghi đè dữ liệu hiện có.

### Dữ liệu âm cho validation

| Trường hợp | Giá trị mẫu | Kết quả mong đợi |
|---|---|---|
| Login sai | Username `qa.employee.3010`, password `Wrong!2026` | Bị từ chối, không tạo phiên |
| Login thiếu trường | `login=""`, `password=""` | Form/API từ chối |
| Username tài khoản không hợp lệ | `qa user` hoặc `qa@user` | Bị từ chối theo quy tắc username |
| Email không hợp lệ | `not-an-email` | Bị từ chối |
| Mật khẩu yếu | `qa123` | Bị từ chối theo chính sách mật khẩu |
| Đơn nghỉ ngày kết thúc trước ngày bắt đầu | Start `2026-11-05`, end `2026-11-04` | HTTP 400/lỗi validation, không tạo đơn |
| Đơn nghỉ chồng lấn | Tạo đơn thứ hai giao với một đơn pending của cùng nhân viên | HTTP 409, không tạo đơn thứ hai |
| Tháng lương không hợp lệ | `2026-13`, `2026/12`, `2026-00` | HTTP 400 |

## 4. Danh mục testcase

### A. Xác thực và phiên

| ID | Ưu tiên | Tiền điều kiện | Bước thực hiện | Kết quả mong đợi |
|---|---|---|---|---|
| AUTH-01 | Cao | Chưa đăng nhập | Mở `/login`; thử mở một route yêu cầu đăng nhập | Form login hiển thị; route riêng tư chuyển về login và giữ đích đến dự kiến sau khi xác thực. |
| AUTH-02 | Cao | Tài khoản active, đã provision | Đăng nhập bằng username; lặp lại bằng email | Cả hai cách đăng nhập thành công; hiển thị đúng user/role; không lưu mật khẩu dạng rõ. |
| AUTH-03 | Cao | Có tài khoản thử nghiệm | Đăng nhập với mật khẩu sai hoặc tài khoản không khả dụng | Bị từ chối, không tạo phiên; thông báo không tiết lộ tài khoản có tồn tại hay trạng thái cụ thể. |
| AUTH-04 | Cao | Không cần | Gửi form trống; thử login dài hơn giới hạn API | Form bắt buộc dữ liệu; dữ liệu không hợp lệ bị từ chối, không tạo phiên. |
| AUTH-05 | Cao | Tài khoản thử nghiệm chưa khóa | Nhập sai mật khẩu 5 lần rồi thử mật khẩu đúng trong 15 phút | Login bị khóa tạm sau ngưỡng; không cấp phiên; sau thời gian khóa, mật khẩu đúng có thể đăng nhập. |
| AUTH-06 | Cao | Có hồ sơ nhân viên active chưa cấp tài khoản | Đăng ký với mã nhân viên/email khớp, username và mật khẩu hợp lệ | Đăng ký thành công; tài khoản gắn đúng hồ sơ và có thể đăng nhập. |
| AUTH-07 | Cao | Như AUTH-06 | Đăng ký với mã nhân viên hoặc email không khớp, hoặc nhân viên không active | Bị từ chối; không tạo tài khoản. |
| AUTH-08 | Cao | SMTP được cấu hình; tài khoản hợp lệ | Gửi yêu cầu quên mật khẩu bằng email tồn tại, sau đó bằng email không tồn tại | Cùng thông báo chung để tránh dò email; OTP chỉ được gửi cho tài khoản đủ điều kiện. |
| AUTH-09 | Cao | Có challenge OTP còn hạn | Đặt lại bằng OTP đúng và mật khẩu mới hợp lệ; đăng nhập lại bằng mật khẩu mới | Đặt lại thành công; mật khẩu cũ không còn dùng được; phiên/token cũ bị thu hồi. |
| AUTH-10 | Cao | Có challenge OTP | Dùng OTP sai, hết hạn, đã dùng hoặc vượt số lần thử; thử mật khẩu mới không đạt yêu cầu | Yêu cầu bị từ chối; không đổi mật khẩu; challenge không thể dùng lại sau khi đã tiêu thụ. |
| AUTH-11 | Cao | Đang đăng nhập | Đổi mật khẩu bằng mật khẩu hiện tại đúng; thử lại bằng mật khẩu cũ | Đổi thành công, đăng xuất/thu hồi phiên theo thiết kế; mật khẩu mới dùng được, mật khẩu cũ bị từ chối. |
| AUTH-12 | Cao | Đang đăng nhập | Đổi mật khẩu với mật khẩu hiện tại sai hoặc mật khẩu mới không hợp lệ | Bị từ chối và không đổi mật khẩu/không xóa phiên hiện tại ngoài hành vi báo lỗi. |
| AUTH-13 | Cao | Đang đăng nhập | Chọn Đăng xuất; sau đó thử gọi API cần xác thực với access token cũ và refresh token cũ | UI về login; phiên bị xóa/thu hồi; API bảo vệ không chấp nhận phiên đã logout. |
| AUTH-14 | Cao | Đang đăng nhập, access token hết hạn, refresh cookie còn hạn | Gọi API bảo vệ; sau đó thực hiện logout khi access token hết hạn | Refresh hợp lệ cấp access token mới và request ban đầu được thử lại một lần; logout vẫn có thể thu hồi refresh session. |

### B. Phân quyền và điều hướng

| ID | Ưu tiên | Tiền điều kiện | Bước thực hiện | Kết quả mong đợi |
|---|---|---|---|---|
| PERM-01 | Cao | Có tài khoản 6 role | Đăng nhập lần lượt từ trang login | Điều hướng mặc định phù hợp role: admin đến tài khoản; HR Manager đến nhân viên; role khác về trang chủ. |
| PERM-02 | Cao | Đăng nhập bằng role không phải admin | Mở trực tiếp `/accounts` và gọi `GET /api/users` | UI không cho truy cập; API từ chối quyền (403). Không chỉ dựa vào ẩn menu frontend. |
| PERM-03 | Cao | Đăng nhập bằng role không phải HR Manager/admin | Mở trang nhân viên/khoa phòng/chứng chỉ/CME và gọi API tương ứng | Bị từ chối theo quyền phía server. |
| PERM-04 | Cao | Đăng nhập bằng role không phải accountant | Mở trang payroll/parameters và gọi API payroll | Bị từ chối theo quyền phía server. |
| PERM-05 | Cao | Đăng nhập bằng user A và B | User A đọc/cập nhật hồ sơ hoặc đơn nghỉ của B bằng cách thay ID | Không trả dữ liệu của B; API trả not found/forbidden theo hợp đồng endpoint. |
| PERM-06 | Trung bình | Đã logout hoặc token hết hạn | Gọi endpoint cần xác thực không kèm token hợp lệ | API trả 401; không trả dữ liệu riêng tư. |
| PERM-07 | Trung bình | Không cần | Truy cập route không tồn tại | Hiển thị trang not-found, không làm vỡ ứng dụng hoặc lộ dữ liệu. |

### C. Quản lý tài khoản — Admin

| ID | Ưu tiên | Tiền điều kiện | Bước thực hiện | Kết quả mong đợi |
|---|---|---|---|---|
| ACC-01 | Cao | Đăng nhập admin | Mở danh sách tài khoản, tải lại, mở một tài khoản | Danh sách và chi tiết hiển thị dữ liệu đúng; lỗi API được báo rõ. |
| ACC-02 | Cao | Có nhân viên active chưa provision | Tạo tài khoản gắn nhân viên với username, role, trạng thái và mật khẩu hợp lệ | Tạo thành công; tài khoản gắn đúng nhân viên; nhân viên không còn là lựa chọn chưa cấp tài khoản. |
| ACC-03 | Cao | Admin được phép tạo HR Manager | Tạo HR Manager không gắn hồ sơ nhân viên nếu form cho phép | Tạo thành công với role HR Manager; các role khác không được tạo thiếu liên kết nhân viên. |
| ACC-04 | Cao | Có tài khoản thử nghiệm chưa cấp | Tạo với username/mật khẩu/email/role/trạng thái không hợp lệ | Hiển thị lỗi validation; không tạo bản ghi. |
| ACC-05 | Cao | Có tài khoản đã provision | Sửa thông tin hợp lệ và lưu | Chi tiết/danh sách phản ánh thay đổi sau khi tải lại. |
| ACC-06 | Cao | Admin hiện tại là admin active cuối cùng | Thử hạ role hoặc vô hiệu hóa chính tài khoản cuối cùng | Bị từ chối; hệ thống vẫn giữ ít nhất một admin active. |
| ACC-07 | Cao | Có ít nhất hai admin active | Admin A cập nhật trạng thái/role hoặc mật khẩu admin B; B đang có session | Thao tác hợp lệ; session/token bị thu hồi khi thay đổi bảo mật; tài khoản B phải xác thực lại. |
| ACC-08 | Trung bình | Hai cửa sổ mở cùng một tài khoản | Cửa sổ A lưu cập nhật; cửa sổ B lưu dữ liệu version cũ | Cập nhật cũ bị từ chối xung đột; người dùng được yêu cầu tải lại, dữ liệu A không bị ghi đè. |

### D. Nhân viên và khoa/phòng — HR Manager

| ID | Ưu tiên | Tiền điều kiện | Bước thực hiện | Kết quả mong đợi |
|---|---|---|---|---|
| HR-01 | Cao | Đăng nhập HR Manager | Mở danh sách nhân viên, tìm/mở chi tiết một nhân viên | Dữ liệu hồ sơ, khoa/phòng và trạng thái hiển thị nhất quán. |
| HR-02 | Cao | Có khoa/phòng active | Tạo nhân viên với mã, họ tên và khoa/phòng hợp lệ | Tạo thành công; mã được chuẩn hóa; hồ sơ có tài khoản dự trữ chưa provision và chưa thể đăng nhập. |
| HR-03 | Cao | HR Manager | Tạo nhân viên thiếu mã/họ tên hoặc gắn khoa/phòng không active/không tồn tại | Bị từ chối với lỗi rõ ràng; không tạo hồ sơ. |
| HR-04 | Cao | Có hồ sơ nhân viên | Cập nhật thông tin liên hệ, trạng thái, ngày vào làm, khoa/phòng hợp lệ | Lưu thành công và dữ liệu mới hiển thị khi mở lại. |
| HR-05 | Cao | Có hồ sơ nhân viên | Cập nhật với mã/họ tên trống, trạng thái khác `active`/`inactive`, hoặc khoa/phòng không hợp lệ | Bị từ chối; dữ liệu trước đó không bị thay đổi. |
| HR-06 | Cao | HR Manager | Tạo khoa/phòng với mã và tên hợp lệ | Tạo thành công, xuất hiện trong danh sách và lựa chọn khoa/phòng. |
| HR-07 | Cao | HR Manager | Tạo khoa/phòng thiếu mã/tên; thử sửa trạng thái không hợp lệ | Bị từ chối validation; không tạo/cập nhật dữ liệu sai. |
| HR-08 | Cao | Nhân viên đang được tài khoản/đơn/hợp đồng tham chiếu | Đặt hồ sơ nhân viên inactive rồi thử tạo đơn nghỉ bằng tài khoản nhân viên đó | Trạng thái hồ sơ cập nhật; nhân viên inactive không tạo được đơn nghỉ mới. |

### E. Hồ sơ cá nhân và nghỉ phép — Self-service

| ID | Ưu tiên | Tiền điều kiện | Bước thực hiện | Kết quả mong đợi |
|---|---|---|---|---|
| SELF-01 | Cao | Đăng nhập user có hồ sơ nhân viên | Mở `/me/profile` | Chỉ trả hồ sơ gắn với user hiện tại. |
| SELF-02 | Cao | Có hồ sơ cá nhân | Cập nhật họ tên, ngày sinh, giới tính, số điện thoại, CCCD hợp lệ | Lưu thành công; dữ liệu user/staff cần đồng bộ được cập nhật; thao tác được audit. |
| SELF-03 | Cao | Có hồ sơ cá nhân và CCCD đang dùng ở hồ sơ khác | Cập nhật sang CCCD trùng | Bị từ chối xung đột; dữ liệu cũ giữ nguyên. |
| SELF-04 | Trung bình | Có hồ sơ cá nhân | Gửi dữ liệu hồ sơ sai định dạng/ngoài giới hạn | Hiển thị lỗi validation; dữ liệu không bị cập nhật. |
| SELF-05 | Cao | Có ảnh hợp lệ dung lượng tối đa 2 MB | Tải ảnh đại diện lên | Ảnh được lưu; URL/ảnh mới hiển thị trong hồ sơ. |
| SELF-06 | Cao | Có hồ sơ cá nhân | Tải file rỗng, không phải ảnh phù hợp hoặc lớn hơn 2 MB làm avatar | Bị từ chối; avatar cũ không bị ghi đè. |
| LEAVE-01 | Cao | User có nhân viên active đã gán khoa/phòng | Mở danh sách loại nghỉ và lịch sử nghỉ phép | Chỉ hiển thị loại nghỉ active và đơn của user hiện tại. |
| LEAVE-02 | Cao | Như LEAVE-01 | Tạo đơn với loại nghỉ hợp lệ, ngày hợp lệ và lý do 10–500 ký tự | Tạo thành công ở trạng thái pending; tổng ngày tính theo ngày làm việc, không tính Chủ nhật. |
| LEAVE-03 | Cao | Như LEAVE-01 | Gửi ngày bắt đầu trong quá khứ, ngày kết thúc trước ngày bắt đầu hoặc toàn bộ khoảng ngày là Chủ nhật | Bị từ chối validation; không tạo đơn. |
| LEAVE-04 | Cao | Như LEAVE-01 | Tạo đơn với loại nghỉ không hợp lệ hoặc lý do dưới 10/trên 500 ký tự | Bị từ chối; không tạo đơn. |
| LEAVE-05 | Cao | User không active hoặc chưa gán khoa/phòng | Thử tạo đơn nghỉ | Bị từ chối; không tạo đơn. |
| LEAVE-06 | Cao | Có đơn pending của chính user | Tạo đơn có khoảng ngày trùng/chồng lấn với đơn pending | Bị từ chối xung đột; không tạo đơn trùng. |
| LEAVE-07 | Trung bình | Có đơn nghỉ pending của user A và đơn của user B | A mở chi tiết đơn B hoặc thu hồi đơn B | Không truy xuất/thao tác được đơn của user khác. |
| LEAVE-08 | Cao | Có đơn pending | Thu hồi đơn | Trạng thái chuyển withdrawn và hiển thị trong danh sách. |
| LEAVE-09 | Cao | Có đơn không còn pending | Thử thu hồi đơn đã withdrawn/trạng thái khác pending | Bị từ chối xung đột; trạng thái không thay đổi. |
| LEAVE-10 | Trung bình | Có file PDF/JPG/PNG hợp lệ | Tạo đơn kèm file hợp lệ, sau đó thử file sai định dạng/quá 10 MB | File hợp lệ gắn với đơn; file không hợp lệ bị từ chối, không tạo đơn. |

### F. Payroll — accountant

| ID | Ưu tiên | Tiền điều kiện | Bước thực hiện | Kết quả mong đợi |
|---|---|---|---|---|
| PAY-01 | Cao | Đăng nhập accountant | Mở danh sách cấu hình phụ cấp, bảo hiểm, bậc thuế, chính sách giảm trừ, quy tắc hoa hồng và dịch vụ thủ thuật | Dữ liệu trả về phù hợp bộ lọc trạng thái/ngày hiệu lực/từ khóa nếu có. |
| PAY-02 | Cao | Accountant; dữ liệu tham số kiểm thử | Tạo/cập nhật loại phụ cấp hợp lệ; tải lại danh sách | Lưu thành công; dữ liệu hiển thị đúng. |
| PAY-03 | Cao | Như PAY-02 | Tạo/cập nhật cấu hình bảo hiểm, bậc thuế hoặc quy tắc hoa hồng hợp lệ | Lưu thành công; lọc ngày hiệu lực trả đúng bản ghi. |
| PAY-04 | Cao | Accountant | Gửi cấu hình thiếu/sai giá trị bắt buộc hoặc ngày hiệu lực không hợp lệ | Bị từ chối validation; cấu hình hợp lệ trước đó không bị mất. |
| PAY-05 | Cao | Có hợp đồng nhân viên | Tìm hợp đồng; mở chi tiết; cập nhật thông tin compensation hợp lệ | Thông tin hợp đồng/phụ cấp hiển thị đúng sau khi lưu và tải lại. |
| PAY-06 | Cao | Có hợp đồng | Tạo một khoản phụ cấp cho hợp đồng và cập nhật khoản đó | Khoản phụ cấp gắn đúng hợp đồng; không xuất hiện ở hợp đồng khác. |
| PAY-07 | Cao | Accountant | Tạo kỳ lương với tháng hợp lệ định dạng `YYYY-MM` chưa tồn tại | Tạo thành công kỳ mới ở trạng thái khởi tạo/draft; xuất hiện trong danh sách. |
| PAY-08 | Cao | Đã có kỳ lương tháng đó | Tạo lại cùng tháng; thử tháng sai định dạng hoặc tháng ngoài 01–12 | Bị từ chối trùng/xác thực; không tạo kỳ mới. |
| PAY-09 | Trung bình | Có kỳ lương | Xem danh sách/chi tiết tháng hợp lệ và tháng không tồn tại | Chi tiết trả đúng kỳ; tháng sai định dạng trả lỗi validation, kỳ không tồn tại trả not found. |
| PAY-10 | Cao | Đăng nhập role không phải accountant | Gọi API cấu hình, compensation hoặc kỳ lương | Bị từ chối quyền; dữ liệu lương không bị trả về. |

### G. Chứng chỉ và CME — HR Manager/Admin

| ID | Ưu tiên | Tiền điều kiện | Bước thực hiện | Kết quả mong đợi |
|---|---|---|---|---|
| CME-01 | Cao | Đăng nhập HR Manager hoặc admin | Mở danh sách chứng chỉ/nhân viên và hồ sơ liên quan | Dữ liệu được lọc theo nhân viên/chứng chỉ đúng. |
| CME-02 | Cao | Có nhân viên | Tạo chứng chỉ/bằng cấp với dữ liệu hợp lệ | Bản ghi được tạo và trả về đúng nhân viên. |
| CME-03 | Cao | Có chứng chỉ/bằng cấp | Cập nhật rồi xóa bản ghi thử nghiệm | Bản ghi sau cập nhật đúng; sau xóa không còn trong danh sách. |
| CME-04 | Cao | Có hồ sơ chứng chỉ | Ghi nhận hoạt động CME hợp lệ | Bản ghi được liên kết đúng chứng chỉ/nhân viên và xuất hiện trong lịch sử. |
| CME-05 | Cao | Có CME chưa xác minh | Chuyển xác minh sang verified/unverified | Trạng thái xác minh và tổng hợp số liệu cập nhật nhất quán. |
| CME-06 | Cao | Có chứng chỉ thuộc nhóm áp dụng chu kỳ CME | Xem danh sách chu kỳ; cập nhật ngày bắt đầu/kết thúc hợp lệ | Chu kỳ hiển thị đúng; ngày kết thúc sau ngày bắt đầu. |
| CME-07 | Cao | Chứng chỉ áp dụng CME | Tạo chu kỳ mới và hoàn thành chu kỳ hiện tại | Chu kỳ mới là chu kỳ hiện tại; chu kỳ được hoàn thành không còn ở trạng thái hiện hành. |
| CME-08 | Cao | Có bằng cấp (degree) hoặc chứng chỉ không áp dụng CME | Thử sửa ngày chu kỳ/tạo chu kỳ | Không áp dụng thao tác CME cho bằng cấp; thao tác dữ liệu không phù hợp bị từ chối. |
| CME-09 | Cao | HR Manager/admin | Gọi API chứng chỉ/CME bằng employee hoặc role không được phép | Bị từ chối quyền phía server. |

### H. Upload, thông báo và API đọc dữ liệu

| ID | Ưu tiên | Tiền điều kiện | Bước thực hiện | Kết quả mong đợi |
|---|---|---|---|---|
| FILE-01 | Cao | Admin hoặc HR Manager; file hợp lệ | Tải file trong giới hạn endpoint | API trả URL/thông tin file; có thể đọc file qua URL được trả về. |
| FILE-02 | Cao | Như FILE-01 | Gửi file rỗng/quá giới hạn hoặc tên đường dẫn traversal | Bị từ chối hoặc trả not found; không truy cập file ngoài thư mục upload. |
| NOTI-01 | Trung bình | User đã đăng nhập có thông báo | Mở danh sách, chuyển trang nếu có nhiều thông báo | Chỉ trả thông báo của user hiện tại; phân trang ổn định. |
| NOTI-02 | Trung bình | Có thông báo của user A và B | Đánh dấu thông báo của A đã đọc; thử dùng A đánh dấu ID thuộc B | Thông báo của A chuyển trạng thái đọc; không được thay đổi thông báo của B. |
| READ-01 | Trung bình | Admin; có dữ liệu chấm công | Gọi API records/imports/leave requests/on-call shifts/timesheets với trang mặc định và trang kế tiếp | Trả đúng nhóm dữ liệu và phân trang; endpoint hiện là API đọc. |
| READ-02 | Trung bình | Admin; có dữ liệu tuân thủ | Gọi API certificates/CME cycles/CME records/scans với các giá trị phân trang hợp lệ | Trả dữ liệu trang tương ứng; không phát sinh thay đổi dữ liệu. |
| READ-03 | Cao | Không phải admin hoặc chưa xác thực | Gọi API attendance/compliance | API từ chối theo authorization; không lộ dữ liệu. |
| SYS-01 | Cao | Backend đang chạy | Gọi `GET /health` | Trả trạng thái `ok` và tên ứng dụng. |

## 5. Kết quả chạy test

### Kết quả tự động đã chạy

Chạy ngày **2026-10-30** tại thư mục `frontend` trên môi trường local. Mỗi script được chạy riêng; cả ba lệnh kết thúc với exit code 0.

| Lệnh | Kết quả | Phạm vi đã xác nhận | Không xác nhận |
|---|---|---|---|
| `npm run test:logout` | **PASS** | Layout và dashboard render an toàn khi session đã bị xóa. | Không gọi API logout, không xác nhận cookie/token bị thu hồi. |
| `npm run test:permissions` | **PASS** | Điều hướng mặc định của 6 role, các đích self-service, redirect theo role và từ chối redirect ngoài/không hợp lệ. | Không gọi API với JWT để xác nhận authorization backend. |
| `npm run test:leave-rules` | **PASS** | Tính ngày làm việc, bỏ Chủ nhật, từ chối khoảng chỉ có Chủ nhật/ngày quá khứ và định dạng giờ Việt Nam. | Không tạo đơn qua API/database, không kiểm tra upload hoặc overlap DB. |
| **Tổng script tự động** | **3 PASS / 0 FAIL** | Các assertion trong ba script trên đều đạt. | Đây không phải kết quả PASS cho toàn bộ 80 testcase chức năng bên dưới. |

### Trạng thái 80 testcase chức năng

Chưa chạy các ca end-to-end/API cần backend và database trong phiên xác minh này. Các ca đó được để **Chưa chạy**, không suy diễn PASS từ các script frontend.

| Nhóm testcase | Số ca | Kết quả hiện tại |
|---|---:|---|
| AUTH-01–AUTH-14 | 14 | Chưa chạy |
| PERM-01–PERM-07 | 7 | Chưa chạy tích hợp backend |
| ACC-01–ACC-08 | 8 | Chưa chạy |
| HR-01–HR-08 | 8 | Chưa chạy |
| SELF-01–SELF-06 | 6 | Chưa chạy |
| LEAVE-01–LEAVE-10 | 10 | Chưa chạy tích hợp backend |
| PAY-01–PAY-10 | 10 | Chưa chạy |
| CME-01–CME-09 | 9 | Chưa chạy |
| FILE-01–FILE-02 | 2 | Chưa chạy |
| NOTI-01–NOTI-02 | 2 | Chưa chạy |
| READ-01–READ-03 | 3 | Chưa chạy |
| Health check (SYS-01) | 1 | Chưa chạy |
| **Tổng** | **80** | **0 PASS / 0 FAIL / 80 Chưa chạy** |

Khi thực thi từng ca, cập nhật trạng thái tại nhóm tương ứng và ghi actual result, ngày chạy, người chạy, môi trường, fixture đã dùng và đường dẫn bằng chứng đã xóa thông tin bí mật. Dùng **Blocked** nếu môi trường/fixture chưa sẵn sàng; chỉ đổi sang **Pass** hoặc **Fail** sau khi chạy đúng các bước của testcase.

## 6. Giới hạn phạm vi đã biết

- API chấm công và một số API payroll/compliance hiện là endpoint đọc dữ liệu; không xem việc có bảng/model là đã có quy trình nghiệp vụ.
- Kỳ payroll hiện tạo/xem kỳ; testcase không giả định hệ thống đã tính lương, chốt lương hoặc phát payslip.
- Nghỉ phép hiện cho nhân viên xem/tạo/thu hồi đơn; testcase không giả định có luồng quản lý phê duyệt.
- Notification hiện có danh sách và đánh dấu đã đọc; testcase không giả định hệ thống tự tạo/gửi thông báo.
- Upload avatar có giới hạn riêng 2 MB; upload file chung và file đính kèm nghỉ phép có giới hạn/validation riêng.
- Test frontend tự động không chứng minh được quyền truy cập, dữ liệu SQL, gửi email, refresh cookie hoặc thu hồi session end-to-end. Những mục đó cần chạy testcase tích hợp với backend.
