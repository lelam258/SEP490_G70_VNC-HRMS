# Business Rules theo màn hình

Rà soát ngày 06/11/2026 dựa trên route, form, DTO, controller, service, repository, ràng buộc database và test hiện có. Đây là mô tả hành vi của mã nguồn; các chính sách chưa có yêu cầu rõ ràng được ghi riêng ở cuối, không được xem là đã triển khai.

## 1. Danh mục màn hình

Các trang danh sách, tạo, chi tiết và sửa dùng chung một nhóm quy tắc. Các trang chuyển hướng/wrapper không tạo nghiệp vụ riêng.

| Màn hình / route | Business Rules đã có | Phần thiếu được bổ sung trong lần rà soát |
| --- | --- | --- |
| Đăng nhập `/login` | Tài khoản đã cấp, active; xác minh mật khẩu; khóa tạm khi nhập sai; quản lý phiên và refresh token | Không thay đổi luồng xác thực |
| Quên / đặt lại / đổi mật khẩu `/forgot-password`, `/reset-password`, `/change-password` | OTP có hạn dùng, số lần thử và chỉ dùng một lần; chính sách mật khẩu; thu hồi phiên | Không thay đổi; không có chức năng tự đăng ký |
| Tài khoản `/accounts`, `/accounts/new`, `/accounts/:id`, `/accounts/:id/edit` | Admin; username/email không xung đột; liên kết nhân viên; bảo vệ admin cuối cùng và chính tài khoản đang dùng; rowversion | Ghi nhận các quy tắc hiện có; không thay đổi quyền |
| Nhân viên `/employees`, `/employees/:id`, `/employees/:id/edit` và modal tạo/sửa | HR Manager; mã duy nhất khi tạo; chỉ phân sang khoa đang hoạt động; tài khoản dự trữ | Kiểm tra trùng mã khi sửa, email/CCCD khi tạo hoặc sửa; đồng nhất quy tắc tên/ngày sinh/giới tính/điện thoại với hồ sơ cá nhân; thời gian công tác và số người phụ thuộc |
| Khoa/phòng `/departments` | HR Manager; mã/tên bắt buộc, giới hạn độ dài; trạng thái active/inactive | Kiểm tra mã/tên trùng, loại trừ bản ghi đang sửa; trim trước validation; transaction cho kiểm tra và lưu |
| Hồ sơ cá nhân `/me/profile` | Chỉ hồ sơ liên kết với user; tên, tuổi, giới tính, CCCD, điện thoại; CCCD duy nhất; avatar tối đa 2 MB | Avatar chỉ chấp nhận JPG/PNG, không nhận PDF qua dịch vụ upload tài liệu chung |
| Đơn nghỉ `/me/leave-requests`, `/new`, `/:id/edit` | Đúng chủ sở hữu; loại nghỉ active; chỉ sửa/thu hồi pending; không chồng lấn pending/approved; ngày tương lai, bỏ Chủ nhật; lý do 10–500 ký tự; tệp tối đa 10 MB | Ngày nghỉ phải trong thời gian công tác; khoa/phòng đang hoạt động; kiểm tra pending và thu hồi trong cùng transaction |
| Lịch làm việc `/schedules` | HR Staff quản lý; không trùng nhân viên/ngày/ca; đồng ý khi điều chuyển cơ sở; bảo vệ ca đã ghi nhận trực; nhân viên chỉ thấy lịch cá nhân đã công bố | Lập tuần kế tiếp từ thứ Hai tuần trước; chốt lần đầu trước ca sáng thứ Hai của tuần được phân công; tách điều chỉnh có lý do mở lại; kiểm tra thời gian công tác và trạng thái khoa khi chốt |
| Hợp đồng `/contracts`, `/new`, `/:id`, `/:id/edit` | HR Manager; số hợp đồng duy nhất; thời hạn theo loại; nhân viên active; không chồng lấn hợp đồng active; bảo vệ kỳ lương khóa và lịch sử điều chỉnh | Giữ nguyên các quy tắc trong `ContractRules` và `ContractService` |
| Đãi ngộ `/payroll/compensation` | Accountant; kiểu lương/ngày công/bảo hiểm; lịch sử điều chỉnh; phụ cấp trong thời hạn hợp đồng; tránh chồng lấn; bảo vệ kỳ đã khóa | Giữ nguyên các kiểm tra hiện có |
| Tham số lương `/payroll/parameters` và các form con | Accountant; enum, giá trị tiền/tỷ lệ, ngày hiệu lực; tránh trùng/chồng lấn cấu hình; bảo vệ kỳ khóa; audit | Giữ nguyên `PayrollParameterRules`, `PayrollParameterService`, `PayrollFormula` |
| Kỳ lương `/payroll/periods`, `/:month` | Accountant; tháng duy nhất; tạo trạng thái open và hiển thị draft; chi tiết kỳ | Xác thực tháng bằng lịch thực, loại năm `0000` ngoài kiểm tra biểu thức chính quy |
| Phiếu thủ thuật `/procedures`, `/new`, `/:id`, `/:id/edit`, `/payroll/procedures` | Người tạo sửa phiếu chưa duyệt; HR kiểm tra; Kế toán xác minh; kỳ khóa không được sửa; quy tắc hoa hồng và phân quyền dữ liệu | API bắt buộc đúng thứ tự duyệt; không lặp nhân viên cùng vai trò; nhân sự active và trong thời gian công tác; validation đồng nhất với preview; transaction bắt đầu trước khi đọc trạng thái; lookup chỉ đọc dịch vụ đang hoạt động, không tự tạo/kích hoạt dữ liệu mẫu |
| Bằng cấp/chứng chỉ `/certificates`, `/me/certificates` và modal | Chủ sở hữu ở self-service; bản tự nộp chờ thẩm định; kiểm tra ngày cấp/hết hạn, số hiệu; bằng cấp không áp dụng CME | Category tường minh được ưu tiên hơn suy đoán tên; enum trạng thái và định mức CME hợp lệ; không cắt JSON metadata; không thẩm định lại bản đã xử lý; không xóa hoặc đổi định mức làm mất lịch sử CME khóa |
| CME `/cme-records`, `/me/cme-records` và modal | Đúng chứng chỉ/chủ sở hữu; tên khóa học; ngày hoàn thành; bước tín chỉ 0.5; tổng nhập không vượt chỉ tiêu; tự nộp chưa verified | Cycle ID phải thuộc chứng chỉ; khóa cả nguồn và đích khi di chuyển bản ghi; cấm thay đổi verified của chu kỳ khóa; chỉ tín chỉ đã xác minh được tính hoàn thành; lưu bản ghi và tính lại tổng trong cùng transaction; UI chỉ báo khóa khi API thành công |
| Tuân thủ `/compliance` | Lọc báo cáo, cảnh báo chứng chỉ/CME; department head giới hạn khoa; tạo nhắc nhở trong ứng dụng | Dùng số liệu verified đã được sửa ở nghiệp vụ CME; không bổ sung ngưỡng hoặc lịch nhắc chưa được quy định |
| Trang chủ `/` | Nội dung theo vai trò; số liệu kế toán từ API được phân quyền | Không có thao tác ghi cần thêm Business Rules |
| Không tìm thấy / chuyển hướng | Kiểm tra đăng nhập/role và đích chuyển hướng nội bộ | Không có nghiệp vụ ghi độc lập |

