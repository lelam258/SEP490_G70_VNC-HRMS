/*
====================================================================================================
VNC HRMS - DATABASE SEED & DATA UPDATES FOR ITERATION 1 (PAYROLL & CONTRACTS)
Tập lệnh SQL cập nhật dữ liệu, sửa lỗi hiển thị tiếng Việt và tạo dữ liệu mẫu cho Iteration 1.
Chạy an toàn trên SQL Server (Idempotent - không bị trùng lặp khi chạy lại nhiều lần).
Database: VNC_HRMS_Iteration1
====================================================================================================
*/

USE [VNC_HRMS_Iteration1];
GO

SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

PRINT N'>>> BẮT ĐẦU CẬP NHẬT DỮ LIỆU ITERATION 1...';
GO

-- =================================================================================================
-- PHẦN 1: CẬP NHẬT CƠ SỞ (SITES) & THÔNG TIN CÔNG ĐOÀN NHÂN VIÊN
-- =================================================================================================
PRINT N'1. Kiểm tra và bổ sung danh mục cơ sở (sites)...';

IF NOT EXISTS (SELECT 1 FROM dbo.sites WHERE site_code = 'CS1')
BEGIN
    INSERT INTO dbo.sites (site_id, site_code, name, address, status)
    VALUES (NEWID(), 'CS1', N'Cơ sở 1 - Phòng khám Đa khoa Việt Nhật', N'Hà Nội', 'active');
END;

IF NOT EXISTS (SELECT 1 FROM dbo.sites WHERE site_code = 'CS2')
BEGIN
    INSERT INTO dbo.sites (site_id, site_code, name, address, status)
    VALUES (NEWID(), 'CS2', N'Cơ sở 2', N'Hà Nội', 'active');
END;

-- Cập nhật site_id mặc định cho nhân viên nếu chưa có
DECLARE @defaultSiteId uniqueidentifier = (SELECT TOP 1 site_id FROM dbo.sites WHERE site_code = 'CS1');
UPDATE dbo.staff SET site_id = @defaultSiteId WHERE site_id IS NULL;
UPDATE dbo.staff SET is_union_member = 1 WHERE is_union_member IS NULL;
GO

-- =================================================================================================
-- PHẦN 2: CHUẨN HÓA TIẾNG VIỆT CHO CHỨC VỤ (POSITIONS) & THỦ THUẬT (PROCEDURE_SERVICES)
-- =================================================================================================
PRINT N'2. Chuẩn hóa tiếng Việt danh mục chức vụ và dịch vụ thủ thuật...';

-- Đảm bảo các chức vụ chuẩn tồn tại
IF NOT EXISTS (SELECT 1 FROM dbo.positions WHERE name = N'Bác sĩ')
    INSERT INTO dbo.positions (position_id, name, scope_tag, status) VALUES (NEWID(), N'Bác sĩ', 'clinic', 'active');

IF NOT EXISTS (SELECT 1 FROM dbo.positions WHERE name = N'Kỹ thuật viên')
    INSERT INTO dbo.positions (position_id, name, scope_tag, status) VALUES (NEWID(), N'Kỹ thuật viên', 'clinic', 'active');

IF NOT EXISTS (SELECT 1 FROM dbo.positions WHERE name = N'Điều dưỡng / Y tá')
    INSERT INTO dbo.positions (position_id, name, scope_tag, status) VALUES (NEWID(), N'Điều dưỡng / Y tá', 'clinic', 'active');

IF NOT EXISTS (SELECT 1 FROM dbo.positions WHERE name = N'Dược sĩ')
    INSERT INTO dbo.positions (position_id, name, scope_tag, status) VALUES (NEWID(), N'Dược sĩ', 'clinic', 'active');

