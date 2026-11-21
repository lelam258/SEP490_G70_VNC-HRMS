# Module Chứng chỉ & Đào tạo Y khoa liên tục (CME) - Use Case Specification (3.1 - 3.12)

> Tài liệu chuẩn hóa đặc tả ca sử dụng (Use Cases) tương thích 100% với mã nguồn hệ thống VNC-HRMS (Frontend React & Backend .NET).
> Lưu ý: Mục 3.13 (Certificate / CME Review) đã được xóa bỏ do chức năng phê duyệt đã được tích hợp trực tiếp vào màn hình danh sách và chi tiết (3.1, 3.3, 3.5, 3.7).

---

### 3.1 Certificate / Qualification List
- **Primary Actors**: HR Manager
- **Secondary Actors**: None
- **Description**: Cho phép HR Manager xem và quản lý toàn bộ văn bằng học thuật và chứng chỉ hành nghề của nhân sự phòng khám, lọc hồ sơ theo khoa/phòng và trạng thái, và phê duyệt hoặc từ chối nhanh các hồ sơ do nhân viên gửi lên.
- **Preconditions**: HR Manager đã đăng nhập hệ thống và có quyền hạn hợp lệ.
- **Normal Flow**:
  1. HR Manager mở màn hình Quản lý Bằng cấp & Chứng chỉ.
  2. Hệ thống hiển thị 4 thẻ KPI tổng quan (Tổng nhân sự, Nhân sự có CCHN, Tổng chứng chỉ, Hồ sơ chờ duyệt) và danh sách nhân sự ở panel bên trái (phân trang 4 nhân sự/trang).
  3. HR Manager tìm kiếm nhân sự theo họ tên, mã nhân viên hoặc lọc theo 'Khoa/phòng' và 'Trạng thái hồ sơ' (Tất cả, Đã có hồ sơ, Chưa có hồ sơ, Có hồ sơ chờ duyệt).
  4. HR Manager chọn một nhân sự từ danh sách bên trái.
  5. Hệ thống hiển thị chi tiết các bằng cấp và chứng chỉ của nhân sự được chọn ở panel bên phải, phân loại theo 4 tab: 'Tất cả', 'Bằng cấp', 'Chứng chỉ', và 'Chờ duyệt' (phân trang 3 hồ sơ/trang).
  6. Tại panel bên phải, HR Manager có thể bấm '+ Thêm hồ sơ' để thêm mới, 'Xem' để mở chi tiết, 'Sửa' để chỉnh sửa, hoặc bấm 'Duyệt hồ sơ' / 'Từ chối' trên các hồ sơ đang chờ thẩm định.
- **Alternative Flows**:
  - *A1: Phê duyệt nhanh*: HR Manager bấm 'Duyệt hồ sơ' trên card chờ duyệt; hệ thống cập nhật trạng thái hồ sơ thành Đã duyệt (Verified/Active).
  - *A2: Từ chối nhanh*: HR Manager bấm 'Từ chối'; hệ thống hiển thị hộp thoại yêu cầu bắt buộc nhập lý do từ chối trước khi lưu.
- **Postconditions**: Danh sách văn bằng, chứng chỉ và trạng thái thẩm định của nhân sự được cập nhật.

---

### 3.2 Create Certificate / Qualification
- **Primary Actors**: HR Manager
- **Secondary Actors**: None
- **Description**: Cho phép HR Manager thêm mới một văn bằng học thuật hoặc chứng chỉ hành nghề y tế (cùng thông số chu kỳ CME nếu áp dụng) vào hồ sơ của nhân viên.
- **Preconditions**: HR Manager đã đăng nhập và đã chọn một nhân viên cụ thể.
- **Normal Flow**:
  1. HR Manager bấm nút '+ Thêm hồ sơ' tại panel bên phải của nhân viên đang chọn.
  2. Hệ thống mở hộp thoại Thêm hồ sơ chuyên môn.
  3. HR Manager chọn loại hồ sơ tại 'Phân loại hồ sơ': 'Bằng cấp' hoặc 'Chứng chỉ'.
  4. **Nếu chọn 'Bằng cấp'**: HR Manager nhập Tên văn bằng, Trình độ đào tạo (Trung cấp, Cao đẳng, Đại học/Cử nhân, Thạc sĩ, Bác sĩ CKI...), Chuyên ngành (Y đa khoa, Răng - Hàm - Mặt, Điều dưỡng...), Cơ sở đào tạo / Nơi cấp, Ngày cấp, Tệp scan đính kèm, Trạng thái xác minh và Ghi chú.
  5. **Nếu chọn 'Chứng chỉ'**: HR Manager nhập Tên chứng chỉ hành nghề, Cơ quan cấp phép, Văn bằng chuyên môn, Hình thức cấp, Ngày cấp, Ngày hết hạn (hoặc để trống nếu vô thời hạn), Tệp scan đính kèm, Thời hạn chu kỳ CME (tháng) và Số tín chỉ CME yêu cầu trong chu kỳ.
  6. HR Manager bấm 'Thêm hồ sơ' để lưu.
  7. Hệ thống kiểm tra dữ liệu, lưu hồ sơ vào cơ sở dữ liệu và tự động khởi tạo chu kỳ CME số 1 cho chứng chỉ (nếu có yêu cầu CME).