Nguồn route: [AppRoutes.tsx](../frontend/src/routes/AppRoutes.tsx). Quyền API và quyền truy cập màn hình cần xem riêng; frontend guard không thay thế backend.

## 2. Quy tắc bổ sung và kết quả khi vi phạm

### Nhân viên và khoa/phòng

| ID | Quy tắc | Kết quả |
| --- | --- | --- |
| BR-DEPT-01 | Mã khoa được trim, viết hoa, tối đa 20 ký tự; tên trim, tối đa 100 ký tự; không rỗng sau trim | 400 |
| BR-DEPT-02 | Mã và tên khoa là duy nhất theo collation database, kể cả khoa inactive; khi sửa bỏ qua chính bản ghi đó | 409, thông báo đúng trường |
| BR-EMP-01 | Mã nhân viên và email đã chuẩn hóa không trùng hồ sơ khác, kể cả khi sửa; CCCD không trùng nếu được nhập | 409 |
| BR-EMP-02 | HR dùng quy tắc tên, ngày sinh và giới tính của `ProfileRules`; nếu nhập điện thoại phải có 10 chữ số bắt đầu bằng 0; CCCD có 12 chữ số | 400 |
| BR-EMP-03 | Điện thoại/CCCD có thể để trống trong hồ sơ HR. Không ép trường tùy chọn thành bắt buộc như thao tác tự cập nhật điện thoại | Hợp lệ nếu các trường khác đúng |
| BR-EMP-04 | Ngày vào làm hợp lệ và sau ngày sinh nếu có; ngày nghỉ việc không trước ngày vào làm; số người phụ thuộc là số nguyên không âm | 400, không tự đổi số âm thành 0 |
| BR-EMP-05 | Ngày vào làm mặc định lấy theo ngày Việt Nam | Không lệch ngày ở ranh giới UTC |
| BR-PROFILE-01 | Avatar chỉ JPG/JPEG với MIME `image/jpeg` hoặc PNG với MIME `image/png`, tối đa 2 MB; chữ ký tệp do `FileService` kiểm tra | 400 trước upload nếu sai loại/giới hạn |

