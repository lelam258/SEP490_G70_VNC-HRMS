# Chạy nhập chấm công theo Report 3

Phạm vi của phần này là HR Staff đọc tệp máy chấm công, liên kết mã máy, xem trước, xử lý lỗi và lưu công chưa xác nhận. Màn/API cấp quyền nhập bổ sung riêng đã được gỡ theo yêu cầu để phần quản lý kỳ và vai trò Accountant do người khác phụ trách.

## Hiểu màn hình 450 dòng chờ xử lý

450 dòng không đồng nghĩa với 450 lỗi phải sửa riêng. Với tệp tháng 10, có 15 mã máy, mỗi mã xuất hiện ở 30 ngày. Nếu chưa có liên kết nhân viên thì cùng một vấn đề được lặp ở 30 dòng của mỗi mã. Cần đối chiếu 15 mã một lần, không sửa nhân viên lần lượt trên 450 ngày công.

Màn xem trước hiện tách ba điều kiện:

1. **Nhân viên:** số mã đã liên kết, số mã còn chờ và số dòng chịu ảnh hưởng. Có thể chọn mã, xem nguyên văn khối nhân viên trong tệp, chọn hồ sơ, ghi căn cứ và xác nhận ngay tại đây. Sau lưu, hệ thống đọc lại tệp đang giữ, không yêu cầu chọn tệp lần nữa.
2. **Giờ nguồn:** vẫn thấy 317 dòng đủ cặp giờ, 59 dòng thiếu giờ và 74 dòng không có lượt chấm ngay cả khi chưa liên kết nhân viên. Đủ cặp giờ chưa đồng nghĩa với công hợp lệ; giờ Vào/Ra là thời lượng từ nguồn, chưa phải giờ trả lương.
3. **Kỳ cho phép lưu:** khóa kỳ là điều kiện riêng. Có thể hoàn thành liên kết và xem lỗi trong kỳ khóa, nhưng không lưu chấm công vào kỳ đó trước khi module quản lý kỳ cho phép.

Không tự điền cho đủ 59 dòng thiếu giờ. Cần đối chiếu bằng chứng; những ngày không có lượt chấm cũng không tự trở thành ngày đã làm hoặc nghỉ phép được duyệt.

## Khi nào coi phần nhập chấm công đã hoàn thiện?

| Tiêu chí kiểm tra | Kết quả cần đạt |
| --- | --- |
| Đọc đúng tệp thật | Nhận đủ 450 dòng, 15 mã máy và ngày 01–30/10/2026; không đọc nhầm ngày M/D/YYYY hoặc dòng tổng hợp |
| Xác định đúng người | Liên kết theo từng mã, có chọn nhân viên, căn cứ, xác nhận và audit; không đoán theo tên; kiểm tra lại toàn bộ dòng của mã |
| Phân biệt vấn đề | Lỗi liên kết, chất lượng giờ nguồn, nghỉ phép/lịch/cơ sở và khóa kỳ được giải thích riêng |
| Lưu trong kỳ đang mở | Tạo đợt nhập, kiểm tra lại xung đột và lưu dòng được chọn vào công chưa xác nhận; giữ file và raw row |
| Xử lý dữ liệu không hợp lệ | Dòng thiếu/sai giờ cần bằng chứng; dòng lỗi hoặc trùng không tự được chấp nhận/ghi đè |
| Tôn trọng kỳ khóa | Vẫn xem trước được, nút lưu giải thích vì sao bị chặn và API từ chối ghi |
| Không ảnh hưởng phần khác | Không tạo/mở/đóng kỳ lương, không thay chức năng Accountant hoặc tự tính lương |

Để trình bày luồng lưu thành công, dùng dữ liệu giả lập của kỳ đang mở trên database thử. Không đổi ngày trong tệp thật hoặc bỏ khóa kỳ để làm mẫu. Bộ kiểm thử tự tạo một tệp tổng hợp có danh tính giả cho kỳ đang mở, thử tạo đợt nhập và lưu cảnh báo vào hàng chờ xác nhận, rồi dọn toàn bộ dữ liệu thử. Việc tệp tháng 10 bị chặn lưu ở ngày 09/11 không đồng nghĩa bộ đọc hoặc chức năng nhập hỏng.

## 1. HR Staff liên kết mã máy