-- Sửa font tiếng Việt trong procedure_services nếu bị lỗi mã hóa
UPDATE dbo.procedure_services SET service_name = N'Chụp cắt lớp vi tính (CLVT)', category = N'Chẩn đoán hình ảnh' WHERE service_code = 'CLVT-01';
UPDATE dbo.procedure_services SET service_name = N'Siêu âm Doppler màu tim/mạch', category = N'Chẩn đoán hình ảnh' WHERE service_code = 'SA-01';
UPDATE dbo.procedure_services SET service_name = N'Chụp X-quang kỹ thuật số', category = N'Chẩn đoán hình ảnh' WHERE service_code = 'XQ-01';
UPDATE dbo.procedure_services SET service_name = N'Tiêm khớp', category = N'Thủ thuật ngoại khoa' WHERE service_code = 'TK-01';
UPDATE dbo.procedure_services SET service_name = N'Tiểu phẫu cắt u bao hoạt dịch', category = N'Thủ thuật ngoại khoa' WHERE service_code = 'TT-01';
UPDATE dbo.procedure_services SET service_name = N'Nẹp cố định gãy xương', category = N'Thủ thuật ngoại khoa' WHERE service_code = 'TT-02';
UPDATE dbo.procedure_services SET service_name = N'Xét nghiệm sinh hóa máu', category = N'Xét nghiệm' WHERE service_code = 'XN-SH';
UPDATE dbo.procedure_services SET service_name = N'Xét nghiệm huyết học tổng quát', category = N'Xét nghiệm' WHERE service_code = 'XN-01';
IF EXISTS (SELECT 1 FROM dbo.procedure_services WHERE service_code = 'NS-01')
    UPDATE dbo.procedure_services SET service_name = N'Nội soi tiêu hóa can thiệp', category = N'Thủ thuật ngoại khoa' WHERE service_code = 'NS-01';
GO

-- =================================================================================================
-- PHẦN 3: CẤU HÌNH THAM SỐ LƯƠNG & CHÍNH SÁCH HỆ THỐNG (SYSTEM_POLICIES & PAYROLL_RATE_CONFIGS)
-- =================================================================================================
PRINT N'3. Cập nhật chính sách tính lương và đơn giá trực...';

-- Cập nhật mô tả tiếng Việt có dấu cho các policy
UPDATE dbo.system_policies SET description = N'Mức giảm trừ gia cảnh cho bản thân người nộp thuế theo NĐ 253/2026/NĐ-CP' WHERE policy_key = 'tax_personal_deduction';
UPDATE dbo.system_policies SET description = N'Mức giảm trừ gia cảnh cho mỗi người phụ thuộc theo NĐ 253/2026/NĐ-CP' WHERE policy_key = 'tax_dependent_deduction';
UPDATE dbo.system_policies SET description = N'Tỷ lệ khấu trừ thuế cố định tại nguồn (%)' WHERE policy_key = 'tax_flat_rate';
UPDATE dbo.system_policies SET description = N'Ngưỡng thu nhập áp dụng khấu trừ thuế cố định 10% theo NĐ 253/2026/NĐ-CP' WHERE policy_key = 'tax_flat_threshold';
UPDATE dbo.system_policies SET description = N'Đơn vị làm tròn số tiền thực lĩnh (mặc định 1.000 đ theo hàm ROUND Excel)' WHERE policy_key = 'payroll_rounding_unit';

-- Bổ sung các chính sách tính thuế trước giảm trừ
IF NOT EXISTS (SELECT 1 FROM dbo.system_policies WHERE policy_key = 'pit_deduct_insurance_before_tax')
    INSERT INTO dbo.system_policies (policy_id, policy_key, policy_value, value_type, description, updated_at)
    VALUES (NEWID(), 'pit_deduct_insurance_before_tax', 'true', 'boolean', N'Khấu trừ bảo hiểm bắt buộc trước khi tính thuế TNCN (Luật thuế TNCN bắt buộc)', SYSUTCDATETIME());

IF NOT EXISTS (SELECT 1 FROM dbo.system_policies WHERE policy_key = 'pit_deduct_union_fee_before_tax')
    INSERT INTO dbo.system_policies (policy_id, policy_key, policy_value, value_type, description, updated_at)
    VALUES (NEWID(), 'pit_deduct_union_fee_before_tax', 'true', 'boolean', N'Khấu trừ đoàn phí công đoàn trước khi tính thuế TNCN (xác nhận của phòng khám)', SYSUTCDATETIME());

IF NOT EXISTS (SELECT 1 FROM dbo.system_policies WHERE policy_key = 'pit_deduct_other_before_tax')
    INSERT INTO dbo.system_policies (policy_id, policy_key, policy_value, value_type, description, updated_at)
    VALUES (NEWID(), 'pit_deduct_other_before_tax', 'false', 'boolean', N'Khấu trừ các khoản trừ khác trước thuế TNCN (chờ xác nhận)', SYSUTCDATETIME());

IF NOT EXISTS (SELECT 1 FROM dbo.system_policies WHERE policy_key = 'pit_flat_base')
    INSERT INTO dbo.system_policies (policy_id, policy_key, policy_value, value_type, description, updated_at)
    VALUES (NEWID(), 'pit_flat_base', 'gross', 'string', N'Cơ sở tính thuế cố định 10% (gross hoặc after_deductions)', SYSUTCDATETIME());

-- Cấu hình đơn giá trực
UPDATE dbo.payroll_rate_configs SET description = N'Trực tối (chung)' WHERE code = 'duty_night' AND position_id IS NULL;