Quy tắc tuổi tối thiểu 18 và năm sinh từ 1940 là quy tắc **đã có trong dự án**, được tái sử dụng để hai màn sửa cùng một hồ sơ thống nhất; tài liệu này không đưa ra kết luận pháp lý.

### Lịch và nghỉ phép

| ID | Quy tắc | Kết quả |
| --- | --- | --- |
| BR-SCH-01 | Ngày phân công từ ngày vào làm đến ngày nghỉ việc, bao gồm hai đầu mút; khoa phải active | 400 |
| BR-SCH-02 | Chốt tuần phải kiểm tra lại ngày vào làm, ngày nghỉ việc, khoa và nghỉ phép đã duyệt vì hồ sơ có thể đổi sau khi phân công | 400, tuần chưa công bố |
| BR-SCH-03 | Lập lịch tuần kế tiếp từ 00:00 thứ Hai tuần trước. Chốt lần đầu trước giờ ca sáng thứ Hai của tuần được phân công: 07:00 mùa hè, 07:10 mùa đông theo `ScheduleRules.Hours`, giờ Việt Nam | 400 nếu trước cửa sổ lập lịch hoặc từ đúng giờ bắt đầu ca trở đi |
| BR-SCH-04 | Bản nháp chưa từng được mở lại sau chốt không được tạo/sửa/hủy hoặc chốt lần đầu khi quá hạn; không được gọi mở lại để vượt hạn | 400; mọi khoa vẫn chưa công bố |
| BR-SCH-05 | Sau chốt, HR Staff có thể mở lại trong tuần trước hoặc tuần làm việc, bắt buộc lý do và audit. Chỉ lịch có audit mở lại mới được sửa và chốt lại sau hạn chốt lần đầu; hết Chủ nhật tuần làm việc thì dừng điều chỉnh | 400 nếu thiếu lý do, tuần chưa chốt hoặc ngoài thời hạn; ca đã ghi nhận trực vẫn được bảo vệ |
| BR-SCH-06 | Màn HR Staff mặc định chọn tuần kế tiếp. API trả giờ máy chủ và các mốc thời gian; UI tự khóa nút tạo/sửa/hủy/chốt khi đến hạn, kể cả hộp xác nhận đang mở | Không dùng cửa sổ “Chủ nhật tuần trước đến hết tuần” cho chốt lần đầu |
| BR-LEAVE-01 | Khi tạo/sửa, toàn bộ khoảng nghỉ phải nằm trong thời gian công tác và nhân viên có khoa active | 400 |
| BR-LEAVE-02 | Đọc trạng thái pending và đổi sang withdrawn trong cùng transaction Serializable | Không ghi đè quyết định duyệt giữa hai bước; gọi lại sau thu hồi trả 409 |

Ví dụ lịch tuần **09–15/11/2026**: bắt đầu lập từ **02/11/2026 00:00**, chốt lần đầu **trước 09/11/2026 07:00**. Từ đúng 07:00, bản nháp chưa chốt bị khóa thao tác; lịch đã chốt có thể mở lại với lý do để điều chỉnh và công bố lại, đến trước **16/11/2026 00:00**. Chốt vẫn áp dụng toàn bộ khoa/phòng và cả hai cơ sở.

Luồng điều chỉnh dùng audit mở lại đã có sẵn (`ScheduleRules.ReopenAuditPrefix`), giữ nguyên lịch sử cũ và không cần migration database. Mốc chốt là giờ mở cửa ca sáng thứ Hai, kể cả khi danh sách phân công hiện tại chỉ có ca muộn hơn.

### Bằng cấp, chứng chỉ và CME

