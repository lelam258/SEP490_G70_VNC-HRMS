/*
====================================================================================================
VNC HRMS - ITERATION 2 SEED DATA (PHÒNG KHÁM ĐA KHOA VIỆT NHẬT - CƠ SỞ 1)
Đồng bộ hợp đồng, phụ cấp, chấm công, ca trực, thủ thuật & bảng công theo bảng lương thật (Lương.xlsx)
Dùng cho Tasks 70 - 75 (Tính lương tháng, Xem kết quả, Chi tiết, Rà soát, Xác nhận, Chốt sổ)
Database: VNC_HRMS_Iteration1 (Idempotent - an toàn khi chạy lại nhiều lần)
====================================================================================================
*/

USE [VNC_HRMS_Iteration1];
GO

SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

PRINT N'>>> BẮT ĐẦU ĐỒNG BỘ DỮ LIỆU CƠ SỞ 1 CHO TASKS 70-75...';

-- =================================================================================================
-- 1. CƠ SỞ, CHỨC DANH & BẬC THUẾ TNCN CHUẨN
-- =================================================================================================
DECLARE @cs1SiteId uniqueidentifier = (SELECT TOP 1 site_id FROM dbo.sites WHERE site_code = 'CS1');
IF @cs1SiteId IS NULL
BEGIN
    SET @cs1SiteId = NEWID();
    INSERT INTO dbo.sites (site_id, site_code, name, address, status)
    VALUES (@cs1SiteId, 'CS1', N'Cơ sở 1 - Phòng khám Đa khoa Việt Nhật', N'58 Phố Mới, Như Quỳnh, Văn Lâm, Hưng Yên', 'active');
END;

DECLARE @cs1FacilityId uniqueidentifier = (SELECT TOP 1 Id FROM dbo.ScheduleFacilities WHERE Name LIKE N'%Cơ sở 1%' ORDER BY Name);
IF @cs1FacilityId IS NULL
    SET @cs1FacilityId = '11111111-1111-4111-8111-111111111111';

-- Đảm bảo đủ 5 bậc thuế TNCN (Bậc 1: 0 - 10tr = 5% phải active)
UPDATE dbo.payroll_tax_brackets
SET status = 'active'
WHERE income_from = 0 AND income_to = 10000000;

IF NOT EXISTS (SELECT 1 FROM dbo.payroll_tax_brackets WHERE status = 'active' AND income_from = 0)
BEGIN
    INSERT INTO dbo.payroll_tax_brackets (bracket_id, income_from, income_to, tax_rate_percent, effective_from, status)
    VALUES (NEWID(), 0, 10000000, 5.00, '2026-01-01', 'active');
END;

-- Đảm bảo danh mục chức danh chuẩn
IF NOT EXISTS (SELECT 1 FROM dbo.positions WHERE name = N'Kế toán')
    INSERT INTO dbo.positions (position_id, name, scope_tag, status) VALUES (NEWID(), N'Kế toán', 'admin', 'active');

DECLARE @posDoctor uniqueidentifier = (SELECT TOP 1 position_id FROM dbo.positions WHERE name = N'Bác sĩ');
DECLARE @posNurse uniqueidentifier = (SELECT TOP 1 position_id FROM dbo.positions WHERE name = N'Điều dưỡng');
DECLARE @posNurseAid uniqueidentifier = (SELECT TOP 1 position_id FROM dbo.positions WHERE name = N'Y tá');
DECLARE @posTech uniqueidentifier = (SELECT TOP 1 position_id FROM dbo.positions WHERE name = N'Kỹ thuật viên');
DECLARE @posPharm uniqueidentifier = (SELECT TOP 1 position_id FROM dbo.positions WHERE name = N'Dược sĩ');
DECLARE @posAcc uniqueidentifier = (SELECT TOP 1 position_id FROM dbo.positions WHERE name = N'Kế toán');

-- =================================================================================================
-- 2. ĐỒNG BỘ HỒ SƠ, HỢP ĐỒNG & PHỤ CẤP THEO FILE LƯƠNG THẬT CƠ SỞ 1 (Lương.xlsx)
-- =================================================================================================
DECLARE @ClinicConfig TABLE (
    staff_code nvarchar(20) NOT NULL PRIMARY KEY,
    position_id uniqueidentifier NULL,
    date_joined date NOT NULL,
    dependent_count int NOT NULL,
    is_union_member bit NOT NULL,
    salary_type nvarchar(20) NOT NULL,
    daily_rate decimal(15,2) NOT NULL,
    monthly_salary decimal(15,2) NULL,
    standard_working_days decimal(5,2) NOT NULL,
    is_insurance_eligible bit NOT NULL,
    insurance_salary_basis decimal(15,2) NULL,
    -- Số liệu tháng mẫu (Lương.xlsx Tháng 7)
    work_days decimal(5,2) NOT NULL,
    ot_hours decimal(5,2) NOT NULL,
    evening_duties int NOT NULL,
    noon_duties int NOT NULL,
    proc_commission decimal(15,2) NOT NULL,
    -- Phụ cấp từ Lương.xlsx
    allow_resp decimal(15,2) NOT NULL,
    allow_basic decimal(15,2) NOT NULL,
    allow_hazard decimal(15,2) NOT NULL,
    allow_cert decimal(15,2) NOT NULL,
    allow_ins_sign decimal(15,2) NOT NULL,
    has_seniority bit NOT NULL,
    prorate_allow bit NOT NULL
);