DECLARE @doctorPosId uniqueidentifier = (SELECT TOP 1 position_id FROM dbo.positions WHERE name = N'Bác sĩ');
IF @doctorPosId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.payroll_rate_configs WHERE code = 'duty_night' AND position_id = @doctorPosId)
BEGIN
    INSERT INTO dbo.payroll_rate_configs (config_id, code, position_id, staff_id, rate_value, unit, description, effective_from, status, created_at)
    VALUES (NEWID(), 'duty_night', @doctorPosId, NULL, 200000, 'vnd', N'Trực tối (Bác sĩ)', '2026-01-01', 'active', SYSUTCDATETIME());
END;
GO

-- =================================================================================================
-- PHẦN 4: CHUẨN HÓA DANH MỤC PHỤ CẤP (ALLOWANCE_TYPES) & GÁN PHỤ CẤP (STAFF_ALLOWANCES)
-- =================================================================================================
PRINT N'4. Cập nhật danh mục phụ cấp và phụ cấp nhân viên...';

-- Sửa tên phụ cấp tiếng Việt có dấu
UPDATE dbo.allowance_types SET name = N'Ăn trưa' WHERE code = 'LUNCH';
UPDATE dbo.allowance_types SET name = N'Chứng chỉ hành nghề' WHERE code = 'PRACTICE_CERT';
UPDATE dbo.allowance_types SET name = N'Trách nhiệm' WHERE code = 'RESPONSIBILITY';
UPDATE dbo.allowance_types SET name = N'Độc hại' WHERE code = 'HAZARD';
UPDATE dbo.allowance_types SET name = N'Thâm niên', default_value = 50000 WHERE code = 'ALLOW_SENIORITY';
UPDATE dbo.allowance_types SET name = N'Điện thoại' WHERE code = 'PHONE';

-- Gán phụ cấp ăn trưa 730k cho tất cả nhân viên nếu chưa có
DECLARE @lunchId uniqueidentifier = (SELECT TOP 1 allowance_id FROM dbo.allowance_types WHERE code = 'LUNCH');
IF @lunchId IS NOT NULL
BEGIN
    INSERT INTO dbo.staff_allowances (staff_allowance_id, staff_id, allowance_id, amount_value, effective_from, status, created_at)
    SELECT NEWID(), s.staff_id, @lunchId, 730000, '2026-01-01', 'active', SYSUTCDATETIME()
    FROM dbo.staff s
    WHERE NOT EXISTS (
        SELECT 1 FROM dbo.staff_allowances sa WHERE sa.staff_id = s.staff_id AND sa.allowance_id = @lunchId
    );
END;
GO

-- =================================================================================================
-- PHẦN 5: CHUẨN HÓA HỢP ĐỒNG LAO ĐỘNG (CONTRACTS)
-- =================================================================================================
PRINT N'5. Đồng bộ cấu trúc lương trên hợp đồng lao động...';

UPDATE dbo.contracts
SET standard_working_days = ISNULL(c.standard_working_days, 26),
    salary_type = CASE 
        WHEN c.daily_rate IS NOT NULL AND c.daily_rate > 0 AND (c.monthly_salary IS NULL OR c.monthly_salary = 0) THEN 'daily'
        WHEN s.full_name LIKE N'%Bác sĩ%' OR s.full_name LIKE N'%BS%' THEN 'daily'
        ELSE 'monthly'
    END,
    monthly_salary = CASE 
        WHEN s.full_name LIKE N'%Bác sĩ%' OR s.full_name LIKE N'%BS%' THEN NULL
        WHEN c.monthly_salary IS NOT NULL AND c.monthly_salary > 0 THEN c.monthly_salary
        ELSE 12000000
    END,
    daily_rate = CASE 
        WHEN s.full_name LIKE N'%Bác sĩ%' OR s.full_name LIKE N'%BS%' THEN ISNULL(c.daily_rate, 1000000)
        WHEN c.monthly_salary IS NOT NULL AND c.monthly_salary > 0 THEN ROUND(c.monthly_salary / ISNULL(c.standard_working_days, 26), 0)
        ELSE ISNULL(c.daily_rate, 461538)
    END,
    insurance_salary_basis = ISNULL(c.insurance_salary_basis, 5000000),
    tax_method = ISNULL(c.tax_method, 'progressive'),
    is_insurance_eligible = ISNULL(c.is_insurance_eligible, 1)
FROM dbo.contracts c
JOIN dbo.staff s ON c.staff_id = s.staff_id;
GO

