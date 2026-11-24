# Test GB-12 qua import chấm công

GB-12 tách OT khỏi trực trưa/trực tối. OT chỉ lấy khoảng có bằng chứng Vào/Ra thực tế nằm trong 17:00–19:00, cộng đủ mỗi 30 phút thành 0,5 giờ, tối đa 2 giờ/ngày. Ngày có lịch trực tối đã công bố hoặc hồ sơ trực tối chưa bị hủy/từ chối không được cộng OT. Giờ trước 17:00, sau 19:00, nghỉ trưa và khoảng trống giữa hai cặp chấm không được tự cộng vào OT. Không lấy tổng giờ làm trừ 8 để tính OT.

## Tệp thử

Tệp giả lập có sẵn ở `.local/gb12-import/GB12_OT_2026-11.xlsx`, mã máy mặc định `40001`. Chọn nhân viên thử nghiệm có ngày vào làm trước 16/11/2026 rồi liên kết mã máy `40001` với nhân viên này, hoặc tạo lại file bằng đúng mã máy đã có:

```powershell
dotnet run --project tests/AttendanceWorkflows/AttendanceWorkflows.csproj -c Release -- --create-ot-fixture .local/gb12-import 40001
```

Tham số cuối là mã máy muốn dùng. Không liên kết lại một mã máy đang thuộc người khác để thử. Dùng cơ sở đang hoạt động và không có đơn nghỉ đã duyệt hoặc bản ghi chấm công cùng ngày/ca. Đây là dữ liệu giả lập, không phải bằng chứng để trả lương thực tế.

## Chuẩn bị lịch

1. Phân lịch sáng và chiều cho nhân viên thử tại cùng cơ sở cho 16–23/11/2026, rồi công bố lịch. Chọn các giờ theo ca mùa đông của hệ thống.
2. Riêng 23/11/2026 thêm ca trực tối và công bố. Các ngày 16–22/11 không phân trực tối, không có hồ sơ trực tối.
3. Tháng 11/2026 phải đang mở. Khi kiểm tra vào 24/11/2026, mọi giờ trong tệp đã diễn ra. Nếu tháng đã khóa/quá hạn thì cần kỳ kiểm thử đủ điều kiện hoặc tạo dữ liệu ngày phù hợp; không thay đổi khóa kỳ thật để chạy mẫu.

## Nhập và kiểm tra

Đăng nhập **HR Staff**, vào **Chấm công → Nhập tệp mới** (`/attendance/imports/new`). Chọn cơ sở vừa phân lịch, tháng **11/2026**, file mẫu. Ngày trong mẫu là ISO nên có thể chọn tự nhận diện. Bấm **Đọc tệp và xem trước**, kiểm tra cặp sáng `07:10–11:45`, cặp chiều `13:30–giờ ra` và cột **OT dự kiến**:

| Ngày | Giờ ra | Trực tối trong ngày | OT dự kiến |
| --- | --- | --- | ---: |
| 16/11 | 17:00 | Không | 0 |
| 17/11 | 17:29 | Không | 0 |
| 18/11 | 17:30 | Không | 0,5 |
| 19/11 | 17:59 | Không | 0,5 |
| 20/11 | 18:00 | Không | 1 |
| 21/11 | 18:45 | Không | 1,5 |
| 22/11 | 20:00 | Không | 2 |
| 23/11 | 18:30 | Có | 0 |

Ngày 23/11 phải hiện **Có ca trực tối: không tính OT**. Nếu chưa khớp mã máy hoặc có lỗi ngày/giờ thì cột hiển thị `—`, chưa đủ điều kiện kết luận OT. Nếu không phân lịch, dữ liệu có thể là cảnh báo; giải quyết đúng nguồn/cơ sở trước khi xác nhận.

Tạo đợt nhập rồi lưu các dòng đủ điều kiện. Import chỉ lưu bản ghi chưa xác nhận: tổng OT dùng tính công/lương vẫn là **0** cho những dòng này. Mở từng bản ghi, đối chiếu bằng chứng khi cần rồi **Xác nhận**. Sau khi xác nhận đủ 8 dòng, mở **Chốt công tháng**, chọn tháng 11/2026, tìm nhân viên thử: tổng OT mong đợi **5,5 giờ**. Ca trực tối theo lịch có thể còn là ngoại lệ chờ hồ sơ trực; hoàn tất nghiệp vụ trực riêng trước khi chốt cả tháng.

Kiểm tra thêm: đang xem preview mà thêm/công bố lịch trực tối cho một ngày đang có OT, rồi đọc lại preview: OT của ngày đó về 0. Gửi commit bằng version preview cũ phải bị 409. Đổi lịch cần tuân thủ cửa sổ chỉnh lịch; tình huống này được regression dựng thời gian/dữ liệu riêng khi kiểm thử tự động.

## Kiểm thử tự động

```powershell
dotnet run --project tests/AttendanceWorkflows/AttendanceWorkflows.csproj -c Release -- --parser-only
dotnet run --project tests/AttendanceWorkflows/AttendanceWorkflows.csproj -c Release
```

Lệnh đầu kiểm tra các mốc OT, gộp bằng chứng và loại ca trực mà không cần SQL. Lệnh sau dùng SQL Server localhost, tạo database kiểm thử riêng và xóa sau khi chạy; bao phủ import → preview → commit → verify → tổng hợp tháng và thay đổi lịch trực sau preview.

Không cần migration cho thay đổi này. `OT dự kiến` là kết quả tính từ dữ liệu nguồn và lịch hiện hành; chỉ bằng chứng đã HR xác nhận mới được tính vào tổng OT chấm công. Phạm vi hiện tại chỉ gồm import và tổng hợp chấm công; logic tính lương giữ nguyên, chưa tích hợp GB-12 vào payroll.
