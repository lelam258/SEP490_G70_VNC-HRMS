# Chức năng tài khoản và chấm công theo Report 3

Đối chiếu `VNC_HRMS_Report3_BanSua.docx`, phần II. Các màn và API dưới đây dùng chung xác thực JWT, phiên SQL và sáu vai trò hiện có.

Hướng dẫn đọc tệp, liên kết mã máy và xử lý kỳ khóa: [ATTENDANCE_IMPORT_RUNBOOK.md](ATTENDANCE_IMPORT_RUNBOOK.md). Màn và API cấp quyền nhập bổ sung riêng đã được gỡ theo yêu cầu; quản lý kỳ/Accountant thuộc phần do người khác phụ trách. Phần chấm công chỉ kiểm tra trạng thái kỳ, không tự mở hoặc đóng kỳ.

Màn phân tích gom các ngày chưa khớp nhân viên theo mã máy để xử lý một lần, cho phép liên kết ngay tại màn xem trước và giữ tệp đã chọn. Chất lượng giờ nguồn được hiển thị độc lập với việc đã liên kết nhân viên hay chưa; khóa kỳ là điều kiện riêng. Không trình bày 450 dòng cùng thiếu liên kết như 450 lỗi độc lập.

| Mục đặc tả | Chức năng | Giao diện | API chính |
| --- | --- | --- | --- |
| II.1.8 | Activate / Deactivate User Account | Chi tiết tài khoản `/accounts/:id`, có hộp xác nhận; màn sửa tài khoản xác nhận thay đổi quyền truy cập | `POST /api/users/:id/status` |
| II.1.9 | Role Management | `/roles`: danh mục vai trò, mô tả, phạm vi chức năng, số tài khoản và gán vai trò có xác nhận | `GET /api/roles`; `POST /api/users/:id/role` |
| II.1.10 | Audit Log Viewer | `/audit-logs`: lọc ngày, phân hệ, người thao tác, hành động, cơ sở; phân trang và xem chi tiết trước/sau | `GET /api/audit-logs`, `/options`, `/:id` |
| II.4.5 | Assign Employee to Facility / Shift | `/schedules`: phân công ngày/tuần, xem lịch/nghỉ phép trước lưu, đồng ý điều chuyển | `POST /api/schedules/assignments`, `/assign-week`; `GET /availability` |
| II.4.6 | Attendance Import | `/attendance/imports/new`: phân tích không lưu, chọn tháng từ ngày trong tệp, rồi chủ động tạo đợt nhập; mã máy cấu hình tại `/attendance/device-mappings` | `POST /api/attendance/imports/analyze`, `/imports` (multipart); `GET/POST /api/attendance/device-mappings` |
| II.4.7 | Attendance Import Preview | `/attendance/imports/:id/preview`: xem dữ liệu gốc, các cặp Vào/Ra và thống kê kiểm tra; xác nhận trước lưu | `GET /api/attendance/imports/:id`; `POST /:id/commit` |
| II.4.8 | Attendance Import Error Results | `/attendance/imports/:id/errors`: lọc lỗi, xác nhận nhân viên, sửa ngày/giờ có căn cứ, chủ động loại dòng thừa và xuất lỗi ẩn danh | `PUT /api/attendance/imports/:id/rows/:rowId`; `POST /:id/rows/:rowId/exclude`; `GET /:id/errors.csv` |
| II.4.9 | Attendance Record List | `/attendance/records`: tháng, cơ sở, khoa/phòng, nhân viên, tìm kiếm, nguồn và trạng thái | `GET /api/attendance/records` |
| II.4.10 | Attendance Details | `/attendance/records/:id`: ba cặp vào/ra, nguồn, mã máy, lịch liên quan, người/thời điểm đối chiếu và xác nhận | `GET /api/attendance/records/:id` |
| II.4.15 | Create On-Call Shift Record | `/attendance/on-call/new`: giờ thực tế, lịch đã công bố, bằng chứng chấm công và xác nhận quản lý | `POST /api/attendance/on-call-shifts`; `GET /api/attendance/on-call-context` |
| II.4.16 | Edit On-Call Shift Record | `/attendance/on-call/:id/edit`: chỉ sửa hồ sơ pending, bắt buộc lý do và phiên bản mới nhất | `PUT /api/attendance/on-call-shifts/:id` |
| II.4.17 | Attendance / Shift History | `/attendance/history`: lọc nghiệp vụ, xem trạng thái trước/sau, mở nguồn có quyền và xuất lịch sử theo phạm vi | `GET /api/attendance/history`, `/options`, `/:id`, `/export.csv` |