INSERT INTO @ClinicConfig VALUES
('NV-01', @posDoctor,   '2021-01-01', 0, 1, 'daily',   1000000, NULL,    26, 1, 5061100, 30.0, 0.0, 12, 3, 5900000, 10000000, 0,       0,       0,       0,      0, 0),
('NV-02', @posDoctor,   '2021-01-01', 1, 1, 'daily',    900000, NULL,    26, 1, 5061100, 25.0, 0.0,  6, 1, 3145000, 0,        0,       0,       0,       0,      0, 0),
('NV-03', @posDoctor,   '2021-01-01', 0, 1, 'daily',    800000, NULL,    26, 0, NULL,    21.5, 0.0,  1, 0, 2045000, 0,        0,       0,       0,       0,      0, 0),
('NV-04', @posDoctor,   '2021-01-01', 0, 0, 'daily',   1000000, NULL,    26, 0, NULL,     4.0, 0.0,  4, 2, 3180000, 0,        0,       0,       0,       0,      0, 0),
('NV-05', @posDoctor,   '2021-01-01', 1, 1, 'daily',    800000, NULL,    26, 1, 5061100, 23.0, 0.0,  1, 0, 2025000, 0,        0,       0,       0,       0,      0, 0),
('NV-06', @posTech,     '2023-01-01', 0, 1, 'daily',    700000, NULL,    26, 1, 5061100, 29.0, 0.0,  0, 0, 4536080, 0,        0,       0,       1000000, 0,      1, 0),
('NV-07', @posNurseAid, '2022-01-01', 0, 1, 'monthly',  192308, 5000000, 26, 1, 5061100, 28.5, 3.0,  1, 4,       0, 2800000,  800000,  500000,  0,       500000, 1, 0),
('NV-08', @posTech,     '2022-01-01', 0, 1, 'monthly',  192308, 5000000, 26, 1, 5061100, 31.0, 2.5,  0, 5,       0, 2800000,  1300000, 500000,  0,       0,      1, 0),
('NV-09', @posAcc,      '2021-01-01', 4, 1, 'daily',   1000000, NULL,    26, 1, 5061100, 31.0, 0.0, 22, 0,       0, 0,        0,       0,       0,       0,      0, 0),
('NV-11', @posNurse,    '2023-01-01', 0, 1, 'monthly',  192308, 5000000, 26, 1, 5061100, 27.5, 0.0,  0, 5,   50000, 2000000,  850000,  0,       0,       0,      1, 0),
('NV-12', @posNurse,    '2023-01-01', 0, 1, 'monthly',  192308, 5000000, 26, 1, 5061100, 26.0, 0.0,  1, 5,       0, 1800000,  850000,  0,       0,       0,      1, 0),
('NV-13', @posTech,     '2023-01-01', 0, 1, 'daily',    550000, NULL,    26, 1, 5061100, 31.0, 0.0,  0, 0, 3075000, 0,        0,       0,       1000000, 0,      1, 0),
('NV-15', @posTech,     '2024-06-01', 0, 1, 'monthly',  192308, 5000000, 26, 1, 5061100, 27.5, 1.5,  0, 0,       0, 2000000,  1000000, 2000000, 2000000, 0,      0, 1),
('NV-16', @posNurseAid, '2024-06-01', 0, 1, 'monthly',  192308, 5000000, 26, 0, NULL,    30.0, 0.0,  0, 0,       0, 0,        0,       0,       0,       0,      0, 0),
('NV-17', @posNurse,    '2024-06-01', 0, 1, 'monthly',  192308, 5000000, 26, 1, 5061100, 29.0, 0.5, 20, 5,   50000, 1000000,  1000000, 0,       500000,  0,      0, 0),
('NV-18', @posPharm,    '2024-06-01', 0, 1, 'monthly',  192308, 5000000, 26, 0, NULL,    28.5, 3.0,  0, 0,       0, 1000000,  1000000, 0,       0,       0,      0, 0),
('NV-19', @posAcc,      '2024-06-01', 0, 1, 'monthly',  192308, 5000000, 26, 0, NULL,    23.0, 6.0,  0, 0,       0, 0,        0,       0,       0,       0,      0, 0),
('NV-20', @posTech,     '2024-06-01', 0, 1, 'monthly',  192308, 5000000, 26, 1, 5061100, 25.0, 0.5, 13, 3,       0, 3000000,  2000000, 2000000, 3000000, 0,      0, 1),
('NV-21', @posTech,     '2024-06-01', 0, 0, 'monthly',  833333, 5000000,  6, 0, NULL,    10.0, 0.0,  0, 0,       0, 1000000,  1000000, 0,       0,       0,      0, 1),
('NV-22', @posNurse,    '2024-06-01', 0, 0, 'monthly',  192308, 5000000, 26, 0, NULL,    24.0, 0.0,  0, 0,       0, 1000000,  1000000, 0,       0,       0,      0, 1),
-- Nhân sự văn phòng / quản lý tại Cơ sở 1 (công chuẩn 26)
('HE173168', @posNurse, '2024-06-01', 0, 1, 'monthly',  461538, 12000000, 26, 1, 5061100, 26.0, 0.0, 0, 0,       0, 0,        0,       0,       0,       0,      0, 0),
('HS170170', @posNurse, '2024-06-01', 1, 1, 'monthly',  461538, 12000000, 26, 1, 5061100, 26.0, 0.0, 0, 0,       0, 0,        0,       0,       0,       0,      0, 0),
('NV-KT01',  @posAcc,   '2024-01-01', 0, 1, 'monthly',  576923, 15000000, 26, 1, 5061100, 26.0, 0.0, 0, 0,       0, 1500000,  0,       0,       0,       0,      0, 0),
('NV-HR01',  @posAcc,   '2023-01-01', 0, 1, 'monthly',  653846, 17000000, 26, 1, 5061100, 26.0, 0.0, 0, 0,       0, 1500000,  0,       0,       0,       0,      0, 0),
('NV-ADM01', @posAcc,   '2022-01-01', 0, 1, 'monthly',  461538, 12000000, 26, 1, 5061100, 26.0, 0.0, 0, 0,       0, 1500000,  0,       0,       0,       0,      0, 0);