- **Alternative Flows**:
  - *A1: Thiếu trường bắt buộc hoặc ngày hết hạn trước ngày cấp*: Hệ thống báo lỗi và yêu cầu chỉnh sửa.
  - *A2: Hủy tạo mới*: HR Manager bấm 'Hủy' để đóng hộp thoại mà không lưu.
- **Postconditions**: Bằng cấp hoặc chứng chỉ hành nghề mới được bổ sung vào hồ sơ của nhân viên.

---

### 3.3 Certificate / Qualification Details
- **Primary Actors**: HR Manager
- **Secondary Actors**: None
- **Description**: Cho phép HR Manager xem toàn bộ thông tin chi tiết và bản scan đính kèm của một bằng cấp hoặc chứng chỉ hành nghề, đồng thời phê duyệt hoặc từ chối hồ sơ do nhân viên gửi lên.
- **Preconditions**: HR Manager đã đăng nhập; hồ sơ được chọn tồn tại trong hệ thống.
- **Normal Flow**:
  1. HR Manager bấm 'Xem' trên card hồ sơ tương ứng.
  2. Hệ thống mở hộp thoại chi tiết hiển thị: Tên hồ sơ, phân loại, trạng thái hiệu lực, nơi cấp, chuyên môn, ngày cấp, ngày hết hạn, thông số chu kỳ CME (nếu có), và liên kết xem trước tệp scan đính kèm.
  3. HR Manager kiểm tra tính xác thực của thông tin và xem tệp scan.
  4. Nếu hồ sơ ở trạng thái Chờ duyệt, HR Manager có thể bấm 'Phê duyệt' để xác nhận hoặc 'Từ chối'.
  5. Nếu bấm 'Từ chối', hệ thống mở hộp thoại phụ yêu cầu bắt buộc nhập lý do từ chối.
  6. HR Manager cũng có thể bấm 'Chỉnh sửa' để mở form sửa hoặc bấm 'Đóng' để thoát.
- **Alternative Flows**:
  - *A1: Từ chối mà không nhập lý do*: Hệ thống hiển thị thông báo lỗi yêu cầu nhập lý do trước khi xác nhận.
- **Postconditions**: Trạng thái thẩm định của hồ sơ và lý do từ chối (nếu có) được cập nhật thành công.

---

### 3.4 Edit Certificate / Qualification
- **Primary Actors**: HR Manager
- **Secondary Actors**: None
- **Description**: Cho phép HR Manager cập nhật thông tin chi tiết, ngày hiệu lực, tệp đính kèm, trạng thái hoặc thông số chu kỳ CME của bằng cấp/chứng chỉ hiện có.
- **Preconditions**: HR Manager đã đăng nhập; hồ sơ cần sửa tồn tại trên hệ thống.
- **Normal Flow**:
  1. HR Manager bấm 'Sửa' trên card hồ sơ hoặc nút 'Chỉnh sửa' trong hộp thoại chi tiết.
  2. Hệ thống mở hộp thoại chỉnh sửa với các trường dữ liệu hiện tại được điền sẵn.
  3. HR Manager cập nhật các trường cần thay đổi (tên hồ sơ, cơ quan cấp, ngày cấp, ngày hết hạn, trạng thái, tệp đính kèm, số tín chỉ CME yêu cầu).
  4. HR Manager bấm 'Lưu thay đổi'.
  5. Hệ thống kiểm tra dữ liệu và lưu cập nhật vào cơ sở dữ liệu.