## Quy tắc đã áp dụng

- Kích hoạt/ngừng tài khoản và đổi vai trò giữ nguyên tài khoản, ghi audit, tăng security version và thu hồi phiên/OTP. Chặn tự hạ quyền/ngừng tài khoản và chặn mất Administrator hoạt động cuối cùng. Request sửa quyền phải có rowversion hiện tại.
- Vai trò và phạm vi chức năng do ứng dụng định nghĩa; giao diện chỉ gán các vai trò có sẵn. Nhật ký hệ thống chỉ dành cho Administrator; HR Manager xem lịch sử nghiệp vụ chấm công qua quyền riêng.
- Audit chỉ có API đọc. Mật khẩu, hash, token, OTP, thông tin liên hệ, ngân hàng, bệnh nhân và trường lương nhạy cảm được che khi trả về. Lịch sử lịch làm việc cũ được đọc từ `ScheduleChanges`; sự kiện mới được lưu đồng thời với audit và không xuất hiện hai lần.
- Nhân viên chỉ đọc chấm công cá nhân. Department Manager đọc dữ liệu thuộc khoa của bản ghi tại thời điểm ghi nhận; việc nhân viên chuyển khoa không làm lộ lịch sử của khoa khác. Chỉ HR Staff được nhập, sửa dòng nhập hoặc tạo/sửa ca trực.
- Bộ đọc nhận Excel `.xlsx` và binary `.xls`, tối đa 10 MB, 10.000 dòng ngày công. Nhận diện khối `Mã nhân viên`, danh sách có cột mã, ngày đầy đủ hoặc số ngày và tối đa ba cặp Vào/Ra. Giờ máy báo, đi muộn/về sớm và ký hiệu được giữ để đối chiếu; không coi tổng đầu bảng là công được trả lương.
- Mã máy chỉ được ánh xạ khi khớp duy nhất với `Staff.DeviceEnrollId`. Không suy đoán theo tên. Mã số được chuẩn hóa số 0 đầu để phát hiện trùng/không rõ danh tính.
- HR Staff có màn liên kết mã máy riêng, bắt buộc chọn nhân viên, căn cứ, xác nhận và phiên bản; các thay đổi được audit. Phân tích tệp không tạo bản ghi database và vẫn dùng được khi kỳ đang khóa. Khóa kỳ là trạng thái riêng, không thay thế phân loại lỗi từng dòng.
- Đợt nhập và từng dòng có bản dữ liệu gốc. Chưa có bản ghi chấm công trong bước staging. File lặp cùng cơ sở/tháng/ánh xạ mở lại đợt nhập cũ. Commit kiểm tra lại trùng nhân viên/ngày/ca, hoạt động nhân viên/khoa/cơ sở, thời gian công tác, nghỉ phép, lịch cơ sở và khóa kỳ trong transaction.
- Mặc định chỉ commit dòng valid. HR Staff có thể chủ động chọn thêm warning vào hàng chờ đối chiếu; chúng trở thành `flagged`, chưa xác nhận. Dòng sửa có lý do/người/thời điểm, giữ raw source và được gắn nguồn manual. Không ghi đè dòng đã lưu hoặc dữ liệu confirmed.
- Báo cáo lỗi CSV ẩn tên/mã nhân viên, khối nhân viên, tên sheet có thể định danh và vô hiệu hóa công thức Excel. File gốc chỉ được tải qua API có quyền.
- Ca trực thực tế phải thuộc loại trưa/tối, không qua ngày, không ở tương lai và không trùng ca/nghỉ phép. Giờ khác kế hoạch hoặc sửa hồ sơ cần lý do. Trực ngoài lịch/khác cơ sở cần căn cứ quản lý và xác nhận điều chuyển khi áp dụng; lịch gốc được giữ lại.
- Hồ sơ trực được tạo/sửa ở trạng thái pending. Kết thúc trực tối sớm thiếu căn cứ quản lý hoặc chưa khớp cặp chấm công được ghi rõ cần đối chiếu. Không dùng khoảng giờ vào đầu/ra cuối để bỏ qua khoảng trống giữa các cặp vào/ra.
- Khóa tháng theo GB-51: từ hết ngày 5 tháng kế tiếp dừng sửa thường lệ. Trong ngày 6–12 chỉ nhận kỳ unpaid được Accountant mở lại có audit; chặn tháng khóa/đã trả và hết cửa sổ điều chỉnh. Toàn bộ mốc theo giờ Việt Nam.