-- Cập nhật thông tin staff thuộc CS1
UPDATE s
SET s.site_id = @cs1SiteId,
    s.position_id = ISNULL(cfg.position_id, s.position_id),
    s.date_joined = cfg.date_joined,
    s.dependent_count = cfg.dependent_count,
    s.is_union_member = cfg.is_union_member,
    s.updated_at = SYSUTCDATETIME()
FROM dbo.staff s
JOIN @ClinicConfig cfg ON s.staff_code = cfg.staff_code;

-- Đồng bộ hợp đồng đang hiệu lực
UPDATE c
SET c.salary_type = cfg.salary_type,
    c.daily_rate = cfg.daily_rate,
    c.monthly_salary = cfg.monthly_salary,
    c.standard_working_days = cfg.standard_working_days,
    c.is_insurance_eligible = cfg.is_insurance_eligible,
    c.insurance_salary_basis = cfg.insurance_salary_basis,
    c.tax_method = ISNULL(c.tax_method, 'progressive'),
    c.effective_from = CASE WHEN c.effective_from > '2026-01-01' THEN '2026-01-01' ELSE c.effective_from END,
    c.updated_at = SYSUTCDATETIME()
FROM dbo.contracts c
JOIN dbo.staff s ON c.staff_id = s.staff_id
JOIN @ClinicConfig cfg ON s.staff_code = cfg.staff_code
WHERE c.status = 'active';

-- Đồng bộ lịch sử lương hợp đồng (contract_salary_histories) vì API /api/compensation/contracts đọc mức lương hiệu lực từ bảng này
UPDATE h
SET h.salary_type = cfg.salary_type,
    h.daily_rate = cfg.daily_rate,
    h.monthly_salary = cfg.monthly_salary,
    h.standard_working_days = cfg.standard_working_days,
    h.is_insurance_eligible = cfg.is_insurance_eligible,
    h.insurance_salary_basis = cfg.insurance_salary_basis,
    h.tax_method = ISNULL(c.tax_method, 'progressive'),
    h.effective_from = '2026-01-01',
    h.effective_to = c.effective_to,
    h.note = CASE
        WHEN cfg.salary_type = 'daily' THEN N'Đồng bộ đơn giá lương theo ngày (CS1 - Lương.xlsx)'
        ELSE N'Đồng bộ lương tháng theo ' + CAST(CAST(cfg.standard_working_days AS int) AS nvarchar(10)) + N' ngày công chuẩn (CS1 - Lương.xlsx)'
    END
FROM dbo.contract_salary_histories h
JOIN dbo.contracts c ON h.contract_id = c.contract_id
JOIN dbo.staff s ON c.staff_id = s.staff_id
JOIN @ClinicConfig cfg ON s.staff_code = cfg.staff_code
WHERE c.status = 'active';

INSERT INTO dbo.contract_salary_histories (
    history_id, contract_id, salary_type, daily_rate, monthly_salary,
    insurance_salary_basis, standard_working_days, tax_method,
    effective_from, effective_to, note, created_at, is_insurance_eligible
)
SELECT
    NEWID(),
    c.contract_id,
    cfg.salary_type,
    cfg.daily_rate,
    cfg.monthly_salary,
    cfg.insurance_salary_basis,
    cfg.standard_working_days,
    ISNULL(c.tax_method, 'progressive'),
    '2026-01-01',
    c.effective_to,
    CASE
        WHEN cfg.salary_type = 'daily' THEN N'Khởi tạo đơn giá lương theo ngày (CS1 - Lương.xlsx)'
        ELSE N'Khởi tạo lương tháng theo ' + CAST(CAST(cfg.standard_working_days AS int) AS nvarchar(10)) + N' ngày công chuẩn (CS1 - Lương.xlsx)'
    END,
    SYSUTCDATETIME(),
    cfg.is_insurance_eligible
FROM dbo.contracts c
JOIN dbo.staff s ON c.staff_id = s.staff_id
JOIN @ClinicConfig cfg ON s.staff_code = cfg.staff_code
WHERE c.status = 'active'
  AND NOT EXISTS (
      SELECT 1 FROM dbo.contract_salary_histories h WHERE h.contract_id = c.contract_id
  );

-- Đồng bộ phụ cấp của nhân viên phòng khám (NV-01..NV-22) theo đúng bảng lương
DECLARE @alResp uniqueidentifier = (SELECT TOP 1 allowance_id FROM dbo.allowance_types WHERE code = 'ALLOW_RESPONSIBILITY');
DECLARE @alBasic uniqueidentifier = (SELECT TOP 1 allowance_id FROM dbo.allowance_types WHERE code = 'ALLOW_BASIC');
DECLARE @alHazard uniqueidentifier = (SELECT TOP 1 allowance_id FROM dbo.allowance_types WHERE code = 'ALLOW_HAZARD');
DECLARE @alCert uniqueidentifier = (SELECT TOP 1 allowance_id FROM dbo.allowance_types WHERE code = 'ALLOW_PRACTICE_CERT');
DECLARE @alInsSign uniqueidentifier = (SELECT TOP 1 allowance_id FROM dbo.allowance_types WHERE code = 'ALLOW_INS_SIGN');
DECLARE @alSenior uniqueidentifier = (SELECT TOP 1 allowance_id FROM dbo.allowance_types WHERE code = 'ALLOW_SENIORITY');

DELETE sa
FROM dbo.staff_allowances sa
JOIN dbo.staff s ON sa.staff_id = s.staff_id
WHERE s.staff_code LIKE 'NV-[0-2][0-9]';

