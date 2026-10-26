/*
 VNC-HRMS - SQL Server Database Schema (Optimized Version)
 Target: Microsoft SQL Server 2019+ (SSMS).
 Run in a NEW empty database.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

-- ============================================================
-- 1. IDENTITY & SYSTEM MODULE
-- ============================================================
CREATE TABLE dbo.users (
    user_id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT (NEWID()),
    username NVARCHAR(50) UNIQUE NOT NULL,
    password_hash NVARCHAR(255) NOT NULL,
    full_name NVARCHAR(100),
    role NVARCHAR(30) NOT NULL,
    account_status NVARCHAR(20) DEFAULT 'active',
    failed_login_count INT DEFAULT 0,
    locked_until DATETIME2(0),
    last_login DATETIME2(0),
    created_at DATETIME2(0) DEFAULT (SYSDATETIME()),
    updated_at DATETIME2(0) DEFAULT (SYSDATETIME())
);
GO

CREATE TABLE dbo.refresh_tokens (
    token_id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT (NEWID()),
    user_id UNIQUEIDENTIFIER NOT NULL,
    token_hash NVARCHAR(255) NOT NULL,
    device_info NVARCHAR(200),
    expires_at DATETIME2(0) NOT NULL,
    revoked BIT DEFAULT (0),
    revoked_at DATETIME2(0),
    created_at DATETIME2(0) DEFAULT (SYSDATETIME())
);
GO

CREATE TABLE dbo.audit_logs (
    log_id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT (NEWID()),
    user_id UNIQUEIDENTIFIER,
    username NVARCHAR(50),
    action NVARCHAR(100) NOT NULL,
    entity_type NVARCHAR(50),
    entity_id UNIQUEIDENTIFIER,
    old_value NVARCHAR(MAX),
    new_value NVARCHAR(MAX),
    ip_address NVARCHAR(45),
    user_agent NVARCHAR(300),
    created_at DATETIME2(0) DEFAULT (SYSDATETIME())
);
GO

CREATE TABLE dbo.system_policies (
    policy_id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT (NEWID()),
    policy_key NVARCHAR(100) UNIQUE NOT NULL,
    policy_value NVARCHAR(500) NOT NULL,
    value_type NVARCHAR(20) DEFAULT 'string',
    description NVARCHAR(MAX),
    updated_by UNIQUEIDENTIFIER,
    updated_at DATETIME2(0) DEFAULT (SYSDATETIME())
);
GO

-- ============================================================
-- 2. EMPLOYEE & ORGANIZATION MODULE
-- ============================================================
CREATE TABLE dbo.departments (
    department_id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT (NEWID()),
    dept_code NVARCHAR(20) UNIQUE NOT NULL,
    name NVARCHAR(100) UNIQUE NOT NULL,
    manager_id UNIQUEIDENTIFIER,
    status NVARCHAR(20) DEFAULT 'active',
    created_at DATETIME2(0) DEFAULT (SYSDATETIME()),
    updated_at DATETIME2(0) DEFAULT (SYSDATETIME())
);
GO

CREATE TABLE dbo.positions (
    position_id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT (NEWID()),
    name NVARCHAR(100) UNIQUE NOT NULL,
    scope_tag NVARCHAR(50),
    status NVARCHAR(20) DEFAULT 'active'
);
GO

CREATE TABLE dbo.staff (
    staff_id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT (NEWID()),
    user_id UNIQUEIDENTIFIER UNIQUE NOT NULL,
    staff_code NVARCHAR(20) UNIQUE NOT NULL,
    device_enroll_id NVARCHAR(50) UNIQUE, -- MỚI: ID ánh xạ với máy chấm công
    full_name NVARCHAR(100) NOT NULL,
    date_of_birth DATE,
    gender NVARCHAR(10),
    phone NVARCHAR(20),
    email NVARCHAR(100) UNIQUE,
    id_card_number NVARCHAR(20) UNIQUE,
    avatar_url NVARCHAR(500),
    department_id UNIQUEIDENTIFIER,
    position_id UNIQUEIDENTIFIER,
    scope_of_practice NVARCHAR(200),
    date_joined DATE NOT NULL,
    date_left DATE,
    dependent_count INT DEFAULT 0, -- MỚI: Số người phụ thuộc tính thuế
    status NVARCHAR(20) DEFAULT 'active',
    created_by UNIQUEIDENTIFIER,
    created_at DATETIME2(0) DEFAULT (SYSDATETIME()),
    updated_at DATETIME2(0) DEFAULT (SYSDATETIME())
);
GO

CREATE TABLE dbo.contracts (
    contract_id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT (NEWID()),
    staff_id UNIQUEIDENTIFIER NOT NULL,
    contract_code NVARCHAR(30) UNIQUE,
    contract_type NVARCHAR(50) NOT NULL,
    daily_rate DECIMAL(15,2) NOT NULL,
    effective_from DATE NOT NULL,
    effective_to DATE,
    is_insurance_eligible BIT DEFAULT 1, -- MỚI: Có tham gia BHXH
    insurance_salary_basis DECIMAL(15,2), -- MỚI: Mức lương làm căn cứ đóng BH
    status NVARCHAR(20) DEFAULT 'active',
    file_url NVARCHAR(500),
    created_at DATETIME2(0) DEFAULT (SYSDATETIME()),
    updated_at DATETIME2(0) DEFAULT (SYSDATETIME())
);
GO

CREATE TABLE dbo.degrees (
    degree_id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT (NEWID()),
    staff_id UNIQUEIDENTIFIER NOT NULL,
    degree_type NVARCHAR(50),
    degree_name NVARCHAR(200),
    issued_by NVARCHAR(200),
    issued_at DATE,
    file_url NVARCHAR(500),
    created_at DATETIME2(0) DEFAULT (SYSDATETIME())
);
GO

-- ============================================================
-- 3. ATTENDANCE & LEAVE MODULE
-- ============================================================
CREATE TABLE dbo.attendance_imports (
    import_id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT (NEWID()),
    file_name NVARCHAR(255) NOT NULL,
    file_url NVARCHAR(500),
    imported_by UNIQUEIDENTIFIER NOT NULL,
    import_date DATETIME2(0) DEFAULT (SYSDATETIME()),
    pay_month NVARCHAR(7),
    total_rows INT DEFAULT 0,
    success_rows INT DEFAULT 0,
    error_rows INT DEFAULT 0,
    status NVARCHAR(20) DEFAULT 'pending',
    error_log NVARCHAR(MAX),
    column_mapping NVARCHAR(MAX)
);
GO

CREATE TABLE dbo.attendance_records (
    attendance_id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT (NEWID()),
    staff_id UNIQUEIDENTIFIER NOT NULL,
    staff_code NVARCHAR(20) NOT NULL,
    device_enroll_id NVARCHAR(50), -- MỚI: Lưu ID thô từ file vân tay để trace lỗi
    department_id UNIQUEIDENTIFIER,
    import_id UNIQUEIDENTIFIER,
    on_call_shift_id UNIQUEIDENTIFIER,
    work_date DATE NOT NULL,
    shift_type NVARCHAR(30),
    check_in DATETIME2(0),
    check_out DATETIME2(0),
    actual_hours DECIMAL(5,2),
    source NVARCHAR(20) DEFAULT 'fingerprint',
    validation_status NVARCHAR(20) DEFAULT 'pending',
    note NVARCHAR(MAX),
    reconciled_by UNIQUEIDENTIFIER,
    reconciled_at DATETIME2(0),
    reconcile_note NVARCHAR(MAX),
    confirmed_by UNIQUEIDENTIFIER,
    confirmed_at DATETIME2(0),
    payslip_id UNIQUEIDENTIFIER,
    created_at DATETIME2(0) DEFAULT (SYSDATETIME()),
    CONSTRAINT UQ_attendance_records_staff_date_shift UNIQUE (staff_id, work_date, shift_type)
);
GO

CREATE TABLE dbo.on_call_shifts (
    shift_id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT (NEWID()),
    staff_id UNIQUEIDENTIFIER NOT NULL,
    department_id UNIQUEIDENTIFIER NOT NULL,
    shift_date DATE NOT NULL,
    shift_category NVARCHAR(30) NOT NULL,
    shift_start DATETIME2(0),
    shift_end DATETIME2(0),
    recorded_by UNIQUEIDENTIFIER NOT NULL,
    confirmed_by UNIQUEIDENTIFIER,
    confirmed_at DATETIME2(0),
    status NVARCHAR(20) DEFAULT 'pending',
    rejected_reason NVARCHAR(MAX),
    note NVARCHAR(MAX),
    created_at DATETIME2(0) DEFAULT (SYSDATETIME())
);
GO

CREATE TABLE dbo.leave_requests (
    request_id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT (NEWID()),
    staff_id UNIQUEIDENTIFIER NOT NULL,
    department_id UNIQUEIDENTIFIER NOT NULL,
    leave_type NVARCHAR(50) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_days DECIMAL(4,1),
    reason NVARCHAR(MAX),
    attachment_url NVARCHAR(500),
    status NVARCHAR(20) DEFAULT 'pending',
    approved_by UNIQUEIDENTIFIER,
    approved_at DATETIME2(0),
    rejected_reason NVARCHAR(MAX),
    created_at DATETIME2(0) DEFAULT (SYSDATETIME()),
    updated_at DATETIME2(0) DEFAULT (SYSDATETIME())
);
GO

CREATE TABLE dbo.work_schedule_templates (
    template_id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT (NEWID()),
    name NVARCHAR(100) NOT NULL,
    shift_start TIME NOT NULL,
    shift_end TIME NOT NULL,
    break_minutes INT DEFAULT 0,
    standard_hours DECIMAL(4,2),
    description NVARCHAR(MAX),
    status NVARCHAR(20) DEFAULT 'active'
);
GO

CREATE TABLE dbo.monthly_timesheets (
    timesheet_id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT (NEWID()),
    pay_month NVARCHAR(7) NOT NULL UNIQUE,
    status NVARCHAR(20) NOT NULL DEFAULT 'draft',
    locked_by UNIQUEIDENTIFIER,
    locked_at DATETIME2(0),
    created_at DATETIME2(0) NOT NULL DEFAULT (SYSDATETIME()),
    updated_at DATETIME2(0) NOT NULL DEFAULT (SYSDATETIME())
);
GO

-- ============================================================
-- 4. PAYROLL & COMMISSION MODULE
-- ============================================================
CREATE TABLE dbo.procedure_services (
    service_id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT (NEWID()),
    service_code NVARCHAR(30) UNIQUE NOT NULL,
    service_name NVARCHAR(200) NOT NULL,
    category NVARCHAR(100),
    status NVARCHAR(20) DEFAULT 'active'
);
GO

CREATE TABLE dbo.commission_rules (
    rule_id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT (NEWID()),
    service_id UNIQUEIDENTIFIER NOT NULL,
    role NVARCHAR(50) NOT NULL,
    value_type NVARCHAR(20) NOT NULL,
    commission_value DECIMAL(15,4) NOT NULL,
    effective_from DATE NOT NULL,
    effective_to DATE,
    status NVARCHAR(20) DEFAULT 'active',
    created_by UNIQUEIDENTIFIER,
    created_at DATETIME2(0) DEFAULT (SYSDATETIME())
);
GO

CREATE TABLE dbo.procedure_slips (
    slip_id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT (NEWID()),
    service_id UNIQUEIDENTIFIER NOT NULL,
    department_id UNIQUEIDENTIFIER,
    slip_number NVARCHAR(50) UNIQUE NOT NULL,
    procedure_date DATE NOT NULL,
    patient_code NVARCHAR(50),
    status NVARCHAR(20) DEFAULT 'pending',
    recorded_by UNIQUEIDENTIFIER,
    verified_by UNIQUEIDENTIFIER,
    verified_at DATETIME2(0),
    rejected_reason NVARCHAR(MAX),
    created_at DATETIME2(0) DEFAULT (SYSDATETIME())
);
GO

CREATE TABLE dbo.procedure_assignments (
    assignment_id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT (NEWID()),
    slip_id UNIQUEIDENTIFIER NOT NULL,
    staff_id UNIQUEIDENTIFIER NOT NULL,
    role NVARCHAR(50) NOT NULL,
    rule_id UNIQUEIDENTIFIER,
    commission_amount DECIMAL(15,2),
    payslip_id UNIQUEIDENTIFIER,
    status NVARCHAR(20) DEFAULT 'pending'
);
GO

CREATE TABLE dbo.maternity_cases (
    maternity_case_id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT (NEWID()),
    staff_id UNIQUEIDENTIFIER NOT NULL,
    leave_request_id UNIQUEIDENTIFIER,
    expected_due_date DATE,
    actual_birth_date DATE,
    leave_start_date DATE NOT NULL,
    leave_end_date DATE NOT NULL,
    insurance_eligible BIT NOT NULL DEFAULT 0,
    contribution_months INT,
    average_insurance_salary DECIMAL(15,2),
    benefit_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    additional_benefit_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    total_benefit_amount AS (benefit_amount + additional_benefit_amount) PERSISTED,
    status NVARCHAR(20) NOT NULL DEFAULT 'pending',
    supporting_document_url NVARCHAR(500),
    notes NVARCHAR(MAX),
    reviewed_by UNIQUEIDENTIFIER,
    reviewed_at DATETIME2(0),
    paid_at DATETIME2(0),
    created_at DATETIME2(0) NOT NULL DEFAULT (SYSDATETIME())
);
GO

CREATE TABLE dbo.allowance_types (
    allowance_id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT (NEWID()),
    code NVARCHAR(30) UNIQUE NOT NULL,
    name NVARCHAR(100) NOT NULL,
    value_type NVARCHAR(20) NOT NULL,
    default_value DECIMAL(15,2),
    applies_to NVARCHAR(50) DEFAULT 'all',
    is_taxable BIT DEFAULT 0,
    is_insurance_basis BIT DEFAULT 0, -- MỚI: Có cộng vào nền tính bảo hiểm
    status NVARCHAR(20) DEFAULT 'active',
    created_at DATETIME2(0) DEFAULT (SYSDATETIME())
);
GO

CREATE TABLE dbo.staff_allowances (
    staff_allowance_id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT (NEWID()),
    staff_id UNIQUEIDENTIFIER NOT NULL,
    allowance_id UNIQUEIDENTIFIER NOT NULL,
    value_type NVARCHAR(20) NOT NULL,
    amount_value DECIMAL(15,2) NOT NULL,
    effective_from DATE NOT NULL,
    effective_to DATE,
    status NVARCHAR(20) NOT NULL DEFAULT 'active',
    approved_by UNIQUEIDENTIFIER,
    created_at DATETIME2(0) NOT NULL DEFAULT (SYSDATETIME())
);
GO

CREATE TABLE dbo.payroll_tax_brackets (
    bracket_id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT (NEWID()),
    income_from DECIMAL(15,2) NOT NULL,
    income_to DECIMAL(15,2),
    tax_rate_percent DECIMAL(5,2) NOT NULL,
    effective_from DATE NOT NULL,
    effective_to DATE,
    status NVARCHAR(20) DEFAULT 'active'
);
GO

CREATE TABLE dbo.payroll_insurance_configs (
    config_id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT (NEWID()),
    insurance_type NVARCHAR(20) NOT NULL,
    payer NVARCHAR(20) NOT NULL,
    rate_percent DECIMAL(5,2) NOT NULL,
    applies_to NVARCHAR(50) DEFAULT 'all',
    effective_from DATE NOT NULL,
    effective_to DATE,
    status NVARCHAR(20) DEFAULT 'active'
);
GO

CREATE TABLE dbo.bank_exports (
    export_id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT (NEWID()),
    pay_month NVARCHAR(7) NOT NULL,
    file_name NVARCHAR(255) NOT NULL,
    file_url NVARCHAR(500),
    exported_by UNIQUEIDENTIFIER NOT NULL,
    exported_at DATETIME2(0) NOT NULL DEFAULT (SYSDATETIME()),
    status NVARCHAR(20) NOT NULL DEFAULT 'completed',
    row_count INT NOT NULL DEFAULT 0,
    notes NVARCHAR(MAX)
);
GO

CREATE TABLE dbo.payroll_locks (
    lock_id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT (NEWID()),
    pay_month NVARCHAR(7) UNIQUE NOT NULL,
    status NVARCHAR(20) DEFAULT 'open',
    locked_by UNIQUEIDENTIFIER,
    locked_at DATETIME2(0),
    exported_by UNIQUEIDENTIFIER,
    exported_at DATETIME2(0),
    export_file_url NVARCHAR(500),
    created_at DATETIME2(0) DEFAULT (SYSDATETIME())
);
GO

CREATE TABLE dbo.payslips (
    payslip_id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT (NEWID()),
    staff_id UNIQUEIDENTIFIER NOT NULL,
    staff_name NVARCHAR(100),
    department_id UNIQUEIDENTIFIER,
    contract_id UNIQUEIDENTIFIER,
    contract_type NVARCHAR(50),
    pay_month NVARCHAR(7) NOT NULL,

    -- Attendance
    work_days DECIMAL(5,2),
    on_call_days DECIMAL(5,2),
    maternity_leave_days DECIMAL(5,2) DEFAULT 0,

    -- Earnings
    base_pay DECIMAL(15,2) DEFAULT 0,
    allowance_total DECIMAL(15,2) DEFAULT 0,
    commission_total DECIMAL(15,2) DEFAULT 0,
    maternity_allowance DECIMAL(15,2) DEFAULT 0,
    gross_pay DECIMAL(15,2),

    -- Snapshots & Deductions
    insurance_salary_base DECIMAL(15,2) DEFAULT 0,
    insurance_deduction DECIMAL(15,2) DEFAULT 0,
    dependent_count INT DEFAULT 0, -- Snapshot SL người phụ thuộc
    personal_deduction DECIMAL(15,2) DEFAULT 0,
    dependent_deduction DECIMAL(15,2) DEFAULT 0,
    taxable_income DECIMAL(15,2) DEFAULT 0,
    tax_deduction DECIMAL(15,2) DEFAULT 0,
    other_deduction DECIMAL(15,2) DEFAULT 0,
    net_pay DECIMAL(15,2),

    -- Workflow Status
    status NVARCHAR(30) DEFAULT 'draft',
    dept_approved_by UNIQUEIDENTIFIER,
    dept_approved_at DATETIME2(0),
    dept_rejected_reason NVARCHAR(MAX),
    finalized_by UNIQUEIDENTIFIER,
    finalized_at DATETIME2(0),

    -- Export
    payment_date DATE,
    bank_export_id UNIQUEIDENTIFIER,

    is_locked BIT DEFAULT 0,
    locked_at DATETIME2(0),
    created_at DATETIME2(0) DEFAULT (SYSDATETIME()),
    updated_at DATETIME2(0) DEFAULT (SYSDATETIME()),
    CONSTRAINT UQ_payslips_staff_month UNIQUE (staff_id, pay_month)
);
GO

CREATE TABLE dbo.payslip_allowances (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT (NEWID()),
    payslip_id UNIQUEIDENTIFIER NOT NULL,
    allowance_id UNIQUEIDENTIFIER,
    name NVARCHAR(100) NOT NULL,
    amount DECIMAL(15,2) NOT NULL
);
GO

CREATE TABLE dbo.payslip_deductions (
    payslip_deduction_id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT (NEWID()),
    payslip_id UNIQUEIDENTIFIER NOT NULL,
    deduction_type NVARCHAR(30) NOT NULL, -- BHXH | BHYT | BHTN | PIT | OTHER | MATERNITY_ADJUSTMENT
    deduction_name NVARCHAR(100) NOT NULL,
    calculation_base DECIMAL(15,2) NOT NULL DEFAULT 0,
    rate_percent DECIMAL(7,4),
    amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    payer NVARCHAR(20) NOT NULL DEFAULT 'employee',
    config_reference_id UNIQUEIDENTIFIER,
    notes NVARCHAR(MAX),
    created_at DATETIME2(0) NOT NULL DEFAULT (SYSDATETIME())
);
GO

CREATE TABLE dbo.complaints (
    complaint_id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT (NEWID()),
    staff_id UNIQUEIDENTIFIER NOT NULL,
    department_id UNIQUEIDENTIFIER,
    payslip_id UNIQUEIDENTIFIER,
    inquiry_type NVARCHAR(30) NOT NULL,
    subject NVARCHAR(200) NOT NULL,
    description NVARCHAR(MAX) NOT NULL,
    response NVARCHAR(MAX),
    replied_by UNIQUEIDENTIFIER,
    replied_at DATETIME2(0),
    status NVARCHAR(20) DEFAULT 'open',
    submitted_at DATETIME2(0) DEFAULT (SYSDATETIME()),
    resolved_at DATETIME2(0)
);
GO

CREATE TABLE dbo.complaint_attachments (
    attachment_id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT (NEWID()),
    complaint_id UNIQUEIDENTIFIER NOT NULL,
    file_url NVARCHAR(500) NOT NULL,
    file_name NVARCHAR(255),
    uploaded_by UNIQUEIDENTIFIER NOT NULL,
    uploaded_at DATETIME2(0) DEFAULT (SYSDATETIME())
);
GO

-- ============================================================
-- 5. CREDENTIAL & COMPLIANCE MODULE
-- ============================================================
CREATE TABLE dbo.certificates (
    certificate_id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT (NEWID()),
    staff_id UNIQUEIDENTIFIER NOT NULL,
    department_id UNIQUEIDENTIFIER,
    certificate_number NVARCHAR(100) UNIQUE,
    certificate_type NVARCHAR(100) NOT NULL,
    issuing_authority NVARCHAR(200),
    issue_date DATE,
    expiry_date DATE,
    scope_of_practice NVARCHAR(200),
    cme_cycle_months INT,
    cme_required_credits DECIMAL(6,2),
    status NVARCHAR(20) DEFAULT 'active',
    file_url NVARCHAR(500),
    uploaded_by UNIQUEIDENTIFIER,
    created_at DATETIME2(0) DEFAULT (SYSDATETIME()),
    updated_at DATETIME2(0) DEFAULT (SYSDATETIME())
);
GO

CREATE TABLE dbo.cme_cycles (
    cycle_id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT (NEWID()),
    certificate_id UNIQUEIDENTIFIER NOT NULL,
    cycle_number INT NOT NULL,
    cycle_start DATE NOT NULL,
    cycle_end DATE NOT NULL,
    required_credits DECIMAL(6,2) NOT NULL,
    earned_credits DECIMAL(6,2) DEFAULT 0,
    status NVARCHAR(20) DEFAULT 'active',
    CONSTRAINT UQ_cme_cycles_cert_number UNIQUE (certificate_id, cycle_number)
);
GO

CREATE TABLE dbo.cme_records (
    cme_id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT (NEWID()),
    certificate_id UNIQUEIDENTIFIER NOT NULL,
    cme_cycle_id UNIQUEIDENTIFIER,
    course_name NVARCHAR(200) NOT NULL,
    provider NVARCHAR(200),
    completed_date DATE NOT NULL,
    credits DECIMAL(5,2) NOT NULL,
    file_url NVARCHAR(500),
    verified BIT DEFAULT 0,
    verified_by UNIQUEIDENTIFIER,
    verified_at DATETIME2(0),
    created_at DATETIME2(0) DEFAULT (SYSDATETIME())
);
GO

CREATE TABLE dbo.compliance_scans (
    scan_id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT (NEWID()),
    staff_id UNIQUEIDENTIFIER NOT NULL,
    department_id UNIQUEIDENTIFIER,
    certificate_id UNIQUEIDENTIFIER,
    scan_date DATETIME2(0) DEFAULT (SYSDATETIME()),
    expiry_date DATE,
    days_remaining INT,
    cme_credits_earned DECIMAL(6,2),
    cme_credits_needed DECIMAL(6,2),
    compliance_status NVARCHAR(30) NOT NULL,
    alert_sent BIT DEFAULT 0,
    alert_sent_at DATETIME2(0)
);
GO

-- ============================================================
-- 6. NOTIFICATION MODULE
-- ============================================================
CREATE TABLE dbo.notifications (
    notification_id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT (NEWID()),
    recipient_id UNIQUEIDENTIFIER NOT NULL,
    sender_service NVARCHAR(50) NOT NULL,
    type NVARCHAR(50) NOT NULL,
    title NVARCHAR(200) NOT NULL,
    body NVARCHAR(MAX),
    action_url NVARCHAR(500),
    entity_type NVARCHAR(50),
    entity_id UNIQUEIDENTIFIER,
    channel NVARCHAR(20) DEFAULT 'in_app',
    is_read BIT DEFAULT 0,
    read_at DATETIME2(0),
    created_at DATETIME2(0) DEFAULT (SYSDATETIME())
);
GO

-- ============================================================
-- 7. FOREIGN KEYS SETUP
-- ============================================================
ALTER TABLE dbo.refresh_tokens ADD CONSTRAINT FK_refresh_tokens_user FOREIGN KEY (user_id) REFERENCES dbo.users(user_id) ON DELETE CASCADE;
ALTER TABLE dbo.system_policies ADD CONSTRAINT FK_system_policies_updated_by FOREIGN KEY (updated_by) REFERENCES dbo.users(user_id);
ALTER TABLE dbo.departments ADD CONSTRAINT FK_departments_manager FOREIGN KEY (manager_id) REFERENCES dbo.staff(staff_id);
ALTER TABLE dbo.staff ADD CONSTRAINT FK_staff_user FOREIGN KEY (user_id) REFERENCES dbo.users(user_id);
ALTER TABLE dbo.staff ADD CONSTRAINT FK_staff_dept FOREIGN KEY (department_id) REFERENCES dbo.departments(department_id);
ALTER TABLE dbo.staff ADD CONSTRAINT FK_staff_pos FOREIGN KEY (position_id) REFERENCES dbo.positions(position_id);
ALTER TABLE dbo.staff ADD CONSTRAINT FK_staff_created_by FOREIGN KEY (created_by) REFERENCES dbo.users(user_id);
ALTER TABLE dbo.contracts ADD CONSTRAINT FK_contracts_staff FOREIGN KEY (staff_id) REFERENCES dbo.staff(staff_id);
ALTER TABLE dbo.degrees ADD CONSTRAINT FK_degrees_staff FOREIGN KEY (staff_id) REFERENCES dbo.staff(staff_id);
ALTER TABLE dbo.attendance_imports ADD CONSTRAINT FK_attendance_imports_imported_by FOREIGN KEY (imported_by) REFERENCES dbo.users(user_id);
ALTER TABLE dbo.attendance_records ADD CONSTRAINT FK_attendance_records_staff FOREIGN KEY (staff_id) REFERENCES dbo.staff(staff_id);
ALTER TABLE dbo.attendance_records ADD CONSTRAINT FK_attendance_records_department FOREIGN KEY (department_id) REFERENCES dbo.departments(department_id);
ALTER TABLE dbo.attendance_records ADD CONSTRAINT FK_attendance_records_import FOREIGN KEY (import_id) REFERENCES dbo.attendance_imports(import_id);
ALTER TABLE dbo.attendance_records ADD CONSTRAINT FK_attendance_records_oncall FOREIGN KEY (on_call_shift_id) REFERENCES dbo.on_call_shifts(shift_id);
ALTER TABLE dbo.on_call_shifts ADD CONSTRAINT FK_on_call_shifts_staff FOREIGN KEY (staff_id) REFERENCES dbo.staff(staff_id);
ALTER TABLE dbo.on_call_shifts ADD CONSTRAINT FK_on_call_shifts_dept FOREIGN KEY (department_id) REFERENCES dbo.departments(department_id);
ALTER TABLE dbo.leave_requests ADD CONSTRAINT FK_leave_requests_staff FOREIGN KEY (staff_id) REFERENCES dbo.staff(staff_id);
ALTER TABLE dbo.leave_requests ADD CONSTRAINT FK_leave_requests_dept FOREIGN KEY (department_id) REFERENCES dbo.departments(department_id);
ALTER TABLE dbo.monthly_timesheets ADD CONSTRAINT FK_monthly_timesheets_locked_by FOREIGN KEY (locked_by) REFERENCES dbo.users(user_id);
ALTER TABLE dbo.commission_rules ADD CONSTRAINT FK_commission_rules_service FOREIGN KEY (service_id) REFERENCES dbo.procedure_services(service_id);
ALTER TABLE dbo.procedure_slips ADD CONSTRAINT FK_procedure_slips_service FOREIGN KEY (service_id) REFERENCES dbo.procedure_services(service_id);
ALTER TABLE dbo.procedure_slips ADD CONSTRAINT FK_procedure_slips_dept FOREIGN KEY (department_id) REFERENCES dbo.departments(department_id);
ALTER TABLE dbo.procedure_assignments ADD CONSTRAINT FK_procedure_assignments_slip FOREIGN KEY (slip_id) REFERENCES dbo.procedure_slips(slip_id);
ALTER TABLE dbo.procedure_assignments ADD CONSTRAINT FK_procedure_assignments_staff FOREIGN KEY (staff_id) REFERENCES dbo.staff(staff_id);
ALTER TABLE dbo.maternity_cases ADD CONSTRAINT FK_maternity_cases_staff FOREIGN KEY (staff_id) REFERENCES dbo.staff(staff_id);
ALTER TABLE dbo.maternity_cases ADD CONSTRAINT FK_maternity_cases_leave FOREIGN KEY (leave_request_id) REFERENCES dbo.leave_requests(request_id);
ALTER TABLE dbo.staff_allowances ADD CONSTRAINT FK_staff_allowances_staff FOREIGN KEY (staff_id) REFERENCES dbo.staff(staff_id);
ALTER TABLE dbo.staff_allowances ADD CONSTRAINT FK_staff_allowances_allowance FOREIGN KEY (allowance_id) REFERENCES dbo.allowance_types(allowance_id);
ALTER TABLE dbo.bank_exports ADD CONSTRAINT FK_bank_exports_user FOREIGN KEY (exported_by) REFERENCES dbo.users(user_id);
ALTER TABLE dbo.payslips ADD CONSTRAINT FK_payslips_staff FOREIGN KEY (staff_id) REFERENCES dbo.staff(staff_id);
ALTER TABLE dbo.payslips ADD CONSTRAINT FK_payslips_contract FOREIGN KEY (contract_id) REFERENCES dbo.contracts(contract_id);
ALTER TABLE dbo.payslips ADD CONSTRAINT FK_payslips_bank_export FOREIGN KEY (bank_export_id) REFERENCES dbo.bank_exports(export_id);
ALTER TABLE dbo.payslip_allowances ADD CONSTRAINT FK_payslip_allowances_payslip FOREIGN KEY (payslip_id) REFERENCES dbo.payslips(payslip_id) ON DELETE CASCADE;
ALTER TABLE dbo.payslip_deductions ADD CONSTRAINT FK_payslip_deductions_payslip FOREIGN KEY (payslip_id) REFERENCES dbo.payslips(payslip_id) ON DELETE CASCADE;
ALTER TABLE dbo.complaints ADD CONSTRAINT FK_complaints_staff FOREIGN KEY (staff_id) REFERENCES dbo.staff(staff_id);
ALTER TABLE dbo.complaint_attachments ADD CONSTRAINT FK_complaint_attachments_complaint FOREIGN KEY (complaint_id) REFERENCES dbo.complaints(complaint_id) ON DELETE CASCADE;
ALTER TABLE dbo.certificates ADD CONSTRAINT FK_certificates_staff FOREIGN KEY (staff_id) REFERENCES dbo.staff(staff_id);
ALTER TABLE dbo.cme_cycles ADD CONSTRAINT FK_cme_cycles_cert FOREIGN KEY (certificate_id) REFERENCES dbo.certificates(certificate_id);
ALTER TABLE dbo.cme_records ADD CONSTRAINT FK_cme_records_cert FOREIGN KEY (certificate_id) REFERENCES dbo.certificates(certificate_id);
ALTER TABLE dbo.cme_records ADD CONSTRAINT FK_cme_records_cycle FOREIGN KEY (cme_cycle_id) REFERENCES dbo.cme_cycles(cycle_id);
ALTER TABLE dbo.compliance_scans ADD CONSTRAINT FK_compliance_scans_staff FOREIGN KEY (staff_id) REFERENCES dbo.staff(staff_id);
ALTER TABLE dbo.notifications ADD CONSTRAINT FK_notifications_recipient FOREIGN KEY (recipient_id) REFERENCES dbo.users(user_id);
GO

-- ============================================================
-- 8. INDEXES FOR PERFORMANCE
-- ============================================================
CREATE INDEX IX_attendance_records_work_date ON dbo.attendance_records(work_date, department_id, validation_status);
CREATE INDEX IX_attendance_records_staff_code_work_date ON dbo.attendance_records(staff_code, work_date);
CREATE INDEX IX_payslips_pay_month_status ON dbo.payslips(pay_month, status, department_id);
CREATE INDEX IX_certificates_expiry_date ON dbo.certificates(expiry_date, status);
CREATE INDEX IX_cme_cycles_cycle_end ON dbo.cme_cycles(cycle_end, status);
CREATE INDEX IX_notifications_recipient_unread ON dbo.notifications(recipient_id, is_read, created_at DESC);
CREATE INDEX IX_staff_allowances_staff_effective ON dbo.staff_allowances(staff_id, status, effective_from, effective_to);
CREATE INDEX IX_payslip_deductions_payslip ON dbo.payslip_deductions(payslip_id, deduction_type);
GO