| ID | Quy tắc | Kết quả |
| --- | --- | --- |
| BR-CERT-01 | Category chỉ `degree`/`certificate`; category được gửi rõ phải được ưu tiên hơn suy đoán theo chữ “bác sĩ”, “bằng”… trong tên | 400 nếu sai enum; lưu đúng loại nếu hợp lệ |
| BR-CERT-02 | Trạng thái theo loại phải nằm trong các lựa chọn hiện có. Tháng chu kỳ và chỉ tiêu tín chỉ phải dương nếu cấu hình cho chứng chỉ, không vượt giới hạn lưu trữ/ngày | 400 |
| BR-CERT-03 | Không cắt tên hay JSON metadata khi vượt giới hạn cột. Nơi cấp tối đa 200, URL tối đa 500, metadata tối đa 200 ký tự sau serialize | 400; không lưu JSON dở dang |
| BR-CERT-04 | Endpoint thẩm định chỉ nhận bản đang pending/unverified. Sửa trạng thái qua màn HR vẫn theo chức năng hiện có | 409 khi bản đã được xử lý |
| BR-CERT-05 | Không xóa chứng chỉ có chu kỳ locked; không đổi category/định mức CME tác động lịch sử khóa; không chuyển chứng chỉ có dữ liệu CME thành bằng cấp | 409 |
| BR-CME-01 | Cycle ID tường minh phải tồn tại và thuộc đúng chứng chỉ; không tự chuyển sang chu kỳ mới nhất nếu ID sai | 400 |
| BR-CME-02 | Bản ghi thuộc chu kỳ locked không được sửa, xóa, di chuyển hoặc đổi verified; kiểm tra chu kỳ nguồn trước khi di chuyển | 400 |
| BR-CME-03 | Credits được kiểm tra bước 0.5 trước khi làm tròn; ngày hoàn thành không được là giá trị mặc định hoặc tương lai | 400 |
| BR-CME-04 | Tổng hoàn thành, điều chỉnh ngày chu kỳ và khóa chu kỳ chỉ tính bản ghi đã verified; giữ quy ước legacy `Verified = null` được xem là verified như DTO hiện có | Chưa đủ chỉ tiêu đã duyệt thì không khóa |
| BR-CME-05 | Ghi bản ghi, cập nhật tổng chu kỳ và kiểm tra khóa trong cùng transaction Serializable | Không để lại tổng chưa cập nhật khi bước sau thất bại |
| BR-CME-06 | UI lấy trạng thái khóa từ API, không giả lập thành công bằng localStorage. Lỗi khóa phải hiển thị và giữ trạng thái mở | Thông báo lỗi; không hiện thành công sai |

### Phiếu thủ thuật và kỳ lương

| ID | Quy tắc | Kết quả |
| --- | --- | --- |
| BR-PROC-01 | Luồng duyệt: `pending → hr_checked → verified`. Kế toán chỉ quyết định trên `hr_checked`; phiếu bị từ chối được người tạo sửa và gửi lại pending | 409 nếu vượt bước hoặc trạng thái đã đổi |
| BR-PROC-02 | Một cặp nhân viên + vai trò chỉ xuất hiện một lần; các vai trò khác nhau của cùng người vẫn được phép | 400, không tạo hoa hồng trùng |
| BR-PROC-03 | Người tham gia active, ngày thủ thuật nằm trong thời gian công tác; preview và lưu dùng cùng validation tiền, thời lượng, nhân sự | 400/404 theo dữ liệu sai |
| BR-PROC-04 | Lookup trả danh mục active hiện có. Mở form không tạo tỷ lệ hoa hồng mẫu hay kích hoạt lại dịch vụ đã tắt | Đọc dữ liệu không làm đổi cấu hình |
| BR-PROC-05 | Kiểm tra kỳ khóa/trạng thái và lưu trong cùng transaction; tháng tính hoa hồng phải là tháng lịch hợp lệ, kể cả biên `9999-12` không gây tràn ngày | 400/409 khi sai |
| BR-PAY-01 | Tháng kỳ lương phải đúng `YYYY-MM` và chuyển thành ngày đầu tháng hợp lệ; trim trước xử lý; tháng không được trùng | 400 nếu sai; 409 nếu trùng |

## 3. Những nghiệp vụ cần yêu cầu chi tiết trước khi triển khai

Các mục dưới đây thiếu chính sách hoặc thiếu cả luồng thực thi, không thể kết luận là đã hoàn thiện chỉ vì có bảng/model hoặc một nút trên UI:

| Nhóm | Thông tin còn thiếu |
| --- | --- |
| Nghỉ phép | Hạn mức phép năm, cộng dồn/chuyển năm, thời gian báo trước, nghỉ nửa ngày, lịch lễ; ai duyệt và có bao nhiêu cấp; hiện chưa có endpoint duyệt nghỉ phép |
| Chấm công | Quy tắc ca và dữ liệu máy, đi muộn/về sớm, làm tròn giờ, sửa công, nhập/chốt công. Các API attendance hiện chủ yếu đọc dữ liệu, chưa phải workflow đầy đủ |
| Bảng lương | Điều kiện tính lại/chốt/mở khóa, người duyệt, cách truy lĩnh và khấu trừ, khiếu nại và xuất ngân hàng. `PayrollPeriodService` hiện tạo/xem kỳ; không tự triển khai tính/chốt lương chỉ từ tên trạng thái |
| CME | Ngày khóa học có bắt buộc nằm trong ngày chu kỳ hay không; trùng khóa học giữa chứng chỉ; phân bổ tín chỉ giữa chu kỳ; xử lý bản pending khi người dùng chủ động tạo bảng tiến độ mới |
| Vô hiệu hóa khoa/nhân viên | Có bắt buộc điều chuyển nhân viên và xử lý lịch/đơn đang chờ trước khi vô hiệu hóa hay không. Lần sửa này chặn nghiệp vụ mới theo trạng thái, không tự hủy lịch/đơn cũ |
| Chứng chỉ | Điều kiện chứng chỉ đã duyệt/đang hiệu lực để được nộp CME, quy trình chỉnh sửa hoặc nộp lại hồ sơ bị từ chối, lưu trữ lâu dài sau thời gian bắt buộc |
| Quyền màn hình và API | API certificates/CME hiện cho HR Manager và Admin nhưng route quản trị tương ứng chỉ HR Manager. API compliance cho HR Staff nhưng route chưa có role này. SelfService API cho mọi tài khoản đã đăng nhập, UI loại Admin. Cần xác nhận quyền mong muốn trước khi mở rộng/thu hẹp |

## 4. Kiểm chứng

Chạy từ thư mục gốc:

```powershell
dotnet run --project tests/BusinessRules/BusinessRules.csproj -c Release
dotnet run --project tests/ScheduleRules/ScheduleRules.csproj -c Release
dotnet run --project tests/ScheduleIntegration/ScheduleIntegration.csproj -c Release
dotnet run --project tests/ContractRules/ContractRules.csproj -c Release
dotnet run --project tests/ContractIntegration/ContractIntegration.csproj -c Release
dotnet build backend/VNC.HRMS.sln -c Release
```

Các integration test tạo database SQL Server local mới theo tên có GUID, không dùng database ứng dụng và chỉ dọn database do chính lần chạy tạo. Cần Windows Authentication và quyền tạo database trên SQL Server local.

Chạy từ `frontend`:

```powershell
npm run build
npm run test:business-rules
npm run test:leave-rules
npm run test:permissions
npm run test:logout
```

Kiểm thử trình duyệt với API fixture, chạy từ gốc khi Vite đã mở ở port 5173:

```powershell
node --experimental-websocket tests/verify-cme-business-rules-ui.mjs
```

Script trình duyệt dùng Chrome headless và không gọi API dữ liệu thật. Kết quả build/rules/integration không thay thế kiểm thử toàn bộ ứng dụng với SMTP, Cloudinary hoặc phê duyệt nghiệp vụ thực tế.

Kết quả đã chạy ngày 06/11/2026: 70 kiểm tra backend mới, 16 ca quy tắc form nhân viên và 4 tình huống trình duyệt CME đều pass. Các bộ ScheduleRules, ScheduleIntegration, ContractRules, ContractIntegration, leave-rules, permissions và logout cũng pass.

Sau khi sửa hạn chốt lịch: ScheduleRules, ScheduleIntegration, 70 kiểm tra BusinessRules, 14 ca quyền thao tác lịch phía frontend và kiểm thử Chrome cho màn lịch đều pass. Đã kiểm tra mốc đúng giờ bắt đầu ca mùa hè/mùa đông, UTC+7, request vượt hạn trong lúc xử lý và hộp xác nhận mở qua hạn chốt. Build backend/frontend thành công.