- **Alternative Flows**:
  - *A1: Dữ liệu ngày không hợp lệ*: Hệ thống báo lỗi và giữ nguyên hộp thoại để sửa lại.
  - *A2: Hủy chỉnh sửa*: HR Manager bấm 'Hủy' để đóng hộp thoại mà không lưu dữ liệu.
- **Postconditions**: Hồ sơ chuyên môn được cập nhật thành công.

---

### 3.5 CME Record List
- **Primary Actors**: HR Manager
- **Secondary Actors**: None
- **Description**: Cho phép HR Manager theo dõi tiến độ tích lũy tín chỉ CME của nhân viên y tế theo từng chu kỳ, quản lý các khóa học CME, phê duyệt nộp bài của nhân viên và khóa chu kỳ khi hoàn thành chỉ tiêu.
- **Preconditions**: HR Manager đã đăng nhập; nhân sự có chứng chỉ hành nghề thuộc diện theo dõi CME.
- **Normal Flow**:
  1. HR Manager mở màn hình CME Record List và chọn một nhân viên ('Nhân viên') cùng Chứng chỉ hành nghề / Chu kỳ CME tương ứng ('Chứng chỉ / Chu kỳ CME').
  2. Hệ thống hiển thị thanh tiến độ CME (tín chỉ tích lũy / tín chỉ yêu cầu, ngày chu kỳ, trạng thái nguy cơ) và bảng danh sách các khóa học CME.
  3. HR Manager có thể lọc bảng theo trạng thái ('Tất cả', 'Đã duyệt', 'Chờ duyệt').
  4. HR Manager có thể thực hiện:
     - Bấm '+ New record' để tạo chu kỳ / bảng tiến độ mới.
     - Bấm 'Sửa ngày chu kỳ' để điều chỉnh ngày bắt đầu/kết thúc chu kỳ.
     - Bấm 'Chi tiết' để xem khóa học, 'Sửa' để chỉnh sửa, hoặc bấm 'Phê duyệt' / 'Từ chối' trên bản nộp của nhân viên.
  5. Khi nhân viên đã tích lũy đủ số tín chỉ yêu cầu, HR Manager bấm 'Khóa chu kỳ' để đóng và lưu trữ chu kỳ hiện tại.
- **Alternative Flows**:
  - *A1: Chu kỳ đã bị khóa*: Hệ thống vô hiệu hóa các nút thêm, sửa, xóa, duyệt và từ chối trong chu kỳ đó.
- **Postconditions**: Bản ghi khóa học CME và trạng thái chu kỳ được cập nhật theo thao tác của HR Manager.

---

### 3.6 Create CME Record
- **Primary Actors**: HR Manager
- **Secondary Actors**: None
- **Description**: Cho phép HR Manager trực tiếp ghi nhận một khóa học/hội thảo đào tạo y khoa liên tục (CME) đã hoàn thành cho nhân viên y tế vào chu kỳ CME đang kích hoạt.
- **Preconditions**: HR Manager đã đăng nhập; nhân viên được chọn đã có Chứng chỉ hành nghề và chu kỳ CME chưa bị khóa.
- **Normal Flow**:
  1. HR Manager tại màn hình CME Record List, chọn nhân viên và chọn Chứng chỉ hành nghề / Chu kỳ CME cần ghi nhận.
  2. HR Manager nhập các thông tin đào tạo tại form ghi nhận:
     - Tên khóa học / hội thảo CME (bắt buộc, tối đa 150 ký tự).
     - Cơ sở / đơn vị tổ chức (tối đa 100 ký tự).
     - Ngày hoàn thành (bắt buộc, không được ở tương lai).
     - Số giờ tín chỉ tích lũy (số dương, bước nhảy 0.5; mặc định là 1 nếu chứng chỉ không yêu cầu tín chỉ).
     - Tải lên tệp scan chứng nhận hoàn thành (PDF, PNG, JPG).
  3. HR Manager bấm 'Lưu bản ghi'.
  4. Hệ thống kiểm tra tính hợp lệ dữ liệu và đảm bảo số tín chỉ nhập vào không vượt quá chỉ tiêu còn lại của chu kỳ.
  5. Hệ thống lưu bản ghi với trạng thái Đã xác minh (Verified), tự động cộng dồn số tín chỉ đạt được và cập nhật thanh tiến độ chu kỳ.