Các luồng đối chiếu, xác nhận ngày công và xác nhận tháng thuộc II.4.11–4.14, không nằm trong 12 mục được giao lần này. Dữ liệu nhập và hồ sơ trực mới được giữ chưa xác nhận cho các luồng đó tiếp nhận.

## Migration

`20261108085710_AttendanceAndAccountWorkflows` thêm bảng dòng nhập, bản file gốc, liên kết cơ sở/bằng chứng, rowversion hồ sơ trực và metadata audit. Migration phân loại audit cũ từ dữ liệu có sẵn và khởi tạo thời điểm cập nhật hồ sơ trực từ ngày tạo; giữ bản ghi nghiệp vụ và nội dung audit gốc.

Với database có đầy đủ lịch sử migration, trong `backend` chạy `dotnet ef database update`. Database local trước đó có cột bảo hiểm nhưng thiếu history của migration bảo hiểm; triển khai riêng thay đổi này bằng SQL tạo từ:

```powershell
dotnet ef migrations script 20261108081158_ScheduleSpecificationCompliance 20261108085710_AttendanceAndAccountWorkflows --project Backend.csproj --configuration Release --no-build --output ../.local/attendance-account-workflows.sql
```

## Kiểm thử

Chạy từ thư mục gốc:

```powershell
dotnet run --project tests/AttendanceWorkflows/AttendanceWorkflows.csproj -c Release
dotnet run --project tests/ScheduleIntegration/ScheduleIntegration.csproj -c Release
node --experimental-websocket tests/verify-attendance-admin-ui.mjs
```

Bộ backend tạo database duy nhất có tiền tố `VNC_Attendance_Test_`, kiểm thử nâng cấp schema cũ, dữ liệu thực qua SQL và HTTP/JWT/multipart, rồi xóa database do chính nó tạo. Bộ trình duyệt dùng Chrome headless và API fixture, cần Vite ở cổng 5173. File XLSX kiểm thử được tạo trong `.local/attendance-workflow-fixture.xlsx`, gồm dữ liệu giả lập hợp lệ và lỗi.

Trong `frontend`: `npm run build`, `npm run test:permissions`, `npm run test:business-rules`.

Đã kiểm thử các cấu trúc file được đặc tả, fixture XLS/XLSX và tệp máy chấm công thực tế `THÁNG 8.2026.xlsx` do người dùng cung cấp. Màn nhập hỗ trợ chọn cột và thứ tự ngày/tháng; phần đối chiếu tệp thực tế nằm bên dưới.