INSERT INTO dbo.staff_allowances (staff_allowance_id, staff_id, allowance_id, value_type, amount_value, calc_method, effective_from, status, created_at)
SELECT NEWID(), s.staff_id, @alResp, 'fixed', cfg.allow_resp, CASE WHEN cfg.prorate_allow = 1 THEN 'prorate_by_workdays' ELSE 'fixed' END, '2026-01-01', 'active', SYSUTCDATETIME()
FROM dbo.staff s JOIN @ClinicConfig cfg ON s.staff_code = cfg.staff_code
WHERE s.staff_code LIKE 'NV-[0-2][0-9]' AND cfg.allow_resp > 0 AND @alResp IS NOT NULL;

INSERT INTO dbo.staff_allowances (staff_allowance_id, staff_id, allowance_id, value_type, amount_value, calc_method, effective_from, status, created_at)
SELECT NEWID(), s.staff_id, @alBasic, 'fixed', cfg.allow_basic, CASE WHEN cfg.prorate_allow = 1 THEN 'prorate_by_workdays' ELSE 'fixed' END, '2026-01-01', 'active', SYSUTCDATETIME()
FROM dbo.staff s JOIN @ClinicConfig cfg ON s.staff_code = cfg.staff_code
WHERE s.staff_code LIKE 'NV-[0-2][0-9]' AND cfg.allow_basic > 0 AND @alBasic IS NOT NULL;

INSERT INTO dbo.staff_allowances (staff_allowance_id, staff_id, allowance_id, value_type, amount_value, calc_method, effective_from, status, created_at)
SELECT NEWID(), s.staff_id, @alHazard, 'fixed', cfg.allow_hazard, CASE WHEN cfg.prorate_allow = 1 THEN 'prorate_by_workdays' ELSE 'fixed' END, '2026-01-01', 'active', SYSUTCDATETIME()
FROM dbo.staff s JOIN @ClinicConfig cfg ON s.staff_code = cfg.staff_code
WHERE s.staff_code LIKE 'NV-[0-2][0-9]' AND cfg.allow_hazard > 0 AND @alHazard IS NOT NULL;

INSERT INTO dbo.staff_allowances (staff_allowance_id, staff_id, allowance_id, value_type, amount_value, calc_method, effective_from, status, created_at)
SELECT NEWID(), s.staff_id, @alCert, 'fixed', cfg.allow_cert, CASE WHEN cfg.prorate_allow = 1 THEN 'prorate_by_workdays' ELSE 'fixed' END, '2026-01-01', 'active', SYSUTCDATETIME()
FROM dbo.staff s JOIN @ClinicConfig cfg ON s.staff_code = cfg.staff_code
WHERE s.staff_code LIKE 'NV-[0-2][0-9]' AND cfg.allow_cert > 0 AND @alCert IS NOT NULL;

INSERT INTO dbo.staff_allowances (staff_allowance_id, staff_id, allowance_id, value_type, amount_value, calc_method, effective_from, status, created_at)
SELECT NEWID(), s.staff_id, @alInsSign, 'fixed', cfg.allow_ins_sign, 'fixed', '2026-01-01', 'active', SYSUTCDATETIME()
FROM dbo.staff s JOIN @ClinicConfig cfg ON s.staff_code = cfg.staff_code
WHERE s.staff_code LIKE 'NV-[0-2][0-9]' AND cfg.allow_ins_sign > 0 AND @alInsSign IS NOT NULL;

INSERT INTO dbo.staff_allowances (staff_allowance_id, staff_id, allowance_id, value_type, amount_value, calc_method, effective_from, status, created_at)
SELECT NEWID(), s.staff_id, @alSenior, 'fixed', 50000, 'per_service_year', '2026-01-01', 'active', SYSUTCDATETIME()
FROM dbo.staff s JOIN @ClinicConfig cfg ON s.staff_code = cfg.staff_code
WHERE s.staff_code LIKE 'NV-[0-2][0-9]' AND cfg.has_seniority = 1 AND @alSenior IS NOT NULL;

-- =================================================================================================
-- 3. SEED DỮ LIỆU LỊCH LÀM VIỆC, CHẤM CÔNG, CA TRỰC & THỦ THUẬT
--    Cho các kỳ lương: 2026-10 (Gần đây nhất - có đủ Lịch tuần, Công, Trực & Thủ thuật), 2026-07 và 2026-03
--    Quy tắc rải lịch tuần: Ưu tiên xếp ngày Thứ Hai -> Thứ Bảy trước (công chuẩn 26 ngày, nghỉ Chủ nhật);
--    chỉ nhân sự có tổng công thực tế > số ngày Thứ 2..Thứ 7 trong tháng mới xếp thêm vào ngày Chủ nhật.
-- =================================================================================================
DECLARE @actorId uniqueidentifier = ISNULL((SELECT TOP 1 user_id FROM dbo.users WHERE username = 'long123'), NEWID());
DECLARE @verifierId uniqueidentifier = ISNULL((SELECT TOP 1 user_id FROM dbo.users WHERE username = 'accountant'), @actorId);
DECLARE @defaultDeptId uniqueidentifier = ISNULL(
    (SELECT TOP 1 department_id FROM dbo.departments WHERE status = 'active' AND dept_code = 'H1'),
    (SELECT TOP 1 department_id FROM dbo.departments WHERE status = 'active' ORDER BY dept_code)
);
DECLARE @defaultServiceId uniqueidentifier = ISNULL(
    (SELECT TOP 1 service_id FROM dbo.procedure_services WHERE service_code = 'TK-01'),
    (SELECT TOP 1 service_id FROM dbo.procedure_services)
);

-- Đảm bảo ScheduleCoverage tồn tại cho các khoa của nhân sự CS1 tại Cơ sở 1
;WITH MonthDepts AS (
    SELECT DISTINCT ISNULL(s.department_id, @defaultDeptId) AS dept_id
    FROM dbo.staff s
    JOIN @ClinicConfig cfg ON s.staff_code = cfg.staff_code
)
INSERT INTO dbo.ScheduleCoverage (Id, FacilityId, DepartmentId, Name)
SELECT NEWID(), @cs1FacilityId, d.department_id, d.name
FROM dbo.departments d
JOIN MonthDepts md ON d.department_id = md.dept_id
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.ScheduleCoverage c
    WHERE c.FacilityId = @cs1FacilityId AND c.DepartmentId = d.department_id
);

