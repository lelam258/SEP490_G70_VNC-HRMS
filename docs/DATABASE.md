# Database dùng chung

Database mặc định: **VNC_HRMS_Iteration1**, SQL Server. Toàn bộ module sử dụng một database và một AppDbContext. Các schema phân nhóm bảng theo nghiệp vụ.

| Schema | Nhóm nghiệp vụ | Số bảng |
| --- | --- | --- |
| iam | Tài khoản, phiên, OTP, audit và chính sách | 6 |
| hr | Nhân viên, khoa/phòng, vị trí, hợp đồng và bằng cấp | 5 |
| attendance | Công, ca trực, nghỉ phép, lịch và bảng công tháng | 6 |
| payroll | Lương, phụ cấp, thuế/bảo hiểm, hoa hồng và khiếu nại | 16 |
| compliance | Chứng chỉ, CME và kết quả quét | 4 |
| notification | Thông báo theo người nhận | 1 |
| **Tổng** | | **38** |

## Danh sách bảng

- **iam**: `audit_logs`, `credentials`, `password_reset_tokens`, `refresh_tokens`, `system_policies`, `users`.
- **hr**: `contracts`, `degrees`, `departments`, `positions`, `staff`.
- **attendance**: `attendance_imports`, `attendance_records`, `leave_requests`, `monthly_timesheets`, `on_call_shifts`, `work_schedule_templates`.
- **payroll**: `allowance_types`, `bank_exports`, `commission_rules`, `complaint_attachments`, `complaints`, `maternity_cases`, `payroll_insurance_configs`, `payroll_locks`, `payroll_tax_brackets`, `payslip_allowances`, `payslip_deductions`, `payslips`, `procedure_assignments`, `procedure_services`, `procedure_slips`, `staff_allowances`.
- **compliance**: `certificates`, `cme_cycles`, `cme_records`, `compliance_scans`.
- **notification**: `notifications`.

## File dùng chung

- backend/Models: các domain entity.
- backend/Configurations/Entities: mapping bảng/cột, kiểu dữ liệu, index và constraint.
- backend/Persistence/AppDbContext.cs: DbSet và model của toàn bộ module.
- backend/Persistence/Migrations: migration và AppDbContextModelSnapshot.
- backend/scripts/Initialize-Local.ps1, Update-Database.ps1: khởi tạo và cập nhật schema.

## Quy ước làm việc

1. Khi đổi entity/mapping, tạo migration mới; chia sẻ model, migration và snapshot cùng nhau.
2. Thành viên pull migration đã có chỉ chạy dotnet ef database update trong thư mục backend.
3. Thống nhất người tạo migration khi nhiều thành viên cùng sửa model; pull bản mới trước khi tạo để hạn chế xung đột snapshot.
4. Không tự tạo bảng khác với migration, không sửa/xóa migration đã áp dụng và không xóa database để xử lý lỗi thông thường.
5. Dùng chung AppDbContext/UnitOfWork; không tạo database riêng cho từng nghiệp vụ.

## Liên kết và dữ liệu

- iam.users.employee_id là liên kết chính đến hr.staff.staff_id, có unique index chống cấp nhiều tài khoản cho một nhân viên.
- Giữ hr.staff.user_id để tương thích; không dùng cột này làm nguồn quyết định hồ sơ đã có tài khoản.
- Các ID liên module cần được kiểm tra tồn tại ở service; không mặc định mọi tham chiếu đã có foreign key.
- Timestamp lưu UTC; tiền và tỷ lệ dùng decimal theo precision mapping; nullable unique index được filter.
- Password hash và token hash là dữ liệu nội bộ, không đưa vào DTO trả về hoặc log.
- Tài khoản có rowversion/security_version để hỗ trợ cập nhật đồng thời và quản lý phiên.

Xem [MIGRATION.md](MIGRATION.md) để thiết lập, cập nhật schema và chuyển dữ liệu đã có.