Đăng nhập HR Staff, mở [Mã máy chấm công](http://localhost:5173/attendance/device-mappings).

- Ưu tiên liên kết ngay trong kết quả đọc tệp; hoặc chọn đúng nhân viên theo hồ sơ đăng ký trên máy tại trang danh sách, nhập mã máy và căn cứ đối chiếu.
- Bấm **Kiểm tra liên kết**, tích xác nhận rồi lưu.
- Không coi StaffCode là mã máy, không suy đoán người theo tên. Mã 0001 và 1 được coi là cùng mã.
- Khi chuyển mã sang người khác, xác nhận xóa liên kết cũ trước. Mọi thay đổi có audit và phiên bản; dữ liệu chấm công đã lưu giữ nguyên nhân viên.

Administrator/HR Manager chỉ tra cứu danh sách liên kết; HR Staff thực hiện thay đổi.

## 2. Đọc và xem trước tệp

Mở [Nhập tệp chấm công](http://localhost:5173/attendance/imports/new):

1. Chọn cơ sở thực tế, tháng và tệp Excel.
2. Bấm **Đọc tệp và xem trước**. Đây là phân tích không lưu, vẫn dùng được khi tháng đang khóa.
3. Nếu ngày trong tệp thuộc tháng khác, chọn **Dùng tháng ...** để kiểm tra đúng tháng nguồn. Tháng được nhận diện từ nội dung, không từ tên tệp.
4. Kiểm tra các dòng, nhân viên, cặp Vào/Ra, giờ máy báo, phút trễ/sớm và ký hiệu. Có thể lọc lỗi, phân trang và xem dữ liệu gốc.
5. Nếu kỳ đang mở theo quy trình quản lý kỳ hiện có, chọn **Tạo đợt nhập**, xử lý lỗi/trùng có căn cứ rồi xác nhận lưu các dòng đủ điều kiện.

Mặc định chỉ lưu dòng valid. HR phải chủ động chọn thêm warning nếu muốn đưa chúng vào hàng chờ đối chiếu; bản ghi mang trạng thái flagged, chưa xác nhận và chưa được dùng tính lương. Không tự điền giờ ra, đoán nghỉ phép từ ký hiệu, tạo công cho ngày không có lượt chấm hay ghi đè công đã có.

## Kỳ đã khóa

Phần nhập vẫn đọc trạng thái khóa và tuân theo GB-51/GB-59. Việc mở/điều chỉnh kỳ thuộc chức năng Accountant/quản lý kỳ hiện có của nhóm phụ trách; phần chấm công không có màn hay API cấp phép riêng, không tự sửa PayrollLock, bảng công tháng, phiếu lương hoặc tệp ngân hàng.

Với tháng 10/2026 ở ngày 09/11/2026, hạn nhập thường lệ đã qua ngày 05/11. Có thể đọc và xem lỗi tệp, nhưng không thể lưu trước khi kỳ đủ điều kiện theo quy trình quản lý kỳ. Gỡ màn nhập bổ sung không bỏ quy tắc khóa kỳ.

Audit cũ, dữ liệu kỳ và dữ liệu chấm công hiện có không bị xóa khi gỡ chức năng.

## Các tệp đã đối chiếu

- THÁNG 10.2026 (1).xlsx: 15 mã máy, 450 dòng từ 01–30/10/2026; 317 dòng đủ cặp giờ nhưng tổng máy báo khác thời lượng vào/ra, 59 dòng thiếu giờ và 74 dòng không có lượt chấm. Không tự tạo thêm ngày 31/10.
- THÁNG 8.2026.xlsx: 17 mã máy, 527 dòng từ 01–31/08/2026; 295 dòng đủ giờ nhưng lặp cặp, 62 dòng thiếu giờ và 170 dòng không có lượt chấm.

Mẫu máy dùng ngày M/D/YYYY và tiêu đề Vào/Ra hai dòng. Có thể chọn Tự nhận diện hoặc Tháng/ngày/năm. Kết quả chất lượng nguồn không thay thế kiểm tra mã máy, thời gian công tác, nghỉ phép và lịch cơ sở.

## Khởi động khi ứng dụng chưa chạy

```powershell
# Terminal backend
cd backend
dotnet run --launch-profile http -- --OpenBrowser=false
```

```powershell
# Terminal frontend
cd frontend
npm run dev
```

Backend tại http://localhost:5100, frontend tại http://localhost:5173. Việc gỡ màn/API không thay đổi schema, không cần migration mới và không đổi tài khoản/role của người dùng.

## Kiểm thử

```powershell
dotnet run --project tests/AttendanceWorkflows/AttendanceWorkflows.csproj -c Release -- --live-import-workbook '<đường dẫn THÁNG 10.2026 (1).xlsx>' 2026-10
```

Lệnh dùng database riêng VNC_Attendance_Test_<guid>, API/Vite trên cổng riêng và Chrome với API thật. Nó kiểm tra đọc tệp không lưu, nhận diện tháng, bảo vệ kỳ khóa, liên kết mã máy, API cấp phép cũ trả 404 và quyền truy cập màn Accountant hiện có. Database/tiến trình thử được dọn sau khi chạy. Nhập và commit kỳ đang mở được kiểm tra bằng fixture ngày/giờ kiểm soát trong cùng bộ backend. Tệp thật không bị sửa hoặc đưa dữ liệu riêng vào fixture của repository.

Kết quả sau khi bổ sung hướng dẫn theo mã nhân viên: 155 kiểm tra backend/SQL/HTTP và 14 kiểm tra Chrome qua API thật đạt, gồm liên kết ngay trên màn xem trước và tạo/lưu thành công bằng tệp giả lập của kỳ đang mở. Build frontend đạt. Không tự gán mã hoặc tạo dữ liệu chấm công trên database nghiệp vụ.
