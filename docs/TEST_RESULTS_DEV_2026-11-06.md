# Test bổ sung theo nhánh Dev — 2026-11-06

## Phiên bản được rà soát

- Nhánh: `Dev`
- Commit đầu tiên sau phiên test trước: `91aa3a3` — `Chinh sửa phần thủ thuật`
- Các commit bổ sung chính trong khoảng cập nhật: `116f871` — Medical Procedure; `959c6ce` — Fix Contract.
- Workspace có sẵn file untracked `tatus`; file này được giữ nguyên.

## Thay đổi mới được ghi nhận

1. **Hợp đồng lao động:** thêm API list/detail/create/update, service/repository và quy tắc về thời hạn, mức lương, trạng thái hiệu lực, lịch sử lương, khóa payroll, kiểm tra trùng/chồng lấn, phân quyền HR Manager và audit. Thêm các trang list/create/detail/edit.
2. **Phiếu thủ thuật:** thêm API lookup/list/detail/create/update, preview hoa hồng, HR check, kế toán verify và tổng hợp hoa hồng tháng; thêm giao diện danh sách/form/chi tiết và modal duyệt.
3. **Kiểm thử hợp đồng:** có project `ContractRules`, `ContractIntegration` và script UI `verify-contracts-ui.mjs`.
4. **Kiểm thử phiếu thủ thuật:** chưa có project/script test riêng trong repository ở commit này. Bộ testcase đặc tả đã được thêm vào `TEST_CASES_FEATURES.md`, nhưng chưa chạy và không được tính là pass.

## Kết quả thực thi

| Loại | Lệnh/phạm vi | Kết quả | Cách ly dữ liệu và giới hạn |
|---|---|---|---|
| Unit — ContractRules | `dotnet run --project tests/ContractRules/ContractRules.csproj` | **20/20 pass** | Quy tắc thuần; không kết nối DB. |
| Integration — ContractService | `dotnet run --project tests/ContractIntegration/ContractIntegration.csproj` | **24/24 pass** | Test tự tạo database `VNC_Contract_Test_*` trên SQL Server local và xóa DB do test sở hữu sau khi chạy. Không dùng DB ứng dụng/QA. |
| UI — Contracts | `node tests/verify-contracts-ui.mjs` với Vite tại `127.0.0.1:5173` | **22/22 pass** | Chrome headless + API fixtures giả lập; xác nhận luồng UI, không xác nhận HTTP/API thật hay tích hợp DB. Ảnh chụp được tạo dưới `.local/`. |
| Build frontend | `npm.cmd run build` trong `frontend` | **Pass** | TypeScript và Vite build thành công; còn cảnh báo bundle JavaScript lớn hơn 500 kB. |
| System/API — Procedure slips | Chưa có test runner riêng | **Not run** | Chưa có bộ seed/assertions tự động; cần chạy integration trên DB test có fixture dịch vụ, nhân viên và quy tắc hoa hồng. |

### Các nội dung integration hợp đồng đã qua

Đã xác nhận tạo hợp đồng, chuẩn hóa mã, tính lương tháng/ngày và căn cứ bảo hiểm; chặn mã trùng, hợp đồng chồng lấn, nhân viên inactive/không tồn tại, ngày tháng sai và lương không hợp lệ; đọc danh sách/chi tiết và 404; cập nhật không làm đổi lương; khóa kỳ payroll và salary history; vô hiệu hóa/tạo hợp đồng thay thế; kiểm tra HR Manager và loại thông tin lương khỏi list; tạo/cập nhật có audit.

### Giới hạn cần giữ trong báo cáo

- Các test hiện có cho hợp đồng kiểm thử business service với database cô lập và UI bằng API giả lập. Chưa thực hiện HTTP end-to-end trên ứng dụng đang chạy; vì vậy không ghi nhận các ca này là kiểm chứng kết nối controller/API thật tới DB QA.
- Không tự động chạy phiếu thủ thuật trong lượt này. Các trạng thái, phân quyền và phép tính hoa hồng trong bộ testcase mới là **Expected**, không phải kết quả thực thi.
- QA DB `VNC_HRMS_QA` đã bàn giao trước đó không được dùng trong lượt này. Integration hợp đồng tạo DB dùng riêng; cần migration/seed phù hợp trước khi demo các màn hình mới trên QA DB.
- Báo cáo Unit Test `.xls` đang được WPS giữ mở; không sửa đè file. Bộ 20 kết quả unit mới được cung cấp trong file bổ sung riêng.

## Tệp liên quan

- [Bộ testcase theo tính năng](TEST_CASES_FEATURES.md)
- Báo cáo bổ sung: `Report-5.1_Unit Test.Dev_2026-11-06.xlsx`, `Report-5.2_Integration Test.xlsx`, `Report-5.3_System Test_FRs.xlsx` trong thư mục Downloads.