Kết quả sau đối chiếu tệp thực tế ngày 08/11/2026: 131 kiểm tra backend/SQL/HTTP và 30 kiểm tra Chrome pass; build backend/frontend thành công. Các bộ hồi quy ScheduleIntegration, quyền frontend và quy tắc frontend đã pass trong lần triển khai trước. Migration trước đó đã áp dụng vào `localhost/VNC_HRMS_Iteration1`, xác nhận giữ nguyên 29 dòng users và 129 phân công; các bảng chấm công/trực/import/audit ban đầu chưa có dữ liệu. Lần rà soát nhập tệp không thay đổi schema và không ghi dữ liệu thử vào database nghiệp vụ.

## Rà soát kỹ nhập tệp: II.4.6–II.4.8

| Vấn đề phát hiện | Hành vi sau khi sửa |
| --- | --- |
| `00:30` ở cột đi muộn bị hiểu là 0,5 phút; ô khoảng thời gian Excel có thể bị bỏ qua | Phân biệt đơn vị: giờ máy báo là giờ; đi muộn/về sớm là phút. `00:30` tương ứng 30 phút. Nhận cả chuỗi, ô ngày/giờ và ô duration Excel. Hiển thị phút và ký hiệu ngay trong bảng xem trước. |
| Tiêu đề của khối nhân viên sau giữ cột mã, cặp giờ hoặc tổng giờ từ khối trước | Thay bộ cột khi gặp tiêu đề ngày mới; lấy mã từ khối nhân viên mới. |
| Thiếu một cột Vào khiến các cột Ra bị ghép sai cặp | Ghép theo số thứ tự 1/2/3; cặp thiếu được giữ lại để báo lỗi. Cặp thứ tư hoặc tiêu đề mơ hồ bị từ chối thay vì mất dữ liệu. |
| Ô IN/OUT chứa cả ngày bị ép về ngày công, có thể che ca qua ngày | Giữ ngày của timestamp nguồn và kiểm tra cùng ngày. Không đoán số Excel nguyên `1` thành 01:00. Mã máy quá dài không được cắt rồi dùng để xác định nhân viên. |
| Nhiều dòng cùng nhân viên/ngày/ca: dòng đầu được tự chọn | Đánh dấu các dòng xung đột. HR phải đối chiếu và loại dòng thừa có lý do hoặc sửa theo bằng chứng trước khi lưu. |
| Nhân viên có lịch cùng cơ sở nhưng ở một ca khác vẫn có thể được coi là khớp | Đối chiếu cơ sở theo ca và khoảng giờ chấm công. Giờ không khớp loại ca vào hàng cảnh báo `shift_conflict`; khác cơ sở của ca liên quan là lỗi. |
| Xem trước hoặc CSV lỗi dùng kết quả cũ dù lịch, mã máy hoặc hồ sơ nhân viên đã đổi | Kiểm tra lại khi xem trước/xuất lỗi. Commit so sánh cả danh tính, giờ và kết quả kiểm tra hiện tại với bản đã xem. Nếu khác, trả 409, giữ nguyên các dòng và yêu cầu xem lại/xác nhận lại. |
| Ánh xạ thủ công cho phép dùng cùng cột cho nhiều trường | Kiểm tra ở cả giao diện và API: cần Ngày công, cột Vào/Ra và số cột riêng cho mỗi trường. |

### Cách dùng luồng nhập