- **Alternative Flows**:
  - *A1: Chu kỳ đã bị khóa*: Hệ thống thông báo chu kỳ đã đóng và vô hiệu hóa form thêm mới.
  - *A2: Số tín chỉ vượt trần chỉ tiêu*: Hệ thống hiển thị cảnh báo số tín chỉ tối đa còn được phép ghi nhận cho chu kỳ này và yêu cầu điều chỉnh.
  - *A3: Ngày hoàn thành ở tương lai*: Hệ thống hiển thị thông báo lỗi `Completed date cannot be in the future`.
- **Postconditions**: Bản ghi CME mới được ghi nhận vào hệ thống và thanh tiến độ chu kỳ CME được cập nhật.

---

### 3.7 CME Record Details
- **Primary Actors**: HR Manager
- **Secondary Actors**: None
- **Description**: Cho phép HR Manager xem chi tiết thông tin một khóa đào tạo CME của nhân sự, xem trước tệp chứng chỉ scan đính kèm và thực hiện thẩm định (xác nhận tín chỉ / hủy xác minh).
- **Preconditions**: HR Manager đã đăng nhập; bản ghi CME cần xem tồn tại trên hệ thống.
- **Normal Flow**:
  1. HR Manager bấm nút 'Chi tiết' tại một hàng trong bảng khóa học CME.
  2. Hệ thống hiển thị hộp thoại CmeRecordDetailModal gồm: Tên khóa học, đơn vị tổ chức, ngày hoàn thành, số tín chỉ, trạng thái xác minh, và khung xem trước tệp scan chứng nhận (PDF viewer hoặc ảnh phóng to).
  3. HR Manager đối chiếu thông tin và tệp scan.
  4. Nếu bản ghi đang ở trạng thái Chờ duyệt, HR Manager có thể bấm 'Xác nhận tín chỉ' (Phê duyệt) hoặc 'Hủy xác minh'.
  5. HR Manager bấm 'Đóng' để thoát hộp thoại.
- **Alternative Flows**:
  - *A1: Bản ghi không có tệp đính kèm*: Hệ thống hiển thị thông báo 'Chưa đính kèm tệp minh chứng' và ẩn nút xem trước.
- **Postconditions**: Trạng thái xác minh của khóa học CME được cập nhật và phản ánh ngay vào tiến độ chu kỳ.

---

### 3.8 Edit CME Record
- **Primary Actors**: HR Manager
- **Secondary Actors**: None
- **Description**: Cho phép HR Manager chỉnh sửa thông tin của một bản ghi khóa đào tạo CME đã ghi nhận (tên khóa học, đơn vị tổ chức, ngày hoàn thành, số tín chỉ hoặc tệp minh chứng).
- **Preconditions**: HR Manager đã đăng nhập; bản ghi CME thuộc chu kỳ chưa bị khóa.
- **Normal Flow**:
  1. HR Manager bấm biểu tượng 'Sửa' tại dòng bản ghi tương ứng trong bảng CME.
  2. Hệ thống tự động cuộn đến form và điền sẵn các dữ liệu hiện tại của khóa học.
  3. HR Manager cập nhật các trường cần thay đổi (tên khóa, ngày hoàn thành, số tín chỉ, thay file scan mới nếu cần).
  4. HR Manager bấm 'Cập nhật bản ghi'.
  5. Hệ thống kiểm tra ràng buộc dữ liệu, cập nhật bản ghi vào cơ sở dữ liệu và tính toán lại tổng số tín chỉ tích lũy của chu kỳ.
- **Alternative Flows**:
  - *A1: Dữ liệu sửa không hợp lệ (ngày tương lai, số tín chỉ làm vượt quá trần chu kỳ)*: Hệ thống hiển thị cảnh báo lỗi và giữ nguyên form để sửa lại.
  - *A2: Hủy chỉnh sửa*: HR Manager bấm 'Hủy', hệ thống xóa dữ liệu trên form và quay về trạng thái ban đầu.
- **Postconditions**: Thông tin bản ghi CME được lưu thay đổi thành công.

---

