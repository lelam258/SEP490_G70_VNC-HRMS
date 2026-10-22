/*
 VNC-HRMS - Microservices Optimized Database Schema
 Target: Microsoft SQL Server 2019+ (SSMS).
 Action: Create schemas and isolate domain models.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

-- ============================================================
-- 0. CREATE SCHEMAS (MICROSERVICES BOUNDED CONTEXTS)
-- ============================================================
CREATE SCHEMA iam;
GO
CREATE SCHEMA hr;
GO
CREATE SCHEMA attendance;
GO
CREATE SCHEMA payroll;
GO
CREATE SCHEMA compliance;
GO
CREATE SCHEMA notification;
GO

-- ============================================================
-- 1. IDENTITY & ACCESS MANAGEMENT (IAM) SERVICE
-- ============================================================
CREATE TABLE iam.users (
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

CREATE TABLE iam.refresh_tokens (
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

CREATE TABLE iam.audit_logs (
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

CREATE TABLE iam.system_policies (
    policy_id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT (NEWID()),
    policy_key NVARCHAR(100) UNIQUE NOT NULL,
    policy_value NVARCHAR(500) NOT NULL,
    value_type NVARCHAR(20) DEFAULT 'string',
    description NVARCHAR(MAX),
    updated_by UNIQUEIDENTIFIER, -- Soft link to iam.users
    updated_at DATETIME2(0) DEFAULT (SYSDATETIME())
);
GO

-- ============================================================
-- 2. CORE HR SERVICE
-- ============================================================
CREATE TABLE hr.positions (
    position_id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT (NEWID()),
    name NVARCHAR(100) UNIQUE NOT NULL,
    scope_tag NVARCHAR(50),
    status NVARCHAR(20) DEFAULT 'active'
);
GO

CREATE TABLE hr.departments (
    department_id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT (NEWID()),
    dept_code NVARCHAR(20) UNIQUE NOT NULL,
    name NVARCHAR(100) UNIQUE NOT NULL,
    manager_id UNIQUEIDENTIFIER, -- Internal link to hr.staff
    status NVARCHAR(20) DEFAULT 'active',
    created_at DATETIME2(0) DEFAULT (SYSDATETIME()),
    updated_at DATETIME2(0) DEFAULT (SYSDATETIME())
);
GO

CREATE TABLE hr.staff (
    staff_id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT (NEWID()),
    user_id UNIQUEIDENTIFIER UNIQUE NOT NULL, -- Soft link to iam.users (NO FK)
    staff_code NVARCHAR(20) UNIQUE NOT NULL,
    device_enroll_id NVARCHAR(50) UNIQUE, 
    full_name NVARCHAR(100) NOT NULL,
    date_of_birth DATE,
    gender NVARCHAR(10),
    phone NVARCHAR(20),
    email NVARCHAR(100) UNIQUE,
    id_card_number NVARCHAR(20) UNIQUE,
    avatar_url NVARCHAR(500),
    department_id UNIQUEIDENTIFIER, -- Internal link
    position_id UNIQUEIDENTIFIER, -- Internal link
    scope_of_practice NVARCHAR(200),
    date_joined DATE NOT NULL,
    date_left DATE,
    dependent_count INT DEFAULT 0,
    status NVARCHAR(20) DEFAULT 'active',
    created_by UNIQUEIDENTIFIER, -- Soft link to iam.users
    created_at DATETIME2(0) DEFAULT (SYSDATETIME()),
    updated_at DATETIME2(0) DEFAULT (SYSDATETIME())
);
GO

CREATE TABLE hr.contracts (
    contract_id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT (NEWID()),
    staff_id UNIQUEIDENTIFIER NOT NULL, -- Internal link
    contract_code NVARCHAR(30) UNIQUE,
    contract_type NVARCHAR(50) NOT NULL,
    daily_rate DECIMAL(15,2) NOT NULL,
    effective_from DATE NOT NULL,
    effective_to DATE,
    is_insurance_eligible BIT DEFAULT 1,
    insurance_salary_basis DECIMAL(15,2), 
    status NVARCHAR(20) DEFAULT 'active',
    file_url NVARCHAR(500),
    created_at DATETIME2(0) DEFAULT (SYSDATETIME()),
    updated_at DATETIME2(0) DEFAULT (SYSDATETIME())
);
GO

CREATE TABLE hr.degrees (
    degree_id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT (NEWID()),
    staff_id UNIQUEIDENTIFIER NOT NULL, -- Internal link
    degree_type NVARCHAR(50),
    degree_name NVARCHAR(200),
    issued_by NVARCHAR(200),
    issued_at DATE,
    file_url NVARCHAR(500),
    created_at DATETIME2(0) DEFAULT (SYSDATETIME())
);
GO

-- ============================================================
-- 3. ATTENDANCE SERVICE
-- ============================================================
CREATE TABLE attendance.attendance_imports (
    import_id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT (NEWID()),
    file_name NVARCHAR(255) NOT NULL,
    file_url NVARCHAR(500),
    imported_by UNIQUEIDENTIFIER NOT NULL, -- Soft link to iam.users
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

CREATE TABLE attendance.on_call_shifts (
    shift_id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT (NEWID()),
    staff_id UNIQUEIDENTIFIER NOT NULL, -- Soft link to hr.staff
    department_id UNIQUEIDENTIFIER NOT NULL, -- Soft link to hr.departments
    shift_date DATE NOT NULL,
    shift_category NVARCHAR(30) NOT NULL,
    shift_start DATETIME2(0),
    shift_end DATETIME2(0),
    recorded_by UNIQUEIDENTIFIER NOT NULL, -- Soft link
    confirmed_by UNIQUEIDENTIFIER, -- Soft link
    confirmed_at DATETIME2(0),
    status NVARCHAR(20) DEFAULT 'pending',
    rejected_reason NVARCHAR(MAX),
    note NVARCHAR(MAX),
    created_at DATETIME2(0) DEFAULT (SYSDATETIME())
);
GO

CREATE TABLE attendance.attendance_records (
    attendance_id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT (NEWID()),
    staff_id UNIQUEIDENTIFIER NOT NULL, -- Soft link to hr.staff
    staff_code NVARCHAR(20) NOT NULL, -- Denormalized for fast query
    department_id UNIQUEIDENTIFIER, -- Soft link to hr.departments
    import_id UNIQUEIDENTIFIER, -- Internal link
    on_call_shift_id UNIQUEIDENTIFIER, -- Internal link
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
    payslip_id UNIQUEIDENTIFIER, -- Soft link to payroll.payslips
    created_at DATETIME2(0) DEFAULT (SYSDATETIME()),
    CONSTRAINT UQ_attendance_records_staff_date_shift UNIQUE (staff_id, work_date, shift_type)
);
GO

CREATE TABLE attendance.leave_requests (
    request_id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT (NEWID()),
    staff_id UNIQUEIDENTIFIER NOT NULL, -- Soft link to hr.staff
    department_id UNIQUEIDENTIFIER NOT NULL, -- Soft link to hr.departments
    leave_type NVARCHAR(50) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_days DECIMAL(4,1),
    reason NVARCHAR(MAX),
    attachment_url NVARCHAR(500),
    status NVARCHAR(20) DEFAULT 'pending',
    approved_by UNIQUEIDENTIFIER, -- Soft link to iam.users or hr.staff
    approved_at DATETIME2(0),
    rejected_reason NVARCHAR(MAX),
    created_at DATETIME2(0) DEFAULT (SYSDATETIME()),
    updated_at DATETIME2(0) DEFAULT (SYSDATETIME())
);
GO

CREATE TABLE attendance.work_schedule_templates (
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

CREATE TABLE attendance.monthly_timesheets (
    timesheet_id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT (NEWID()),
    pay_month NVARCHAR(7) NOT NULL UNIQUE,
    status NVARCHAR(20) NOT NULL DEFAULT 'draft',
    locked_by UNIQUEIDENTIFIER, -- Soft link to iam.users
    locked_at DATETIME2(0),
    created_at DATETIME2(0) NOT NULL DEFAULT (SYSDATETIME()),
    updated_at DATETIME2(0) NOT NULL DEFAULT (SYSDATETIME())
);
GO

-- ============================================================
-- 4. PAYROLL & COMMISSION SERVICE
-- ============================================================
CREATE TABLE payroll.procedure_services (
    service_id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT (NEWID()),
    service_code NVARCHAR(30) UNIQUE NOT NULL,
    service_name NVARCHAR(200) NOT NULL,
    category NVARCHAR(100),
    status NVARCHAR(20) DEFAULT 'active'
);
GO

CREATE TABLE payroll.commission_rules (
    rule_id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT (NEWID()),
    service_id UNIQUEIDENTIFIER NOT NULL, -- Internal link
    role NVARCHAR(50) NOT NULL,
    value_type NVARCHAR(20) NOT NULL,
    commission_value DECIMAL(15,4) NOT NULL,
    effective_from DATE NOT NULL,
    effective_to DATE,
    status NVARCHAR(20) DEFAULT 'active',
    created_by UNIQUEIDENTIFIER, -- Soft link to iam.users
    created_at DATETIME2(0) DEFAULT (SYSDATETIME())
);
GO

CREATE TABLE payroll.procedure_slips (
    slip_id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT (NEWID()),
    service_id UNIQUEIDENTIFIER NOT NULL, -- Internal link
    department_id UNIQUEIDENTIFIER, -- Soft link to hr.departments
    slip_number NVARCHAR(50) UNIQUE NOT NULL,
    procedure_date DATE NOT NULL,
    patient_code NVARCHAR(50),
    status NVARCHAR(20) DEFAULT 'pending',
    recorded_by UNIQUEIDENTIFIER, -- Soft link to hr.staff
    verified_by UNIQUEIDENTIFIER, -- Soft link to hr.staff
    verified_at DATETIME2(0),
    rejected_reason NVARCHAR(MAX),
    created_at DATETIME2(0) DEFAULT (SYSDATETIME())
);
GO

CREATE TABLE payroll.procedure_assignments (
    assignment_id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT (NEWID()),
    slip_id UNIQUEIDENTIFIER NOT NULL, -- Internal link
    staff_id UNIQUEIDENTIFIER NOT NULL, -- Soft link to hr.staff
    role NVARCHAR(50) NOT NULL,
    rule_id UNIQUEIDENTIFIER, -- Internal link
    commission_amount DECIMAL(15,2),
    payslip_id UNIQUEIDENTIFIER, -- Internal link
    status NVARCHAR(20) DEFAULT 'pending'
);
GO

CREATE TABLE payroll.maternity_cases (
    maternity_case_id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT (NEWID()),
    staff_id UNIQUEIDENTIFIER NOT NULL, -- Soft link to hr.staff
    leave_request_id UNIQUEIDENTIFIER, -- Soft link to attendance.leave_requests
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
    reviewed_by UNIQUEIDENTIFIER, -- Soft link
    reviewed_at DATETIME2(0),
    paid_at DATETIME2(0),
    created_at DATETIME2(0) NOT NULL DEFAULT (SYSDATETIME())
);
GO

CREATE TABLE payroll.allowance_types (
    allowance_id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT (NEWID()),
    code NVARCHAR(30) UNIQUE NOT NULL,
    name NVARCHAR(100) NOT NULL,
    value_type NVARCHAR(20) NOT NULL,
    default_value DECIMAL(15,2),
    applies_to NVARCHAR(50) DEFAULT 'all',
    is_taxable BIT DEFAULT 0,
    is_insurance_basis BIT DEFAULT 0, 
    status NVARCHAR(20) DEFAULT 'active',
    created_at DATETIME2(0) DEFAULT (SYSDATETIME())
);
GO

CREATE TABLE payroll.staff_allowances (
    staff_allowance_id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT (NEWID()),
    staff_id UNIQUEIDENTIFIER NOT NULL, -- Soft link to hr.staff
    allowance_id UNIQUEIDENTIFIER NOT NULL, -- Internal link
    value_type NVARCHAR(20) NOT NULL, 
    amount_value DECIMAL(15,2) NOT NULL,
    effective_from DATE NOT NULL,
    effective_to DATE,
    status NVARCHAR(20) NOT NULL DEFAULT 'active',
    approved_by UNIQUEIDENTIFIER, -- Soft link to iam.users
    created_at DATETIME2(0) NOT NULL DEFAULT (SYSDATETIME())
);
GO

CREATE TABLE payroll.payroll_tax_brackets (
    bracket_id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT (NEWID()),
    income_from DECIMAL(15,2) NOT NULL,
    income_to DECIMAL(15,2),
    tax_rate_percent DECIMAL(5,2) NOT NULL,
    effective_from DATE NOT NULL,
    effective_to DATE,
    status NVARCHAR(20) DEFAULT 'active'
);
GO

CREATE TABLE payroll.payroll_insurance_configs (
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

CREATE TABLE payroll.bank_exports (
    export_id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT (NEWID()),
    pay_month NVARCHAR(7) NOT NULL,
    file_name NVARCHAR(255) NOT NULL,
    file_url NVARCHAR(500),
    exported_by UNIQUEIDENTIFIER NOT NULL, -- Soft link to iam.users
    exported_at DATETIME2(0) NOT NULL DEFAULT (SYSDATETIME()),
    status NVARCHAR(20) NOT NULL DEFAULT 'completed',
    row_count INT NOT NULL DEFAULT 0,
    notes NVARCHAR(MAX)
);
GO

CREATE TABLE payroll.payroll_locks (
    lock_id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT (NEWID()),
    pay_month NVARCHAR(7) UNIQUE NOT NULL,
    status NVARCHAR(20) DEFAULT 'open',
    locked_by UNIQUEIDENTIFIER, -- Soft link to iam.users
    locked_at DATETIME2(0),
    exported_by UNIQUEIDENTIFIER, -- Soft link
    exported_at DATETIME2(0),
    export_file_url NVARCHAR(500),
    created_at DATETIME2(0) DEFAULT (SYSDATETIME())
);
GO

CREATE TABLE payroll.payslips (
    payslip_id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT (NEWID()),
    staff_id UNIQUEIDENTIFIER NOT NULL, -- Soft link to hr.staff
    staff_name NVARCHAR(100), -- Denormalized
    department_id UNIQUEIDENTIFIER, -- Soft link to hr.departments
    contract_id UNIQUEIDENTIFIER, -- Soft link to hr.contracts
    contract_type NVARCHAR(50), -- Denormalized
    pay_month NVARCHAR(7) NOT NULL,

    work_days DECIMAL(5,2),
    on_call_days DECIMAL(5,2),
    maternity_leave_days DECIMAL(5,2) DEFAULT 0,

    base_pay DECIMAL(15,2) DEFAULT 0,
    allowance_total DECIMAL(15,2) DEFAULT 0,
    commission_total DECIMAL(15,2) DEFAULT 0,
    maternity_allowance DECIMAL(15,2) DEFAULT 0,
    gross_pay DECIMAL(15,2),

    insurance_salary_base DECIMAL(15,2) DEFAULT 0,
    insurance_deduction DECIMAL(15,2) DEFAULT 0,
    dependent_count INT DEFAULT 0, 
    personal_deduction DECIMAL(15,2) DEFAULT 0,
    dependent_deduction DECIMAL(15,2) DEFAULT 0,
    taxable_income DECIMAL(15,2) DEFAULT 0,
    tax_deduction DECIMAL(15,2) DEFAULT 0,
    other_deduction DECIMAL(15,2) DEFAULT 0,
    net_pay DECIMAL(15,2),

    status NVARCHAR(30) DEFAULT 'draft',
    dept_approved_by UNIQUEIDENTIFIER, -- Soft link
    dept_approved_at DATETIME2(0),
    dept_rejected_reason NVARCHAR(MAX),
    finalized_by UNIQUEIDENTIFIER, -- Soft link
    finalized_at DATETIME2(0),
    
    payment_date DATE,
    bank_export_id UNIQUEIDENTIFIER, -- Internal link

    is_locked BIT DEFAULT 0,
    locked_at DATETIME2(0),
    created_at DATETIME2(0) DEFAULT (SYSDATETIME()),
    updated_at DATETIME2(0) DEFAULT (SYSDATETIME()),
    CONSTRAINT UQ_payslips_staff_month UNIQUE (staff_id, pay_month)
);
GO

CREATE TABLE payroll.payslip_allowances (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT (NEWID()),
    payslip_id UNIQUEIDENTIFIER NOT NULL, -- Internal link
    allowance_id UNIQUEIDENTIFIER, -- Internal link
    name NVARCHAR(100) NOT NULL,
    amount DECIMAL(15,2) NOT NULL
);
GO

CREATE TABLE payroll.payslip_deductions (
    payslip_deduction_id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT (NEWID()),
    payslip_id UNIQUEIDENTIFIER NOT NULL, -- Internal link
    deduction_type NVARCHAR(30) NOT NULL, 
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

CREATE TABLE payroll.complaints (
    complaint_id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT (NEWID()),
    staff_id UNIQUEIDENTIFIER NOT NULL, -- Soft link to hr.staff
    department_id UNIQUEIDENTIFIER, -- Soft link to hr.departments
    payslip_id UNIQUEIDENTIFIER, -- Internal link
    inquiry_type NVARCHAR(30) NOT NULL,
    subject NVARCHAR(200) NOT NULL,
    description NVARCHAR(MAX) NOT NULL,
    response NVARCHAR(MAX),
    replied_by UNIQUEIDENTIFIER, -- Soft link to iam.users
    replied_at DATETIME2(0),
    status NVARCHAR(20) DEFAULT 'open',
    submitted_at DATETIME2(0) DEFAULT (SYSDATETIME()),
    resolved_at DATETIME2(0)
);
GO

CREATE TABLE payroll.complaint_attachments (
    attachment_id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT (NEWID()),
    complaint_id UNIQUEIDENTIFIER NOT NULL, -- Internal link
    file_url NVARCHAR(500) NOT NULL,
    file_name NVARCHAR(255),
    uploaded_by UNIQUEIDENTIFIER NOT NULL, -- Soft link to iam.users
    uploaded_at DATETIME2(0) DEFAULT (SYSDATETIME())
);
GO

-- ============================================================
-- 5. COMPLIANCE SERVICE
-- ============================================================
CREATE TABLE compliance.certificates (
    certificate_id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT (NEWID()),
    staff_id UNIQUEIDENTIFIER NOT NULL, -- Soft link to hr.staff
    department_id UNIQUEIDENTIFIER, -- Soft link to hr.departments
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
    uploaded_by UNIQUEIDENTIFIER, -- Soft link to iam.users
    created_at DATETIME2(0) DEFAULT (SYSDATETIME()),
    updated_at DATETIME2(0) DEFAULT (SYSDATETIME())
);
GO

CREATE TABLE compliance.cme_cycles (
    cycle_id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT (NEWID()),
    certificate_id UNIQUEIDENTIFIER NOT NULL, -- Internal link
    cycle_number INT NOT NULL,
    cycle_start DATE NOT NULL,
    cycle_end DATE NOT NULL,
    required_credits DECIMAL(6,2) NOT NULL,
    earned_credits DECIMAL(6,2) DEFAULT 0,
    status NVARCHAR(20) DEFAULT 'active',
    CONSTRAINT UQ_cme_cycles_cert_number UNIQUE (certificate_id, cycle_number)
);
GO

CREATE TABLE compliance.cme_records (
    cme_id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT (NEWID()),
    certificate_id UNIQUEIDENTIFIER NOT NULL, -- Internal link
    cme_cycle_id UNIQUEIDENTIFIER, -- Internal link
    course_name NVARCHAR(200) NOT NULL,
    provider NVARCHAR(200),
    completed_date DATE NOT NULL,
    credits DECIMAL(5,2) NOT NULL,
    file_url NVARCHAR(500),
    verified BIT DEFAULT 0,
    verified_by UNIQUEIDENTIFIER, -- Soft link to iam.users
    verified_at DATETIME2(0),
    created_at DATETIME2(0) DEFAULT (SYSDATETIME())
);
GO

CREATE TABLE compliance.compliance_scans (
    scan_id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT (NEWID()),
    staff_id UNIQUEIDENTIFIER NOT NULL, -- Soft link to hr.staff
    department_id UNIQUEIDENTIFIER, -- Soft link to hr.departments
    certificate_id UNIQUEIDENTIFIER, -- Internal link
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
-- 6. NOTIFICATION SERVICE
-- ============================================================
CREATE TABLE notification.notifications (
    notification_id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT (NEWID()),
    recipient_id UNIQUEIDENTIFIER NOT NULL, -- Soft link to iam.users / hr.staff
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
-- 7. INTERNAL FOREIGN KEYS SETUP (WITHIN BOUNDED CONTEXTS ONLY)
-- ============================================================
-- IAM
ALTER TABLE iam.refresh_tokens ADD CONSTRAINT FK_refresh_tokens_user FOREIGN KEY (user_id) REFERENCES iam.users(user_id) ON DELETE CASCADE;
ALTER TABLE iam.system_policies ADD CONSTRAINT FK_system_policies_updated_by FOREIGN KEY (updated_by) REFERENCES iam.users(user_id);

-- Core HR
ALTER TABLE hr.departments ADD CONSTRAINT FK_departments_manager FOREIGN KEY (manager_id) REFERENCES hr.staff(staff_id);
ALTER TABLE hr.staff ADD CONSTRAINT FK_staff_dept FOREIGN KEY (department_id) REFERENCES hr.departments(department_id);
ALTER TABLE hr.staff ADD CONSTRAINT FK_staff_pos FOREIGN KEY (position_id) REFERENCES hr.positions(position_id);
ALTER TABLE hr.contracts ADD CONSTRAINT FK_contracts_staff FOREIGN KEY (staff_id) REFERENCES hr.staff(staff_id);
ALTER TABLE hr.degrees ADD CONSTRAINT FK_degrees_staff FOREIGN KEY (staff_id) REFERENCES hr.staff(staff_id);

-- Attendance
ALTER TABLE attendance.attendance_records ADD CONSTRAINT FK_attendance_records_import FOREIGN KEY (import_id) REFERENCES attendance.attendance_imports(import_id);
ALTER TABLE attendance.attendance_records ADD CONSTRAINT FK_attendance_records_oncall FOREIGN KEY (on_call_shift_id) REFERENCES attendance.on_call_shifts(shift_id);

-- Payroll
ALTER TABLE payroll.commission_rules ADD CONSTRAINT FK_commission_rules_service FOREIGN KEY (service_id) REFERENCES payroll.procedure_services(service_id);
ALTER TABLE payroll.procedure_slips ADD CONSTRAINT FK_procedure_slips_service FOREIGN KEY (service_id) REFERENCES payroll.procedure_services(service_id);
ALTER TABLE payroll.procedure_assignments ADD CONSTRAINT FK_procedure_assignments_slip FOREIGN KEY (slip_id) REFERENCES payroll.procedure_slips(slip_id);
ALTER TABLE payroll.procedure_assignments ADD CONSTRAINT FK_procedure_assignments_rule FOREIGN KEY (rule_id) REFERENCES payroll.commission_rules(rule_id);
ALTER TABLE payroll.staff_allowances ADD CONSTRAINT FK_staff_allowances_allowance FOREIGN KEY (allowance_id) REFERENCES payroll.allowance_types(allowance_id);
ALTER TABLE payroll.payslips ADD CONSTRAINT FK_payslips_bank_export FOREIGN KEY (bank_export_id) REFERENCES payroll.bank_exports(export_id);
ALTER TABLE payroll.payslip_allowances ADD CONSTRAINT FK_payslip_allowances_payslip FOREIGN KEY (payslip_id) REFERENCES payroll.payslips(payslip_id) ON DELETE CASCADE;
ALTER TABLE payroll.payslip_deductions ADD CONSTRAINT FK_payslip_deductions_payslip FOREIGN KEY (payslip_id) REFERENCES payroll.payslips(payslip_id) ON DELETE CASCADE;
ALTER TABLE payroll.complaint_attachments ADD CONSTRAINT FK_complaint_attachments_complaint FOREIGN KEY (complaint_id) REFERENCES payroll.complaints(complaint_id) ON DELETE CASCADE;

-- Compliance
ALTER TABLE compliance.cme_cycles ADD CONSTRAINT FK_cme_cycles_cert FOREIGN KEY (certificate_id) REFERENCES compliance.certificates(certificate_id);
ALTER TABLE compliance.cme_records ADD CONSTRAINT FK_cme_records_cert FOREIGN KEY (certificate_id) REFERENCES compliance.certificates(certificate_id);
ALTER TABLE compliance.cme_records ADD CONSTRAINT FK_cme_records_cycle FOREIGN KEY (cme_cycle_id) REFERENCES compliance.cme_cycles(cycle_id);
GO

-- ============================================================
-- 8. INDEXES FOR PERFORMANCE
-- ============================================================
CREATE INDEX IX_attendance_records_work_date ON attendance.attendance_records(work_date, department_id, validation_status);
CREATE INDEX IX_attendance_records_staff_code_work_date ON attendance.attendance_records(staff_code, work_date);
CREATE INDEX IX_payslips_pay_month_status ON payroll.payslips(pay_month, status, department_id);
CREATE INDEX IX_certificates_expiry_date ON compliance.certificates(expiry_date, status);
CREATE INDEX IX_cme_cycles_cycle_end ON compliance.cme_cycles(cycle_end, status);
CREATE INDEX IX_notifications_recipient_unread ON notification.notifications(recipient_id, is_read, created_at DESC);
CREATE INDEX IX_staff_allowances_staff_effective ON payroll.staff_allowances(staff_id, status, effective_from, effective_to);
CREATE INDEX IX_payslip_deductions_payslip ON payroll.payslip_deductions(payslip_id, deduction_type);
GO