1. HR Staff mở **Chấm công → Nhập tệp mới**, chọn cơ sở đang hoạt động, tháng và tệp máy chấm công `.xls`/`.xlsx`.
2. Để trống ánh xạ khi tệp có tiêu đề nhận diện được. Nếu dùng ánh xạ thủ công, khai báo cột Ngày công và toàn bộ cặp Vào/Ra cần đọc; cột mã có thể bỏ trống khi từng khối có `Mã nhân viên`.
3. Ở xem trước, kiểm tra nhân viên khớp mã máy, ngày, ba cặp giờ, tổng giờ và số phút muộn/sớm. Dùng **Dữ liệu gốc** hoặc **Tải tệp gốc** để đối chiếu.
4. Mở kết quả lỗi. Dòng thiếu/sai giờ hoặc thiếu ánh xạ cần **Điều chỉnh** với căn cứ. Với dòng lặp/thừa, chọn **Loại dòng**, ghi lý do và xác nhận. Dòng bị loại vẫn có thể xem trong bộ lọc **Đã loại khỏi đợt nhập**; **Khôi phục / điều chỉnh** yêu cầu căn cứ và kiểm tra lại toàn bộ.
5. Chọn lưu dòng đủ điều kiện và xác nhận đã kiểm tra ánh xạ. Cảnh báo chỉ được đưa vào hàng chờ đối chiếu khi HR chủ động chọn thêm; dòng lỗi/trùng/bị loại không được lưu. Nếu nguồn đối chiếu đổi, giao diện tải kết quả mới và yêu cầu xác nhận lại.
6. Mở bản ghi chấm công sau lưu. Trạng thái vẫn là **chưa xác nhận**; nhập tệp không xác nhận ngày công, không ghi đè bản ghi hiện có và không đưa công vào tính lương.

Loại dòng lưu người thao tác, thời điểm, lý do và audit; không xóa dòng nguồn hoặc bản ghi chấm công. Tệp gốc và raw row được giữ nguyên. Kỳ khóa chặn cả sửa, loại dòng và commit. Đợt chỉ có dòng bị loại mang trạng thái `excluded`, không hiển thị là nhập thành công.

Kiểm tra nhanh bộ đọc, không cần SQL:

```powershell
dotnet run --project tests/AttendanceWorkflows/AttendanceWorkflows.csproj -c Release -- --parser-only
```

29 kiểm tra parser/rules gồm XLS nhị phân, XLSX thực có định dạng số, timestamp, duration, ghép cặp thiếu cột, thay tiêu đề, ánh xạ trùng, thứ tự ngày/tháng và mẫu máy hai dòng tiêu đề. Bộ SQL còn kiểm tra trùng toàn bộ nhóm, loại/khôi phục dòng, phiên bản cũ, thay đổi cơ sở theo ca, đổi danh tính mã máy cùng trạng thái, rollback, giữ cặp nguồn lặp dưới dạng cảnh báo và bảo vệ bản ghi đã lưu. Bộ Chrome kiểm tra thao tác loại dòng có lý do, giữ dữ liệu sau lỗi, reload khi xung đột và bắt buộc xác nhận lại.

## Đối chiếu tệp thực tế THÁNG 8.2026.xlsx

Đọc trực tiếp tệp người dùng cung cấp, không sửa tệp và không nhập vào database nghiệp vụ. Tệp có một sheet, vùng A1:R649, 17 khối `Mã nhân viên` và 527 dòng ngày công. Tất cả ngày được chuẩn hóa về **01–31/08/2026**; đối chiếu 527 giá trị cột **Thứ** không có sai lệch. Mã máy được đọc từ 17 khối, chưa đồng nghĩa với đã khớp 17 hồ sơ nhân viên trong database.

Tệp dùng **M/D/YYYY**: `8/1/2026` là 01/08/2026, không phải 08/01/2026. Phiên bản đọc cũ lấy nhầm các ngày này thành nhiều tháng và nhận thừa 16 dòng `Tăng ca` giữa các khối. Phiên bản hiện tại suy ra thứ tự ngày từ các ngày không mơ hồ trong bảng, giữ tiêu đề Vào/Ra hai tầng, bỏ phần tổng hợp trước bảng ngày và nhận đúng cột `Trễ`, `Sớm`.

| Cột Excel | Nội dung / cách dùng |
| --- | --- |
| A | Ngày dạng M/D/YYYY |
| B | Thứ, dùng để đối chiếu kết quả đọc tệp thực tế |
| C/D, E/F, G/H | Ba cặp Vào/Ra; giữ đủ cặp gốc |
| I/J | Số phút trễ/sớm |
| L | Giờ máy báo, giữ riêng với thời lượng tính từ các cặp giờ |
| R | Ký hiệu máy, giữ nguyên |
| K, M, N–Q | Về trễ, Công, T.Ca1–4 vẫn nằm trong raw row để tra cứu; không dùng làm công/lương đã xác nhận |