### 3.9 My Certificate List
- **Primary Actors**: Medical Staff
- **Secondary Actors**: HR Manager (người thẩm định hồ sơ)
- **Description**: Cho phép nhân viên y tế xem danh sách văn bằng và chứng chỉ hành nghề của bản thân, theo dõi trạng thái hiệu lực, chủ động khai báo hồ sơ mới và có quyền thu hồi hồ sơ đang chờ duyệt.
- **Preconditions**: Nhân viên y tế đã đăng nhập vào hệ thống.
- **Normal Flow**:
  1. Nhân viên y tế mở màn hình My Certificate List.
  2. Hệ thống hiển thị các thẻ KPI tóm tắt và bảng danh sách văn bằng, chứng chỉ của chính nhân sự đó.
  3. Nhân viên có thể tìm kiếm theo từ khóa hoặc lọc theo danh mục ('Tất cả', 'Bằng cấp', 'Chứng chỉ') và trạng thái ('Còn hiệu lực / Vô thời hạn', 'Sắp hết hạn', 'Đã hết hạn').
  4. Nhân viên bấm 'Làm mới' để tải lại danh sách, bấm 'Chi tiết' để xem thông tin và tệp scan đã đính kèm.
  5. Nhân viên bấm 'Khai báo bằng / CCHN mới' để gửi hồ sơ mới lên phòng Nhân sự.
  6. Với những hồ sơ đang ở trạng thái Chờ HR duyệt, nhân viên có thể bấm 'Thu hồi' để hủy bản khai báo.
- **Alternative Flows**:
  - *A1: Hồ sơ đã được HR thẩm định*: Nút 'Thu hồi' tự động bị ẩn đối với hồ sơ đó.
- **Postconditions**: Nhân viên theo dõi được hồ sơ chuyên môn cá nhân hoặc thu hồi thành công hồ sơ chờ duyệt.

---

### 3.10 My CME Record List
- **Primary Actors**: Medical Staff
- **Secondary Actors**: HR Manager (người thẩm định khóa đào tạo)
- **Description**: Cho phép nhân viên y tế theo dõi tiến độ tích lũy tín chỉ CME cho từng chứng chỉ hành nghề của mình, xem lịch sử các khóa học đã nộp, gửi khóa học mới và thu hồi bản nộp chưa được thẩm định.
- **Preconditions**: Nhân viên y tế đã đăng nhập và đã có ít nhất một Chứng chỉ hành nghề.
- **Normal Flow**:
  1. Nhân viên y tế mở màn hình My CME Record List.
  2. Nhân viên chọn Chứng chỉ hành nghề ('Chứng chỉ') và Chu kỳ CME ('Chu kỳ', hoặc chọn 'Tất cả chu kỳ' để xem toàn bộ lịch sử).
  3. Hệ thống hiển thị thanh tiến độ tích lũy tín chỉ, số ngày còn lại trong chu kỳ, các thẻ tóm tắt và bảng danh sách khóa học CME.
  4. Nhân viên tìm kiếm theo tên khóa học hoặc lọc theo trạng thái ('Tất cả trạng thái', 'Đã duyệt', 'Chờ HR duyệt').
  5. Nhân viên bấm 'Làm mới' để tải lại dữ liệu, 'Xem chi tiết' để xem khóa học, 'Khai báo CME mới' để nộp khóa học mới, hoặc 'Thu hồi bản nộp' đối với bản ghi chưa được duyệt.
- **Alternative Flows**:
  - *A1: Khóa học đã được HR thẩm định*: Hệ thống ẩn nút 'Thu hồi bản nộp' cho hàng đó.
- **Postconditions**: Nhân viên theo dõi được tiến độ CME cá nhân hoặc thu hồi thành công bản ghi đang chờ duyệt.

---

### 3.11 Submit Certificate / CME
- **Primary Actors**: Medical Staff
- **Secondary Actors**: HR Manager (thẩm định và xác nhận bản nộp)
- **Description**: Cho phép nhân viên y tế gửi văn bằng, chứng chỉ hành nghề mới hoặc gửi chứng nhận khóa đào tạo CME vừa hoàn thành kèm tệp scan minh chứng để phòng Nhân sự thẩm định.
- **Preconditions**: Nhân viên y tế đã đăng nhập hệ thống.
- **Normal Flow**:
  1. Nhân viên bấm 'Khai báo bằng / CCHN mới' (từ My Certificate List) hoặc 'Khai báo CME mới' (từ My CME Record List).
  2. Hệ thống mở hộp thoại khai báo tương ứng:
     - **Nếu nộp Bằng cấp hoặc Chứng chỉ hành nghề**: Nhân viên chọn phân loại ('Bằng cấp chuyên môn' hoặc 'Chứng chỉ hành nghề (CCHN)'), nhập tên, cơ quan cấp, ngày cấp, ngày hết hạn (hoặc tích chọn 'Vô thời hạn'), điền thông tin chuyên môn, tải lên tệp scan minh chứng và bấm 'Khai báo hồ sơ'.
     - **Nếu nộp Khóa đào tạo CME**: Nhân viên chọn CCHN liên kết, nhập tên khóa học, đơn vị tổ chức, ngày hoàn thành, số giờ tín chỉ tích lũy, tải lên tệp scan chứng nhận và bấm 'Gửi hồ sơ thẩm định'.
  3. Hệ thống kiểm tra dữ liệu và tệp tải lên, lưu bản ghi với trạng thái 'Chờ HR duyệt' (Pending Review) và chuyển đến hàng đợi thẩm định của HR Manager.