-- =================================================================================================
-- PHẦN 6: TẠO LỊCH SỬ MỨC LƯƠNG KHỞI ĐIỂM (CONTRACT_SALARY_HISTORIES)
-- =================================================================================================
PRINT N'6. Tạo bản ghi lịch sử mức lương khởi điểm cho hợp đồng...';

-- Tạo bản ghi lịch sử lương ban đầu cho các hợp đồng chưa có lịch sử
INSERT INTO dbo.contract_salary_histories (
    history_id,
    contract_id,
    salary_type,
    daily_rate,
    monthly_salary,
    standard_working_days,
    insurance_salary_basis,
    tax_method,
    effective_from,
    effective_to,
    note,
    created_at
)
SELECT 
    NEWID(),
    c.contract_id,
    c.salary_type,
    ISNULL(c.daily_rate, 0),
    c.monthly_salary,
    ISNULL(c.standard_working_days, 26),
    c.insurance_salary_basis,
    c.tax_method,
    ISNULL(c.effective_from, '2026-01-01'),
    NULL,
    N'Mức lương khởi điểm khi ký hợp đồng',
    SYSUTCDATETIME()
FROM dbo.contracts c
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.contract_salary_histories h WHERE h.contract_id = c.contract_id
);
GO

-- =================================================================================================
-- PHẦN 7: TẠO KỲ LƯƠNG & BẢNG LƯƠNG MẪU NĂM 2026 (PAYROLL_LOCKS & PAYSLIPS)
-- =================================================================================================
PRINT N'7. Khởi tạo kỳ tính lương và phiếu lương mẫu năm 2026...';

-- 7.1. Tạo 3 kỳ lương 2026
IF NOT EXISTS (SELECT 1 FROM dbo.payroll_locks WHERE pay_month = '2026-01')
    INSERT INTO dbo.payroll_locks (lock_id, pay_month, status, locked_at, created_at)
    VALUES (NEWID(), '2026-01', 'approved', '2026-02-05 10:00:00', '2026-01-01 00:00:00');

IF NOT EXISTS (SELECT 1 FROM dbo.payroll_locks WHERE pay_month = '2026-02')
    INSERT INTO dbo.payroll_locks (lock_id, pay_month, status, locked_at, created_at)
    VALUES (NEWID(), '2026-02', 'approved', '2026-03-05 10:00:00', '2026-02-01 00:00:00');

IF NOT EXISTS (SELECT 1 FROM dbo.payroll_locks WHERE pay_month = '2026-03')
    INSERT INTO dbo.payroll_locks (lock_id, pay_month, status, created_at)
    VALUES (NEWID(), '2026-03', 'draft', '2026-03-01 00:00:00');

-- 7.2. Seed phiếu lương cho Tháng 01/2026 (25 nhân viên) nếu chưa có
IF (SELECT COUNT(*) FROM dbo.payslips WHERE pay_month = '2026-01') = 0
BEGIN
    INSERT INTO dbo.payslips (
        payslip_id, staff_id, staff_name, department_id, contract_id, contract_type, pay_month,
        work_days, on_call_days, base_pay, allowance_total, gross_pay, insurance_salary_base,
        insurance_deduction, personal_deduction, dependent_deduction, taxable_income,
        tax_deduction, other_deduction, net_pay, status, is_locked, locked_at, created_at
    )
    SELECT 
        NEWID(),
        s.staff_id,
        s.full_name,
        s.department_id,
        c.contract_id,
        c.contract_type,
        '2026-01',
        ISNULL(c.standard_working_days, 26),
        0,
        CASE WHEN c.salary_type = 'monthly' THEN ISNULL(c.monthly_salary, 12000000) ELSE ISNULL(c.daily_rate, 1000000) * 26 END,
        ISNULL((SELECT SUM(sa.amount_value) FROM dbo.staff_allowances sa WHERE sa.staff_id = s.staff_id AND sa.status = 'active'), 730000),
        (CASE WHEN c.salary_type = 'monthly' THEN ISNULL(c.monthly_salary, 12000000) ELSE ISNULL(c.daily_rate, 1000000) * 26 END) 
        + ISNULL((SELECT SUM(sa.amount_value) FROM dbo.staff_allowances sa WHERE sa.staff_id = s.staff_id AND sa.status = 'active'), 730000),
        c.insurance_salary_basis,
        CASE WHEN c.is_insurance_eligible = 1 THEN ROUND(ISNULL(c.insurance_salary_basis, 5000000) * 0.105, 0) ELSE 0 END,
        11000000,
        0,
        0,
        CASE WHEN (CASE WHEN c.salary_type = 'monthly' THEN ISNULL(c.monthly_salary, 12000000) ELSE ISNULL(c.daily_rate, 1000000) * 26 END) > 20000000 THEN 1250000 ELSE 0 END,
        0,
        ((CASE WHEN c.salary_type = 'monthly' THEN ISNULL(c.monthly_salary, 12000000) ELSE ISNULL(c.daily_rate, 1000000) * 26 END) 
        + ISNULL((SELECT SUM(sa.amount_value) FROM dbo.staff_allowances sa WHERE sa.staff_id = s.staff_id AND sa.status = 'active'), 730000))
        - (CASE WHEN c.is_insurance_eligible = 1 THEN ROUND(ISNULL(c.insurance_salary_basis, 5000000) * 0.105, 0) ELSE 0 END)
        - (CASE WHEN (CASE WHEN c.salary_type = 'monthly' THEN ISNULL(c.monthly_salary, 12000000) ELSE ISNULL(c.daily_rate, 1000000) * 26 END) > 20000000 THEN 1250000 ELSE 0 END),
        'approved',
        1,
        '2026-02-05 10:00:00',
        '2026-01-31 17:00:00'
    FROM dbo.staff s
    JOIN dbo.contracts c ON c.staff_id = s.staff_id;