| Chất lượng giờ trong nguồn | Số dòng | Xử lý |
| --- | ---: | --- |
| Đủ giờ nhưng lặp cặp Vào/Ra giống hệt nhau | 295 | `warning`, mã `repeated_time_pairs`; thời lượng chỉ tính mỗi khoảng giống hệt một lần, giữ toàn bộ cặp nguồn và giờ máy báo. Không có dòng nào tự trở thành `valid`. |
| Có giờ vào/ra bị thiếu | 62 | Lỗi; phải bổ sung bằng chứng và điều chỉnh hoặc loại khỏi đợt nhập. Không tự điền giờ ra. |
| Không có lượt chấm | 170 | Giữ dòng và ký hiệu nguồn trong kết quả lỗi; không tự tạo ngày công, gán nghỉ phép hoặc xác nhận vắng mặt. |

Tổng 295 + 62 + 170 = 527. Có 132 dòng ghi phút trễ và 148 dòng ghi phút sớm khác 0; cả hai cột đã được đọc đúng. Các ký hiệu `XX`, `XXX`, `VVV`, `OOO`… không được tự quy đổi thành ngày công/lương. Tất cả 295 dòng đủ giờ cũng có tổng giờ máy báo khác thời lượng tính trên khoảng chấm duy nhất; vì vậy cần đối chiếu cách cấu hình ca của máy trước bước xác nhận công.

Chỉ HR chủ động chọn **Lưu thêm dòng cảnh báo vào hàng chờ đối chiếu** mới có thể lưu những dòng cảnh báo đã vượt qua các kiểm tra nhân viên/cơ sở/kỳ. Bản ghi sau đó mang trạng thái `flagged`, chưa xác nhận, giữ các cặp gốc và không được dùng tính lương. Cặp chồng nhau nhưng khác thời điểm không được coi là cặp lặp; chúng vẫn là lỗi. Các dòng thiếu giờ không được chuyển thành cảnh báo chỉ vì lặp cùng một giá trị thiếu.

Khi dùng mẫu này, chọn tháng **2026-08**, cơ sở thực tế và định dạng **Tháng / ngày / năm (M/D/YYYY)**; không cần chọn cột thủ công. Chế độ tự nhận diện cũng đọc đúng toàn bộ tệp này. Nếu tệp rút gọn chỉ còn ngày như `8/1/2026` và không có ngày đủ rõ để xác định thứ tự, hệ thống giữ ngày ở kết quả lỗi cho đến khi HR chọn định dạng hoặc sửa có căn cứ. Tên tệp và tháng người dùng chọn không được dùng để ép một ngày mơ hồ thành ngày hợp lệ.

Thứ tự ngày được lưu cùng cấu hình ánh xạ của đợt nhập và tham gia nhận diện lần nhập lặp; thay lựa chọn không ghi đè đợt cũ. Thay đổi này không cần migration. Quy tắc khóa kỳ vẫn áp dụng: tại ngày 08/11/2026, tháng 08/2026 đã qua hạn nhập/sửa thường lệ và cửa sổ điều chỉnh GB-59. Kiểm tra tệp không mở lại kỳ hoặc bỏ qua khóa.

Lệnh đọc kiểm chứng trực tiếp, không dùng SQL và chỉ xuất thống kê ẩn danh:

```powershell
dotnet run --project tests/AttendanceWorkflows/AttendanceWorkflows.csproj -c Release -- --review-workbook '<đường dẫn THÁNG 8.2026.xlsx>' 2026-08
```

Bộ kiểm thử SQL dùng mẫu cấu trúc tương đương với tên và mã giả, chạy tháng đang mở bằng đồng hồ kiểm thử, rồi xóa database do nó tạo. Không đưa tên nhân viên, mã máy hoặc nội dung riêng của tệp thật vào fixture được lưu trong repository.