DECLARE @Months TABLE (pay_month nvarchar(7), month_start date);
INSERT INTO @Months VALUES ('2026-10', '2026-10-01'), ('2026-07', '2026-07-01'), ('2026-03', '2026-03-01');

DECLARE @Days TABLE (d int NOT NULL PRIMARY KEY);
;WITH Nums AS (
    SELECT 1 AS d
    UNION ALL
    SELECT d + 1 FROM Nums WHERE d < 31
)
INSERT INTO @Days SELECT d FROM Nums;

DECLARE @MonthDays TABLE (
    work_seq int NOT NULL PRIMARY KEY,
    work_date date NOT NULL,
    monday date NOT NULL,
    is_sunday bit NOT NULL
);

DECLARE @curMonth nvarchar(7), @mStart date, @mEnd date;
DECLARE mCursor CURSOR LOCAL FAST_FORWARD FOR SELECT pay_month, month_start FROM @Months;
OPEN mCursor;
FETCH NEXT FROM mCursor INTO @curMonth, @mStart;

WHILE @@FETCH_STATUS = 0
BEGIN
    SET @mEnd = EOMONTH(@mStart);

    -- Lập bảng thứ tự ngày làm việc trong tháng: Thứ 2..Thứ 7 trước (is_sunday = 0), Chủ nhật sau (is_sunday = 1)
    DELETE FROM @MonthDays;

    ;WITH RawDays AS (
        SELECT
            DATEADD(DAY, d.d - 1, @mStart) AS work_date,
            DATEADD(DAY, -(DATEDIFF(DAY, CAST('1900-01-01' AS date), DATEADD(DAY, d.d - 1, @mStart)) % 7), DATEADD(DAY, d.d - 1, @mStart)) AS monday,
            CASE WHEN (DATEDIFF(DAY, CAST('1900-01-01' AS date), DATEADD(DAY, d.d - 1, @mStart)) % 7) = 6 THEN 1 ELSE 0 END AS is_sunday
        FROM @Days d
        WHERE d.d <= DAY(@mEnd)
    )
    INSERT INTO @MonthDays (work_seq, work_date, monday, is_sunday)
    SELECT
        ROW_NUMBER() OVER (ORDER BY is_sunday ASC, work_date ASC) AS work_seq,
        work_date,
        monday,
        is_sunday
    FROM RawDays;

    -- Gỡ liên kết cũ ở on_call_shifts trước khi làm sạch lịch và bản ghi seed để tránh lỗi khóa ngoại
    UPDATE oc
    SET oc.ScheduleAssignmentId = NULL,
        oc.AttendanceEvidenceId = NULL
    FROM dbo.on_call_shifts oc
    WHERE oc.shift_date BETWEEN @mStart AND @mEnd;

    -- Làm sạch bản ghi seed cũ (nếu chạy lại script) để đảm bảo không trùng ngày công / ca phân công
    DELETE pa
    FROM dbo.procedure_assignments pa
    JOIN dbo.procedure_slips ps ON pa.slip_id = ps.slip_id
    WHERE ps.procedure_date BETWEEN @mStart AND @mEnd
      AND ps.slip_number LIKE 'TT-CS1-' + @curMonth + '-%';

    DELETE FROM dbo.procedure_slips
    WHERE procedure_date BETWEEN @mStart AND @mEnd
      AND slip_number LIKE 'TT-CS1-' + @curMonth + '-%';

    DELETE sa
    FROM dbo.ScheduleAssignments sa
    JOIN dbo.staff s ON sa.StaffId = s.staff_id
    JOIN @ClinicConfig cfg ON s.staff_code = cfg.staff_code
    WHERE sa.[Date] BETWEEN @mStart AND @mEnd
      AND sa.Reason = N'[Seed CS1 Iter2]';

    DELETE oc
    FROM dbo.on_call_shifts oc
    JOIN dbo.staff s ON oc.staff_id = s.staff_id
    JOIN @ClinicConfig cfg ON s.staff_code = cfg.staff_code
    WHERE oc.shift_date BETWEEN @mStart AND @mEnd
      AND oc.note = N'[Seed CS1 Iter2]';

    DELETE ar
    FROM dbo.attendance_records ar
    JOIN dbo.staff s ON ar.staff_id = s.staff_id
    JOIN @ClinicConfig cfg ON s.staff_code = cfg.staff_code
    WHERE ar.work_date BETWEEN @mStart AND @mEnd
      AND ar.note = N'[Seed CS1 Iter2]';

    -- 3.0. Đồng bộ Lịch làm việc tuần (ScheduleWeeks Published = 1 & ScheduleAssignments)
    ;WITH MonthDepts AS (
        SELECT DISTINCT ISNULL(s.department_id, @defaultDeptId) AS dept_id
        FROM dbo.staff s
        JOIN @ClinicConfig cfg ON s.staff_code = cfg.staff_code
    ),
    MonthMondays AS (
        SELECT DISTINCT monday FROM @MonthDays
    )
    INSERT INTO dbo.ScheduleWeeks (Id, DepartmentId, Monday, Published)
    SELECT NEWID(), md.dept_id, mm.monday, 1
    FROM MonthDepts md
    CROSS JOIN MonthMondays mm
    WHERE md.dept_id IS NOT NULL
      AND NOT EXISTS (
          SELECT 1 FROM dbo.ScheduleWeeks w
          WHERE w.DepartmentId = md.dept_id AND w.Monday = mm.monday
      );

    UPDATE w
    SET w.Published = 1
    FROM dbo.ScheduleWeeks w
    WHERE w.DepartmentId IN (
        SELECT DISTINCT ISNULL(s.department_id, @defaultDeptId)
        FROM dbo.staff s
        JOIN @ClinicConfig cfg ON s.staff_code = cfg.staff_code
    )
      AND w.Monday IN (SELECT DISTINCT monday FROM @MonthDays);

    -- Ca Sáng (morning): cho mọi ngày có đi làm (ưu tiên Thứ 2..Thứ 7 trước, Chủ nhật sau)
    INSERT INTO dbo.ScheduleAssignments (
        Id, WeekId, StaffId, CoverageId, [Date], Shift, Cancelled, Reason, PatientConfirmed
    )
    SELECT
        NEWID(),
        w.Id,
        s.staff_id,
        cov.Id,
        md.work_date,
        'morning',
        0,
        N'[Seed CS1 Iter2]',
        0
    FROM dbo.staff s
    JOIN @ClinicConfig cfg ON s.staff_code = cfg.staff_code
    JOIN @MonthDays md ON md.work_seq <= CEILING(cfg.work_days)
    OUTER APPLY (
        SELECT TOP 1 c.Id FROM dbo.ScheduleCoverage c
        WHERE c.DepartmentId = ISNULL(s.department_id, @defaultDeptId) AND c.FacilityId = @cs1FacilityId
        ORDER BY c.Name
    ) cov
    JOIN dbo.ScheduleWeeks w
        ON w.DepartmentId = ISNULL(s.department_id, @defaultDeptId)
       AND w.Monday = md.monday
    WHERE cov.Id IS NOT NULL
      AND NOT EXISTS (
          SELECT 1 FROM dbo.ScheduleAssignments ex
          WHERE ex.StaffId = s.staff_id
            AND ex.[Date] = md.work_date
            AND ex.Shift = 'morning'
            AND (ex.CoverageId = cov.Id OR ex.Cancelled = 0)
      );

    -- Ca Chiều (afternoon): cho mọi ngày làm đủ 1.0 công
    INSERT INTO dbo.ScheduleAssignments (
        Id, WeekId, StaffId, CoverageId, [Date], Shift, Cancelled, Reason, PatientConfirmed
    )
    SELECT
        NEWID(),
        w.Id,
        s.staff_id,
        cov.Id,
        md.work_date,
        'afternoon',
        0,
        N'[Seed CS1 Iter2]',
        0
    FROM dbo.staff s
    JOIN @ClinicConfig cfg ON s.staff_code = cfg.staff_code
    JOIN @MonthDays md ON md.work_seq <= FLOOR(cfg.work_days)
    OUTER APPLY (
        SELECT TOP 1 c.Id FROM dbo.ScheduleCoverage c
        WHERE c.DepartmentId = ISNULL(s.department_id, @defaultDeptId) AND c.FacilityId = @cs1FacilityId
        ORDER BY c.Name
    ) cov
    JOIN dbo.ScheduleWeeks w
        ON w.DepartmentId = ISNULL(s.department_id, @defaultDeptId)
       AND w.Monday = md.monday
    WHERE cov.Id IS NOT NULL
      AND NOT EXISTS (
          SELECT 1 FROM dbo.ScheduleAssignments ex
          WHERE ex.StaffId = s.staff_id
            AND ex.[Date] = md.work_date
            AND ex.Shift = 'afternoon'
            AND (ex.CoverageId = cov.Id OR ex.Cancelled = 0)
      );

    -- Ca Trực trưa (noon): đã xác nhận công trực & kết thúc ca trực
    INSERT INTO dbo.ScheduleAssignments (
        Id, WeekId, StaffId, CoverageId, [Date], Shift, Cancelled, Reason,
        PatientConfirmed, PatientEvidence, ConfirmedBy, ConfirmedAt,
        ActualEndAt, EndNote, EndRecordedBy, EndRecordedAt
    )
    SELECT
        NEWID(),
        w.Id,
        s.staff_id,
        cov.Id,
        md.work_date,
        'noon',
        0,
        N'[Seed CS1 Iter2]',
        1,
        N'Đã xác nhận công trực trưa CS1',
        @actorId,
        SYSUTCDATETIME(),
        TODATETIMEOFFSET(DATEADD(MINUTE, 13 * 60 + 30, CAST(md.work_date AS datetime2(0))), '+07:00'),
        N'Hoàn thành ca trực trưa',
        @actorId,
        SYSUTCDATETIME()
    FROM dbo.staff s
    JOIN @ClinicConfig cfg ON s.staff_code = cfg.staff_code
    JOIN @MonthDays md ON md.work_seq <= cfg.noon_duties
    OUTER APPLY (
        SELECT TOP 1 c.Id FROM dbo.ScheduleCoverage c
        WHERE c.DepartmentId = ISNULL(s.department_id, @defaultDeptId) AND c.FacilityId = @cs1FacilityId
        ORDER BY c.Name
    ) cov
    JOIN dbo.ScheduleWeeks w
        ON w.DepartmentId = ISNULL(s.department_id, @defaultDeptId)
       AND w.Monday = md.monday
    WHERE cfg.noon_duties > 0
      AND cov.Id IS NOT NULL
      AND NOT EXISTS (
          SELECT 1 FROM dbo.ScheduleAssignments ex
          WHERE ex.StaffId = s.staff_id
            AND ex.[Date] = md.work_date
            AND ex.Shift = 'noon'
            AND (ex.CoverageId = cov.Id OR ex.Cancelled = 0)
      );

    -- Ca Trực tối (evening): đã xác nhận công trực & kết thúc ca trực
    INSERT INTO dbo.ScheduleAssignments (
        Id, WeekId, StaffId, CoverageId, [Date], Shift, Cancelled, Reason,
        PatientConfirmed, PatientEvidence, ConfirmedBy, ConfirmedAt,
        ActualEndAt, EndNote, EndRecordedBy, EndRecordedAt
    )
    SELECT
        NEWID(),
        w.Id,
        s.staff_id,
        cov.Id,
        md.work_date,
        'evening',
        0,
        N'[Seed CS1 Iter2]',
        1,
        N'Đã xác nhận công trực tối CS1',
        @actorId,
        SYSUTCDATETIME(),
        TODATETIMEOFFSET(DATEADD(HOUR, 19, CAST(md.work_date AS datetime2(0))), '+07:00'),
        N'Hoàn thành ca trực tối',
        @actorId,
        SYSUTCDATETIME()
    FROM dbo.staff s
    JOIN @ClinicConfig cfg ON s.staff_code = cfg.staff_code
    JOIN @MonthDays md ON md.work_seq <= cfg.evening_duties
    OUTER APPLY (
        SELECT TOP 1 c.Id FROM dbo.ScheduleCoverage c
        WHERE c.DepartmentId = ISNULL(s.department_id, @defaultDeptId) AND c.FacilityId = @cs1FacilityId
        ORDER BY c.Name
    ) cov
    JOIN dbo.ScheduleWeeks w
        ON w.DepartmentId = ISNULL(s.department_id, @defaultDeptId)
       AND w.Monday = md.monday
    WHERE cfg.evening_duties > 0
      AND cov.Id IS NOT NULL
      AND NOT EXISTS (
          SELECT 1 FROM dbo.ScheduleAssignments ex
          WHERE ex.StaffId = s.staff_id
            AND ex.[Date] = md.work_date
            AND ex.Shift = 'evening'
            AND (ex.CoverageId = cov.Id OR ex.Cancelled = 0)
      );

    -- 3.1. Chấm công ca chính (main) - khớp từng 0.5 ngày công và giờ tăng ca (actual_hours > 8)
    INSERT INTO dbo.attendance_records (
        attendance_id, staff_id, staff_code, device_enroll_id, department_id, FacilityId,
        work_date, shift_type, check_in, check_out, actual_hours, source, validation_status,
        note, confirmed_by, confirmed_at, created_at
    )
    SELECT
        NEWID(),
        s.staff_id,
        s.staff_code,
        s.device_enroll_id,
        ISNULL(s.department_id, @defaultDeptId),
        @cs1FacilityId,
        md.work_date,
        'main',
        DATEADD(HOUR, 7, CAST(md.work_date AS datetime2(0))),
        DATEADD(MINUTE,
            CAST((CASE
                WHEN md.work_seq <= FLOOR(cfg.work_days) THEN
                    (CASE WHEN md.work_seq = 1 AND cfg.ot_hours > 0 AND cfg.ot_hours <= 4 THEN 8.0 + cfg.ot_hours
                          WHEN md.work_seq IN (1, 2) AND cfg.ot_hours > 4 THEN 8.0 + (cfg.ot_hours / 2.0)
                          ELSE 8.0 END)
                ELSE 4.0
            END) * 60 AS int),
            DATEADD(HOUR, 7, CAST(md.work_date AS datetime2(0)))
        ),
        CASE
            WHEN md.work_seq <= FLOOR(cfg.work_days) THEN
                (CASE WHEN md.work_seq = 1 AND cfg.ot_hours > 0 AND cfg.ot_hours <= 4 THEN 8.0 + cfg.ot_hours
                      WHEN md.work_seq IN (1, 2) AND cfg.ot_hours > 4 THEN 8.0 + (cfg.ot_hours / 2.0)
                      ELSE 8.0 END)
            ELSE 4.0
        END,
        'fingerprint',
        'confirmed',
        N'[Seed CS1 Iter2]',
        @actorId,
        SYSUTCDATETIME(),
        SYSUTCDATETIME()
    FROM dbo.staff s
    JOIN @ClinicConfig cfg ON s.staff_code = cfg.staff_code
    JOIN @MonthDays md ON md.work_seq <= CEILING(cfg.work_days)
    WHERE NOT EXISTS (
        SELECT 1 FROM dbo.attendance_records ex
        WHERE ex.staff_id = s.staff_id
          AND ex.work_date = md.work_date
          AND ex.shift_type = 'main'
    );

    -- 3.2. Ca trực tối (evening) đã xác nhận
    INSERT INTO dbo.on_call_shifts (
        shift_id, staff_id, department_id, FacilityId, shift_date, shift_category,
        shift_start, shift_end, recorded_by, confirmed_by, confirmed_at, status, note, created_at, UpdatedAt
    )
    SELECT
        NEWID(),
        s.staff_id,
        ISNULL(s.department_id, @defaultDeptId),
        @cs1FacilityId,
        md.work_date,
        'evening',
        DATEADD(HOUR, 17, CAST(md.work_date AS datetime2(0))),
        DATEADD(HOUR, 21, CAST(md.work_date AS datetime2(0))),
        @actorId,
        @actorId,
        SYSUTCDATETIME(),
        'confirmed',
        N'[Seed CS1 Iter2]',
        SYSUTCDATETIME(),
        SYSUTCDATETIME()
    FROM dbo.staff s
    JOIN @ClinicConfig cfg ON s.staff_code = cfg.staff_code
    JOIN @MonthDays md ON md.work_seq <= cfg.evening_duties
    WHERE cfg.evening_duties > 0;

    -- 3.3. Ca trực trưa (noon) đã xác nhận
    INSERT INTO dbo.on_call_shifts (
        shift_id, staff_id, department_id, FacilityId, shift_date, shift_category,
        shift_start, shift_end, recorded_by, confirmed_by, confirmed_at, status, note, created_at, UpdatedAt
    )
    SELECT
        NEWID(),
        s.staff_id,
        ISNULL(s.department_id, @defaultDeptId),
        @cs1FacilityId,
        md.work_date,
        'noon',
        DATEADD(HOUR, 11, CAST(md.work_date AS datetime2(0))),
        DATEADD(HOUR, 13, CAST(md.work_date AS datetime2(0))),
        @actorId,
        @actorId,
        SYSUTCDATETIME(),
        'confirmed',
        N'[Seed CS1 Iter2]',
        SYSUTCDATETIME(),
        SYSUTCDATETIME()
    FROM dbo.staff s
    JOIN @ClinicConfig cfg ON s.staff_code = cfg.staff_code
    JOIN @MonthDays md ON md.work_seq <= cfg.noon_duties
    WHERE cfg.noon_duties > 0;

    -- 3.3b. Liên kết ca trực (on_call_shifts) với Lịch phân công (ScheduleAssignments) & Chấm công (attendance_records)
    UPDATE oc
    SET oc.ScheduleAssignmentId = sa.Id,
        oc.AttendanceEvidenceId = ar.attendance_id
    FROM dbo.on_call_shifts oc
    JOIN dbo.staff s ON oc.staff_id = s.staff_id
    JOIN @ClinicConfig cfg ON s.staff_code = cfg.staff_code
    LEFT JOIN dbo.ScheduleAssignments sa
        ON sa.StaffId = oc.staff_id
       AND sa.[Date] = oc.shift_date
       AND sa.Shift = oc.shift_category
       AND sa.Cancelled = 0
    LEFT JOIN dbo.attendance_records ar
        ON ar.staff_id = oc.staff_id
       AND ar.work_date = oc.shift_date
       AND ar.shift_type = 'main'
    WHERE oc.shift_date BETWEEN @mStart AND @mEnd
      AND oc.note = N'[Seed CS1 Iter2]';

    -- 3.4. Phiếu thủ thuật y tế đã xác minh (verified) cho các nhân sự phát sinh hoa hồng
    IF @defaultServiceId IS NOT NULL
    BEGIN
        DECLARE @pStaffId uniqueidentifier, @pCode nvarchar(20), @pComm decimal(15,2), @pWorkDays decimal(5,2), @newSlipId uniqueidentifier, @procDate date;
        DECLARE pCursor CURSOR LOCAL FAST_FORWARD FOR
            SELECT s.staff_id, s.staff_code, cfg.proc_commission, cfg.work_days
            FROM dbo.staff s
            JOIN @ClinicConfig cfg ON s.staff_code = cfg.staff_code
            WHERE cfg.proc_commission > 0;
        OPEN pCursor;
        FETCH NEXT FROM pCursor INTO @pStaffId, @pCode, @pComm, @pWorkDays;
        WHILE @@FETCH_STATUS = 0
        BEGIN
            SET @newSlipId = NEWID();
            SET @procDate = (SELECT work_date FROM @MonthDays WHERE work_seq = CASE WHEN @pWorkDays >= 15 THEN 13 ELSE 2 END);

            INSERT INTO dbo.procedure_slips (
                slip_id, service_id, department_id, slip_number, procedure_date,
                patient_code, charged_amount, direct_cost, is_after_hours, duration_hours,
                indicating_staff_id, status, recorded_by, verified_by, verified_at, created_at
            )
            VALUES (
                @newSlipId, @defaultServiceId, @defaultDeptId,
                'TT-CS1-' + @curMonth + '-' + @pCode,
                ISNULL(@procDate, @mStart),
                'BN-' + @pCode,
                @pComm * 4,
                0,
                0,
                1.0,
                @pStaffId,
                'verified',
                @actorId,
                @verifierId,
                SYSUTCDATETIME(),
                SYSUTCDATETIME()
            );

            INSERT INTO dbo.procedure_assignments (
                assignment_id, slip_id, staff_id, role, rule_id, commission_amount, status
            )
            VALUES (
                NEWID(), @newSlipId, @pStaffId, 'performing', NULL, @pComm, 'verified'
            );

            FETCH NEXT FROM pCursor INTO @pStaffId, @pCode, @pComm, @pWorkDays;
        END;
        CLOSE pCursor;
        DEALLOCATE pCursor;
    END;

    -- 3.5. Khóa bảng công tháng (monthly_timesheets) để sẵn sàng chốt sổ Task 75
    IF EXISTS (SELECT 1 FROM dbo.monthly_timesheets WHERE pay_month = @curMonth)
        UPDATE dbo.monthly_timesheets
        SET status = 'locked', locked_by = @actorId, locked_at = SYSUTCDATETIME(), updated_at = SYSUTCDATETIME()
        WHERE pay_month = @curMonth;
    ELSE
        INSERT INTO dbo.monthly_timesheets (timesheet_id, pay_month, status, locked_by, locked_at, created_at, updated_at)
        VALUES (NEWID(), @curMonth, 'locked', @actorId, SYSUTCDATETIME(), SYSUTCDATETIME(), SYSUTCDATETIME());

    -- 3.6. Đảm bảo kỳ lương tồn tại ở trạng thái bản nháp (sẵn sàng demo Task 70 -> 75)
    IF NOT EXISTS (SELECT 1 FROM dbo.payroll_locks WHERE pay_month = @curMonth)
        INSERT INTO dbo.payroll_locks (lock_id, pay_month, status, created_at)
        VALUES (NEWID(), @curMonth, 'draft', DATEADD(DAY, 28, CAST(@mStart AS datetime2(0))));
    ELSE IF @curMonth = '2026-10'
        UPDATE dbo.payroll_locks
        SET status = 'draft', locked_by = NULL, locked_at = NULL
        WHERE pay_month = '2026-10';

    FETCH NEXT FROM mCursor INTO @curMonth, @mStart;
END;

CLOSE mCursor;
DEALLOCATE mCursor;
GO

PRINT N'>>> HOÀN TẤT ĐỒNG BỘ DỮ LIỆU CƠ SỞ 1 CHO TASKS 70-75!';
GO