END;

-- 7.3. Seed phiếu lương cho Tháng 02/2026 (25 nhân viên) nếu chưa có
IF (SELECT COUNT(*) FROM dbo.payslips WHERE pay_month = '2026-02') = 0
BEGIN
    INSERT INTO dbo.payslips (
        payslip_id, staff_id, staff_name, department_id, contract_id, contract_type, pay_month,
        work_days, on_call_days, base_pay, allowance_total, gross_pay, insurance_salary_base,
        insurance_deduction, personal_deduction, dependent_deduction, taxable_income,
        tax_deduction, other_deduction, net_pay, status, is_locked, locked_at, created_at
    )
    SELECT 
        NEWID(),
        s.staff_id,
        s.full_name,
        s.department_id,
        c.contract_id,
        c.contract_type,
        '2026-02',
        ISNULL(c.standard_working_days, 26),
        0,
        CASE WHEN c.salary_type = 'monthly' THEN ISNULL(c.monthly_salary, 12000000) ELSE ISNULL(c.daily_rate, 1000000) * 26 END,
        ISNULL((SELECT SUM(sa.amount_value) FROM dbo.staff_allowances sa WHERE sa.staff_id = s.staff_id AND sa.status = 'active'), 730000),
        (CASE WHEN c.salary_type = 'monthly' THEN ISNULL(c.monthly_salary, 12000000) ELSE ISNULL(c.daily_rate, 1000000) * 26 END) 
        + ISNULL((SELECT SUM(sa.amount_value) FROM dbo.staff_allowances sa WHERE sa.staff_id = s.staff_id AND sa.status = 'active'), 730000),
        c.insurance_salary_basis,
        CASE WHEN c.is_insurance_eligible = 1 THEN ROUND(ISNULL(c.insurance_salary_basis, 5000000) * 0.105, 0) ELSE 0 END,
        11000000,
        0,
        0,
        CASE WHEN (CASE WHEN c.salary_type = 'monthly' THEN ISNULL(c.monthly_salary, 12000000) ELSE ISNULL(c.daily_rate, 1000000) * 26 END) > 20000000 THEN 1250000 ELSE 0 END,
        0,
        ((CASE WHEN c.salary_type = 'monthly' THEN ISNULL(c.monthly_salary, 12000000) ELSE ISNULL(c.daily_rate, 1000000) * 26 END) 
        + ISNULL((SELECT SUM(sa.amount_value) FROM dbo.staff_allowances sa WHERE sa.staff_id = s.staff_id AND sa.status = 'active'), 730000))
        - (CASE WHEN c.is_insurance_eligible = 1 THEN ROUND(ISNULL(c.insurance_salary_basis, 5000000) * 0.105, 0) ELSE 0 END)
        - (CASE WHEN (CASE WHEN c.salary_type = 'monthly' THEN ISNULL(c.monthly_salary, 12000000) ELSE ISNULL(c.daily_rate, 1000000) * 26 END) > 20000000 THEN 1250000 ELSE 0 END),
        'approved',
        1,
        '2026-03-05 10:00:00',
        '2026-02-28 17:00:00'
    FROM dbo.staff s
    JOIN dbo.contracts c ON c.staff_id = s.staff_id;
END;
GO

PRINT N'>>> HOÀN TẤT CẬP NHẬT DỮ LIỆU ITERATION 1 THÀNH CÔNG!';
GO