- **Alternative Flows**:
  - *A1: Thiếu trường bắt buộc, ngày không hợp lệ hoặc tệp quá dung lượng / sai định dạng*: Hệ thống hiển thị thông báo lỗi và ngăn gửi.
  - *A2: Hủy gửi*: Nhân viên bấm 'Hủy' để đóng hộp thoại mà không gửi.
- **Postconditions**: Hồ sơ chuyên môn hoặc khóa đào tạo CME mới được lưu ở trạng thái Chờ thẩm định.

---

### 3.12 Compliance Dashboard
- **Primary Actors**: HR Manager
- **Secondary Actors**: Department Head (Trưởng khoa phòng - giới hạn phạm vi khoa phòng phụ trách)
- **Description**: Cho phép HR Manager và Quản lý khoa phòng theo dõi thời hạn hiệu lực của chứng chỉ hành nghề và tiến độ tuân thủ chu kỳ CME của toàn bộ nhân viên y tế trong phòng khám, gửi thông báo nhắc nhở và xuất báo cáo tuân thủ.
- **Preconditions**: Người dùng đã đăng nhập và có thẩm quyền truy cập (HR Manager, Admin hoặc Department Head).
- **Normal Flow**:
  1. Người dùng mở màn hình Bảng điều khiển Tuân thủ (`/compliance`).
  2. Người dùng thiết lập các tùy chọn lọc ('Loại báo cáo', 'Kỳ hạn xét', 'Phạm vi thẩm quyền / Khoa phòng', 'Chức danh chuyên môn', hoặc 'Tìm kiếm') và bấm 'Áp dụng bộ lọc'.
  3. Hệ thống hiển thị:
     - **6 thẻ KPI tổng quan**: Tổng nhân sự theo dõi, Hồ sơ còn hiệu lực, Hồ sơ sắp hết hạn (trong vòng 90 ngày), Hồ sơ đã hết hạn, CCHN cũ cần chuẩn hóa, Chu kỳ CME có nguy cơ trễ hạn (trong vòng 180 ngày).
     - **Bảng theo dõi hạn Chứng chỉ hành nghề**.
     - **Bảng theo dõi tiến độ Chu kỳ CME**.
     - **Biểu đồ tỷ lệ tuân thủ theo Khoa/phòng**.
  4. Người dùng có thể bấm vào bất kỳ thẻ KPI nào để lọc nhanh danh sách hai bảng bên dưới, chuyển đổi giữa 'Chỉ hiện CME có nguy cơ' và 'Xem tất cả chu kỳ CME', hoặc bấm 'Mở' trên dòng nhân viên để điều hướng nhanh đến hồ sơ chuyên môn của nhân sự đó.
  5. HR Manager có thể bấm 'Xuất báo cáo (CSV)' để tải file thống kê dữ liệu tuân thủ đã lọc.
  6. HR Manager bấm 'Gửi nhắc nhở' để hệ thống tự động gửi thông báo/email cảnh báo tới những nhân viên có CCHN sắp hết hạn hoặc chu kỳ CME đang có nguy cơ chậm tiến độ.
- **Alternative Flows**:
  - *A1: Tài khoản Trưởng khoa*: Hệ thống tự động khóa phạm vi xem chỉ trong phạm vi khoa phòng do tài khoản phụ trách.
  - *A2: Không có bản ghi nào*: Các nút 'Xuất báo cáo (CSV)' và 'Gửi nhắc nhở' tự động vô hiệu hóa.
  - *A3: Đặt lại bộ lọc*: Người dùng bấm 'Đặt lại' để khôi phục cấu hình lọc mặc định.
- **Postconditions**: Tình trạng tuân thủ quy chuẩn y tế được hiển thị đầy đủ; báo cáo CSV được xuất hoặc thông báo nhắc nhở được gửi thành công.
