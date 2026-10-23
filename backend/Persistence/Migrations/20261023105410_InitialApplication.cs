using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Vnc.HRMS.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class InitialApplication : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "payroll");

            migrationBuilder.EnsureSchema(
                name: "attendance");

            migrationBuilder.EnsureSchema(
                name: "iam");

            migrationBuilder.EnsureSchema(
                name: "compliance");

            migrationBuilder.EnsureSchema(
                name: "hr");

            migrationBuilder.EnsureSchema(
                name: "notification");

            migrationBuilder.CreateTable(
                name: "allowance_types",
                schema: "payroll",
                columns: table => new
                {
                    allowance_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "NEWID()"),
                    code = table.Column<string>(type: "nvarchar(30)", nullable: false),
                    name = table.Column<string>(type: "nvarchar(100)", nullable: false),
                    value_type = table.Column<string>(type: "nvarchar(20)", nullable: false),
                    default_value = table.Column<decimal>(type: "decimal(15,2)", nullable: true),
                    applies_to = table.Column<string>(type: "nvarchar(50)", nullable: true, defaultValueSql: "'all'"),
                    is_taxable = table.Column<bool>(type: "bit", nullable: true, defaultValueSql: "0"),
                    is_insurance_basis = table.Column<bool>(type: "bit", nullable: true, defaultValueSql: "0"),
                    status = table.Column<string>(type: "nvarchar(20)", nullable: true, defaultValueSql: "'active'"),
                    created_at = table.Column<DateTime>(type: "datetime2(0)", nullable: true, defaultValueSql: "SYSUTCDATETIME()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_allowance_types", x => x.allowance_id);
                });

            migrationBuilder.CreateTable(
                name: "attendance_imports",
                schema: "attendance",
                columns: table => new
                {
                    import_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "NEWID()"),
                    file_name = table.Column<string>(type: "nvarchar(255)", nullable: false),
                    file_url = table.Column<string>(type: "nvarchar(500)", nullable: true),
                    imported_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    import_date = table.Column<DateTime>(type: "datetime2(0)", nullable: true, defaultValueSql: "SYSUTCDATETIME()"),
                    pay_month = table.Column<string>(type: "nvarchar(7)", nullable: true),
                    total_rows = table.Column<int>(type: "int", nullable: true, defaultValueSql: "0"),
                    success_rows = table.Column<int>(type: "int", nullable: true, defaultValueSql: "0"),
                    error_rows = table.Column<int>(type: "int", nullable: true, defaultValueSql: "0"),
                    status = table.Column<string>(type: "nvarchar(20)", nullable: true, defaultValueSql: "'pending'"),
                    error_log = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    column_mapping = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_attendance_imports", x => x.import_id);
                    table.CheckConstraint("CK_attendance_imports_1", "[total_rows] >= 0 AND [success_rows] >= 0 AND [error_rows] >= 0");
                });

            migrationBuilder.CreateTable(
                name: "audit_logs",
                schema: "iam",
                columns: table => new
                {
                    log_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "NEWID()"),
                    user_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    username = table.Column<string>(type: "nvarchar(50)", nullable: true),
                    action = table.Column<string>(type: "nvarchar(100)", nullable: false),
                    entity_type = table.Column<string>(type: "nvarchar(50)", nullable: true),
                    entity_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    old_value = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    new_value = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ip_address = table.Column<string>(type: "nvarchar(45)", nullable: true),
                    user_agent = table.Column<string>(type: "nvarchar(300)", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime2(0)", nullable: true, defaultValueSql: "SYSUTCDATETIME()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_audit_logs", x => x.log_id);
                });

            migrationBuilder.CreateTable(
                name: "bank_exports",
                schema: "payroll",
                columns: table => new
                {
                    export_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "NEWID()"),
                    pay_month = table.Column<string>(type: "nvarchar(7)", nullable: false),
                    file_name = table.Column<string>(type: "nvarchar(255)", nullable: false),
                    file_url = table.Column<string>(type: "nvarchar(500)", nullable: true),
                    exported_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    exported_at = table.Column<DateTime>(type: "datetime2(0)", nullable: false, defaultValueSql: "SYSUTCDATETIME()"),
                    status = table.Column<string>(type: "nvarchar(20)", nullable: false, defaultValueSql: "'completed'"),
                    row_count = table.Column<int>(type: "int", nullable: false, defaultValueSql: "0"),
                    notes = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_bank_exports", x => x.export_id);
                });

            migrationBuilder.CreateTable(
                name: "certificates",
                schema: "compliance",
                columns: table => new
                {
                    certificate_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "NEWID()"),
                    staff_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    department_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    certificate_number = table.Column<string>(type: "nvarchar(100)", nullable: true),
                    certificate_type = table.Column<string>(type: "nvarchar(100)", nullable: false),
                    issuing_authority = table.Column<string>(type: "nvarchar(200)", nullable: true),
                    issue_date = table.Column<DateOnly>(type: "date", nullable: true),
                    expiry_date = table.Column<DateOnly>(type: "date", nullable: true),
                    scope_of_practice = table.Column<string>(type: "nvarchar(200)", nullable: true),
                    cme_cycle_months = table.Column<int>(type: "int", nullable: true),
                    cme_required_credits = table.Column<decimal>(type: "decimal(6,2)", nullable: true),
                    status = table.Column<string>(type: "nvarchar(20)", nullable: true, defaultValueSql: "'active'"),
                    file_url = table.Column<string>(type: "nvarchar(500)", nullable: true),
                    uploaded_by = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime2(0)", nullable: true, defaultValueSql: "SYSUTCDATETIME()"),
                    updated_at = table.Column<DateTime>(type: "datetime2(0)", nullable: true, defaultValueSql: "SYSUTCDATETIME()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_certificates", x => x.certificate_id);
                    table.CheckConstraint("CK_certificates_1", "[expiry_date] IS NULL OR [issue_date] IS NULL OR [expiry_date] >= [issue_date]");
                });

            migrationBuilder.CreateTable(
                name: "leave_requests",
                schema: "attendance",
                columns: table => new
                {
                    request_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "NEWID()"),
                    staff_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    department_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    leave_type = table.Column<string>(type: "nvarchar(50)", nullable: false),
                    start_date = table.Column<DateOnly>(type: "date", nullable: false),
                    end_date = table.Column<DateOnly>(type: "date", nullable: false),
                    total_days = table.Column<decimal>(type: "decimal(4,1)", nullable: true),
                    reason = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    attachment_url = table.Column<string>(type: "nvarchar(500)", nullable: true),
                    status = table.Column<string>(type: "nvarchar(20)", nullable: true, defaultValueSql: "'pending'"),
                    approved_by = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    approved_at = table.Column<DateTime>(type: "datetime2(0)", nullable: true),
                    rejected_reason = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime2(0)", nullable: true, defaultValueSql: "SYSUTCDATETIME()"),
                    updated_at = table.Column<DateTime>(type: "datetime2(0)", nullable: true, defaultValueSql: "SYSUTCDATETIME()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_leave_requests", x => x.request_id);
                    table.CheckConstraint("CK_leave_requests_1", "[end_date] >= [start_date]");
                    table.CheckConstraint("CK_leave_requests_2", "[total_days] IS NULL OR [total_days] > 0");
                });

            migrationBuilder.CreateTable(
                name: "maternity_cases",
                schema: "payroll",
                columns: table => new
                {
                    maternity_case_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "NEWID()"),
                    staff_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    leave_request_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    expected_due_date = table.Column<DateOnly>(type: "date", nullable: true),
                    actual_birth_date = table.Column<DateOnly>(type: "date", nullable: true),
                    leave_start_date = table.Column<DateOnly>(type: "date", nullable: false),
                    leave_end_date = table.Column<DateOnly>(type: "date", nullable: false),
                    insurance_eligible = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    contribution_months = table.Column<int>(type: "int", nullable: true),
                    average_insurance_salary = table.Column<decimal>(type: "decimal(15,2)", nullable: true),
                    benefit_amount = table.Column<decimal>(type: "decimal(15,2)", nullable: false, defaultValueSql: "0"),
                    additional_benefit_amount = table.Column<decimal>(type: "decimal(15,2)", nullable: false, defaultValueSql: "0"),
                    total_benefit_amount = table.Column<decimal>(type: "decimal(16,2)", precision: 16, scale: 2, nullable: false, computedColumnSql: "[benefit_amount] + [additional_benefit_amount]", stored: true),
                    status = table.Column<string>(type: "nvarchar(20)", nullable: false, defaultValueSql: "'pending'"),
                    supporting_document_url = table.Column<string>(type: "nvarchar(500)", nullable: true),
                    notes = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    reviewed_by = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    reviewed_at = table.Column<DateTime>(type: "datetime2(0)", nullable: true),
                    paid_at = table.Column<DateTime>(type: "datetime2(0)", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime2(0)", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_maternity_cases", x => x.maternity_case_id);
                    table.CheckConstraint("CK_maternity_cases_1", "[leave_end_date] >= [leave_start_date]");
                    table.CheckConstraint("CK_maternity_cases_2", "[benefit_amount] >= 0 AND [additional_benefit_amount] >= 0");
                });

            migrationBuilder.CreateTable(
                name: "monthly_timesheets",
                schema: "attendance",
                columns: table => new
                {
                    timesheet_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "NEWID()"),
                    pay_month = table.Column<string>(type: "nvarchar(7)", nullable: false),
                    status = table.Column<string>(type: "nvarchar(20)", nullable: false, defaultValueSql: "'draft'"),
                    locked_by = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    locked_at = table.Column<DateTime>(type: "datetime2(0)", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime2(0)", nullable: false, defaultValueSql: "SYSUTCDATETIME()"),
                    updated_at = table.Column<DateTime>(type: "datetime2(0)", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_monthly_timesheets", x => x.timesheet_id);
                    table.CheckConstraint("CK_monthly_timesheets_1", "[pay_month] LIKE '[12][0-9][0-9][0-9]-[01][0-9]' AND TRY_CONVERT(date, [pay_month] + '-01', 23) IS NOT NULL");
                });

            migrationBuilder.CreateTable(
                name: "notifications",
                schema: "notification",
                columns: table => new
                {
                    notification_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "NEWID()"),
                    recipient_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    sender_service = table.Column<string>(type: "nvarchar(50)", nullable: false),
                    type = table.Column<string>(type: "nvarchar(50)", nullable: false),
                    title = table.Column<string>(type: "nvarchar(200)", nullable: false),
                    body = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    action_url = table.Column<string>(type: "nvarchar(500)", nullable: true),
                    entity_type = table.Column<string>(type: "nvarchar(50)", nullable: true),
                    entity_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    channel = table.Column<string>(type: "nvarchar(20)", nullable: true, defaultValueSql: "'in_app'"),
                    is_read = table.Column<bool>(type: "bit", nullable: true, defaultValueSql: "0"),
                    read_at = table.Column<DateTime>(type: "datetime2(0)", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime2(0)", nullable: true, defaultValueSql: "SYSUTCDATETIME()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_notifications", x => x.notification_id);
                });

            migrationBuilder.CreateTable(
                name: "on_call_shifts",
                schema: "attendance",
                columns: table => new
                {
                    shift_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "NEWID()"),
                    staff_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    department_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    shift_date = table.Column<DateOnly>(type: "date", nullable: false),
                    shift_category = table.Column<string>(type: "nvarchar(30)", nullable: false),
                    shift_start = table.Column<DateTime>(type: "datetime2(0)", nullable: true),
                    shift_end = table.Column<DateTime>(type: "datetime2(0)", nullable: true),
                    recorded_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    confirmed_by = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    confirmed_at = table.Column<DateTime>(type: "datetime2(0)", nullable: true),
                    status = table.Column<string>(type: "nvarchar(20)", nullable: true, defaultValueSql: "'pending'"),
                    rejected_reason = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    note = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime2(0)", nullable: true, defaultValueSql: "SYSUTCDATETIME()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_on_call_shifts", x => x.shift_id);
                    table.CheckConstraint("CK_on_call_shifts_1", "[shift_end] IS NULL OR [shift_start] IS NULL OR [shift_end] > [shift_start]");
                });

            migrationBuilder.CreateTable(
                name: "payroll_insurance_configs",
                schema: "payroll",
                columns: table => new
                {
                    config_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "NEWID()"),
                    insurance_type = table.Column<string>(type: "nvarchar(20)", nullable: false),
                    payer = table.Column<string>(type: "nvarchar(20)", nullable: false),
                    rate_percent = table.Column<decimal>(type: "decimal(5,2)", nullable: false),
                    applies_to = table.Column<string>(type: "nvarchar(50)", nullable: true, defaultValueSql: "'all'"),
                    effective_from = table.Column<DateOnly>(type: "date", nullable: false),
                    effective_to = table.Column<DateOnly>(type: "date", nullable: true),
                    status = table.Column<string>(type: "nvarchar(20)", nullable: true, defaultValueSql: "'active'")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_payroll_insurance_configs", x => x.config_id);
                    table.CheckConstraint("CK_payroll_insurance_configs_1", "[rate_percent] BETWEEN 0 AND 100");
                    table.CheckConstraint("CK_payroll_insurance_configs_2", "[effective_to] IS NULL OR [effective_to] >= [effective_from]");
                });

            migrationBuilder.CreateTable(
                name: "payroll_locks",
                schema: "payroll",
                columns: table => new
                {
                    lock_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "NEWID()"),
                    pay_month = table.Column<string>(type: "nvarchar(7)", nullable: false),
                    status = table.Column<string>(type: "nvarchar(20)", nullable: true, defaultValueSql: "'open'"),
                    locked_by = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    locked_at = table.Column<DateTime>(type: "datetime2(0)", nullable: true),
                    exported_by = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    exported_at = table.Column<DateTime>(type: "datetime2(0)", nullable: true),
                    export_file_url = table.Column<string>(type: "nvarchar(500)", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime2(0)", nullable: true, defaultValueSql: "SYSUTCDATETIME()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_payroll_locks", x => x.lock_id);
                });

            migrationBuilder.CreateTable(
                name: "payroll_tax_brackets",
                schema: "payroll",
                columns: table => new
                {
                    bracket_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "NEWID()"),
                    income_from = table.Column<decimal>(type: "decimal(15,2)", nullable: false),
                    income_to = table.Column<decimal>(type: "decimal(15,2)", nullable: true),
                    tax_rate_percent = table.Column<decimal>(type: "decimal(5,2)", nullable: false),
                    effective_from = table.Column<DateOnly>(type: "date", nullable: false),
                    effective_to = table.Column<DateOnly>(type: "date", nullable: true),
                    status = table.Column<string>(type: "nvarchar(20)", nullable: true, defaultValueSql: "'active'")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_payroll_tax_brackets", x => x.bracket_id);
                    table.CheckConstraint("CK_payroll_tax_brackets_1", "[income_from] >= 0 AND ([income_to] IS NULL OR [income_to] > [income_from])");
                    table.CheckConstraint("CK_payroll_tax_brackets_2", "[tax_rate_percent] BETWEEN 0 AND 100");
                    table.CheckConstraint("CK_payroll_tax_brackets_3", "[effective_to] IS NULL OR [effective_to] >= [effective_from]");
                });

            migrationBuilder.CreateTable(
                name: "positions",
                schema: "hr",
                columns: table => new
                {
                    position_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "NEWID()"),
                    name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    scope_tag = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false, defaultValue: "active")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_positions", x => x.position_id);
                });

            migrationBuilder.CreateTable(
                name: "procedure_services",
                schema: "payroll",
                columns: table => new
                {
                    service_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "NEWID()"),
                    service_code = table.Column<string>(type: "nvarchar(30)", nullable: false),
                    service_name = table.Column<string>(type: "nvarchar(200)", nullable: false),
                    category = table.Column<string>(type: "nvarchar(100)", nullable: true),
                    status = table.Column<string>(type: "nvarchar(20)", nullable: true, defaultValueSql: "'active'")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_procedure_services", x => x.service_id);
                });

            migrationBuilder.CreateTable(
                name: "users",
                schema: "iam",
                columns: table => new
                {
                    user_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "NEWID()"),
                    username = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    normalized_username = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    email = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    employee_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    is_provisioned = table.Column<bool>(type: "bit", nullable: false),
                    security_version = table.Column<int>(type: "int", nullable: false),
                    version = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false),
                    full_name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    role = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    account_status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false, defaultValue: "active"),
                    created_at = table.Column<DateTime>(type: "datetime2(0)", nullable: false, defaultValueSql: "SYSUTCDATETIME()"),
                    updated_at = table.Column<DateTime>(type: "datetime2(0)", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_users", x => x.user_id);
                });

            migrationBuilder.CreateTable(
                name: "work_schedule_templates",
                schema: "attendance",
                columns: table => new
                {
                    template_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "NEWID()"),
                    name = table.Column<string>(type: "nvarchar(100)", nullable: false),
                    shift_start = table.Column<TimeOnly>(type: "time", nullable: false),
                    shift_end = table.Column<TimeOnly>(type: "time", nullable: false),
                    break_minutes = table.Column<int>(type: "int", nullable: true, defaultValueSql: "0"),
                    standard_hours = table.Column<decimal>(type: "decimal(4,2)", nullable: true),
                    description = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    status = table.Column<string>(type: "nvarchar(20)", nullable: true, defaultValueSql: "'active'")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_work_schedule_templates", x => x.template_id);
                    table.CheckConstraint("CK_work_schedule_templates_1", "[break_minutes] >= 0");
                });

            migrationBuilder.CreateTable(
                name: "staff_allowances",
                schema: "payroll",
                columns: table => new
                {
                    staff_allowance_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "NEWID()"),
                    staff_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    allowance_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    value_type = table.Column<string>(type: "nvarchar(20)", nullable: false),
                    amount_value = table.Column<decimal>(type: "decimal(15,2)", nullable: false),
                    effective_from = table.Column<DateOnly>(type: "date", nullable: false),
                    effective_to = table.Column<DateOnly>(type: "date", nullable: true),
                    status = table.Column<string>(type: "nvarchar(20)", nullable: false, defaultValueSql: "'active'"),
                    approved_by = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime2(0)", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_staff_allowances", x => x.staff_allowance_id);
                    table.CheckConstraint("CK_staff_allowances_1", "[effective_to] IS NULL OR [effective_to] >= [effective_from]");
                    table.CheckConstraint("CK_staff_allowances_2", "[amount_value] >= 0");
                    table.ForeignKey(
                        name: "FK_staff_allowances_allowance_types_allowance_id",
                        column: x => x.allowance_id,
                        principalSchema: "payroll",
                        principalTable: "allowance_types",
                        principalColumn: "allowance_id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "payslips",
                schema: "payroll",
                columns: table => new
                {
                    payslip_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "NEWID()"),
                    staff_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    staff_name = table.Column<string>(type: "nvarchar(100)", nullable: true),
                    department_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    contract_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    contract_type = table.Column<string>(type: "nvarchar(50)", nullable: true),
                    pay_month = table.Column<string>(type: "nvarchar(7)", nullable: false),
                    work_days = table.Column<decimal>(type: "decimal(5,2)", nullable: true),
                    on_call_days = table.Column<decimal>(type: "decimal(5,2)", nullable: true),
                    maternity_leave_days = table.Column<decimal>(type: "decimal(5,2)", nullable: true, defaultValueSql: "0"),
                    base_pay = table.Column<decimal>(type: "decimal(15,2)", nullable: true, defaultValueSql: "0"),
                    allowance_total = table.Column<decimal>(type: "decimal(15,2)", nullable: true, defaultValueSql: "0"),
                    commission_total = table.Column<decimal>(type: "decimal(15,2)", nullable: true, defaultValueSql: "0"),
                    maternity_allowance = table.Column<decimal>(type: "decimal(15,2)", nullable: true, defaultValueSql: "0"),
                    gross_pay = table.Column<decimal>(type: "decimal(15,2)", nullable: true),
                    insurance_salary_base = table.Column<decimal>(type: "decimal(15,2)", nullable: true, defaultValueSql: "0"),
                    insurance_deduction = table.Column<decimal>(type: "decimal(15,2)", nullable: true, defaultValueSql: "0"),
                    dependent_count = table.Column<int>(type: "int", nullable: true, defaultValueSql: "0"),
                    personal_deduction = table.Column<decimal>(type: "decimal(15,2)", nullable: true, defaultValueSql: "0"),
                    dependent_deduction = table.Column<decimal>(type: "decimal(15,2)", nullable: true, defaultValueSql: "0"),
                    taxable_income = table.Column<decimal>(type: "decimal(15,2)", nullable: true, defaultValueSql: "0"),
                    tax_deduction = table.Column<decimal>(type: "decimal(15,2)", nullable: true, defaultValueSql: "0"),
                    other_deduction = table.Column<decimal>(type: "decimal(15,2)", nullable: true, defaultValueSql: "0"),
                    net_pay = table.Column<decimal>(type: "decimal(15,2)", nullable: true),
                    status = table.Column<string>(type: "nvarchar(30)", nullable: true, defaultValueSql: "'draft'"),
                    dept_approved_by = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    dept_approved_at = table.Column<DateTime>(type: "datetime2(0)", nullable: true),
                    dept_rejected_reason = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    finalized_by = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    finalized_at = table.Column<DateTime>(type: "datetime2(0)", nullable: true),
                    payment_date = table.Column<DateOnly>(type: "date", nullable: true),
                    bank_export_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    is_locked = table.Column<bool>(type: "bit", nullable: true, defaultValueSql: "0"),
                    locked_at = table.Column<DateTime>(type: "datetime2(0)", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime2(0)", nullable: true, defaultValueSql: "SYSUTCDATETIME()"),
                    updated_at = table.Column<DateTime>(type: "datetime2(0)", nullable: true, defaultValueSql: "SYSUTCDATETIME()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_payslips", x => x.payslip_id);
                    table.CheckConstraint("CK_payslips_1", "[pay_month] LIKE '[12][0-9][0-9][0-9]-[01][0-9]' AND TRY_CONVERT(date, [pay_month] + '-01', 23) IS NOT NULL");
                    table.ForeignKey(
                        name: "FK_payslips_bank_exports_bank_export_id",
                        column: x => x.bank_export_id,
                        principalSchema: "payroll",
                        principalTable: "bank_exports",
                        principalColumn: "export_id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "cme_cycles",
                schema: "compliance",
                columns: table => new
                {
                    cycle_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "NEWID()"),
                    certificate_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    cycle_number = table.Column<int>(type: "int", nullable: false),
                    cycle_start = table.Column<DateOnly>(type: "date", nullable: false),
                    cycle_end = table.Column<DateOnly>(type: "date", nullable: false),
                    required_credits = table.Column<decimal>(type: "decimal(6,2)", nullable: false),
                    earned_credits = table.Column<decimal>(type: "decimal(6,2)", nullable: true, defaultValueSql: "0"),
                    status = table.Column<string>(type: "nvarchar(20)", nullable: true, defaultValueSql: "'active'")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_cme_cycles", x => x.cycle_id);
                    table.CheckConstraint("CK_cme_cycles_1", "[cycle_end] >= [cycle_start]");
                    table.CheckConstraint("CK_cme_cycles_2", "[cycle_number] > 0 AND [required_credits] >= 0 AND [earned_credits] >= 0");
                    table.ForeignKey(
                        name: "FK_cme_cycles_certificates_certificate_id",
                        column: x => x.certificate_id,
                        principalSchema: "compliance",
                        principalTable: "certificates",
                        principalColumn: "certificate_id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "compliance_scans",
                schema: "compliance",
                columns: table => new
                {
                    scan_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "NEWID()"),
                    staff_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    department_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    certificate_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    scan_date = table.Column<DateTime>(type: "datetime2(0)", nullable: true, defaultValueSql: "SYSUTCDATETIME()"),
                    expiry_date = table.Column<DateOnly>(type: "date", nullable: true),
                    days_remaining = table.Column<int>(type: "int", nullable: true),
                    cme_credits_earned = table.Column<decimal>(type: "decimal(6,2)", nullable: true),
                    cme_credits_needed = table.Column<decimal>(type: "decimal(6,2)", nullable: true),
                    compliance_status = table.Column<string>(type: "nvarchar(30)", nullable: false),
                    alert_sent = table.Column<bool>(type: "bit", nullable: true, defaultValueSql: "0"),
                    alert_sent_at = table.Column<DateTime>(type: "datetime2(0)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_compliance_scans", x => x.scan_id);
                    table.ForeignKey(
                        name: "FK_compliance_scans_certificates_certificate_id",
                        column: x => x.certificate_id,
                        principalSchema: "compliance",
                        principalTable: "certificates",
                        principalColumn: "certificate_id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "attendance_records",
                schema: "attendance",
                columns: table => new
                {
                    attendance_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "NEWID()"),
                    staff_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    staff_code = table.Column<string>(type: "nvarchar(20)", nullable: false),
                    department_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    import_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    on_call_shift_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    work_date = table.Column<DateOnly>(type: "date", nullable: false),
                    shift_type = table.Column<string>(type: "nvarchar(30)", nullable: true),
                    check_in = table.Column<DateTime>(type: "datetime2(0)", nullable: true),
                    check_out = table.Column<DateTime>(type: "datetime2(0)", nullable: true),
                    actual_hours = table.Column<decimal>(type: "decimal(5,2)", nullable: true),
                    source = table.Column<string>(type: "nvarchar(20)", nullable: true, defaultValueSql: "'fingerprint'"),
                    validation_status = table.Column<string>(type: "nvarchar(20)", nullable: true, defaultValueSql: "'pending'"),
                    note = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    reconciled_by = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    reconciled_at = table.Column<DateTime>(type: "datetime2(0)", nullable: true),
                    reconcile_note = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    confirmed_by = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    confirmed_at = table.Column<DateTime>(type: "datetime2(0)", nullable: true),
                    payslip_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime2(0)", nullable: true, defaultValueSql: "SYSUTCDATETIME()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_attendance_records", x => x.attendance_id);
                    table.CheckConstraint("CK_attendance_records_1", "[check_out] IS NULL OR [check_in] IS NULL OR [check_out] >= [check_in]");
                    table.CheckConstraint("CK_attendance_records_2", "[actual_hours] IS NULL OR [actual_hours] >= 0");
                    table.ForeignKey(
                        name: "FK_attendance_records_attendance_imports_import_id",
                        column: x => x.import_id,
                        principalSchema: "attendance",
                        principalTable: "attendance_imports",
                        principalColumn: "import_id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_attendance_records_on_call_shifts_on_call_shift_id",
                        column: x => x.on_call_shift_id,
                        principalSchema: "attendance",
                        principalTable: "on_call_shifts",
                        principalColumn: "shift_id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "commission_rules",
                schema: "payroll",
                columns: table => new
                {
                    rule_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "NEWID()"),
                    service_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    role = table.Column<string>(type: "nvarchar(50)", nullable: false),
                    value_type = table.Column<string>(type: "nvarchar(20)", nullable: false),
                    commission_value = table.Column<decimal>(type: "decimal(15,4)", nullable: false),
                    effective_from = table.Column<DateOnly>(type: "date", nullable: false),
                    effective_to = table.Column<DateOnly>(type: "date", nullable: true),
                    status = table.Column<string>(type: "nvarchar(20)", nullable: true, defaultValueSql: "'active'"),
                    created_by = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime2(0)", nullable: true, defaultValueSql: "SYSUTCDATETIME()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_commission_rules", x => x.rule_id);
                    table.CheckConstraint("CK_commission_rules_1", "[effective_to] IS NULL OR [effective_to] >= [effective_from]");
                    table.CheckConstraint("CK_commission_rules_2", "[commission_value] >= 0");
                    table.ForeignKey(
                        name: "FK_commission_rules_procedure_services_service_id",
                        column: x => x.service_id,
                        principalSchema: "payroll",
                        principalTable: "procedure_services",
                        principalColumn: "service_id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "procedure_slips",
                schema: "payroll",
                columns: table => new
                {
                    slip_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "NEWID()"),
                    service_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    department_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    slip_number = table.Column<string>(type: "nvarchar(50)", nullable: false),
                    procedure_date = table.Column<DateOnly>(type: "date", nullable: false),
                    patient_code = table.Column<string>(type: "nvarchar(50)", nullable: true),
                    status = table.Column<string>(type: "nvarchar(20)", nullable: true, defaultValueSql: "'pending'"),
                    recorded_by = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    verified_by = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    verified_at = table.Column<DateTime>(type: "datetime2(0)", nullable: true),
                    rejected_reason = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime2(0)", nullable: true, defaultValueSql: "SYSUTCDATETIME()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_procedure_slips", x => x.slip_id);
                    table.ForeignKey(
                        name: "FK_procedure_slips_procedure_services_service_id",
                        column: x => x.service_id,
                        principalSchema: "payroll",
                        principalTable: "procedure_services",
                        principalColumn: "service_id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "credentials",
                schema: "iam",
                columns: table => new
                {
                    user_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    password_hash = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    version = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false),
                    failed_login_count = table.Column<int>(type: "int", nullable: false),
                    locked_until = table.Column<DateTime>(type: "datetime2(0)", nullable: true),
                    last_login = table.Column<DateTime>(type: "datetime2(0)", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime2(0)", nullable: false, defaultValueSql: "SYSUTCDATETIME()"),
                    updated_at = table.Column<DateTime>(type: "datetime2(0)", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_credentials", x => x.user_id);
                    table.ForeignKey(
                        name: "FK_credentials_users_user_id",
                        column: x => x.user_id,
                        principalSchema: "iam",
                        principalTable: "users",
                        principalColumn: "user_id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "system_policies",
                schema: "iam",
                columns: table => new
                {
                    policy_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "NEWID()"),
                    policy_key = table.Column<string>(type: "nvarchar(100)", nullable: false),
                    policy_value = table.Column<string>(type: "nvarchar(500)", nullable: false),
                    value_type = table.Column<string>(type: "nvarchar(20)", nullable: true, defaultValueSql: "'string'"),
                    description = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    updated_by = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    updated_at = table.Column<DateTime>(type: "datetime2(0)", nullable: true, defaultValueSql: "SYSUTCDATETIME()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_system_policies", x => x.policy_id);
                    table.ForeignKey(
                        name: "FK_system_policies_users_updated_by",
                        column: x => x.updated_by,
                        principalSchema: "iam",
                        principalTable: "users",
                        principalColumn: "user_id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "complaints",
                schema: "payroll",
                columns: table => new
                {
                    complaint_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "NEWID()"),
                    staff_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    department_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    payslip_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    inquiry_type = table.Column<string>(type: "nvarchar(30)", nullable: false),
                    subject = table.Column<string>(type: "nvarchar(200)", nullable: false),
                    description = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    response = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    replied_by = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    replied_at = table.Column<DateTime>(type: "datetime2(0)", nullable: true),
                    status = table.Column<string>(type: "nvarchar(20)", nullable: true, defaultValueSql: "'open'"),
                    submitted_at = table.Column<DateTime>(type: "datetime2(0)", nullable: true, defaultValueSql: "SYSUTCDATETIME()"),
                    resolved_at = table.Column<DateTime>(type: "datetime2(0)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_complaints", x => x.complaint_id);
                    table.ForeignKey(
                        name: "FK_complaints_payslips_payslip_id",
                        column: x => x.payslip_id,
                        principalSchema: "payroll",
                        principalTable: "payslips",
                        principalColumn: "payslip_id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "payslip_allowances",
                schema: "payroll",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "NEWID()"),
                    payslip_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    allowance_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    name = table.Column<string>(type: "nvarchar(100)", nullable: false),
                    amount = table.Column<decimal>(type: "decimal(15,2)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_payslip_allowances", x => x.id);
                    table.ForeignKey(
                        name: "FK_payslip_allowances_allowance_types_allowance_id",
                        column: x => x.allowance_id,
                        principalSchema: "payroll",
                        principalTable: "allowance_types",
                        principalColumn: "allowance_id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_payslip_allowances_payslips_payslip_id",
                        column: x => x.payslip_id,
                        principalSchema: "payroll",
                        principalTable: "payslips",
                        principalColumn: "payslip_id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "payslip_deductions",
                schema: "payroll",
                columns: table => new
                {
                    payslip_deduction_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "NEWID()"),
                    payslip_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    deduction_type = table.Column<string>(type: "nvarchar(30)", nullable: false),
                    deduction_name = table.Column<string>(type: "nvarchar(100)", nullable: false),
                    calculation_base = table.Column<decimal>(type: "decimal(15,2)", nullable: false, defaultValueSql: "0"),
                    rate_percent = table.Column<decimal>(type: "decimal(7,4)", nullable: true),
                    amount = table.Column<decimal>(type: "decimal(15,2)", nullable: false, defaultValueSql: "0"),
                    payer = table.Column<string>(type: "nvarchar(20)", nullable: false, defaultValueSql: "'employee'"),
                    config_reference_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    notes = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime2(0)", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_payslip_deductions", x => x.payslip_deduction_id);
                    table.ForeignKey(
                        name: "FK_payslip_deductions_payslips_payslip_id",
                        column: x => x.payslip_id,
                        principalSchema: "payroll",
                        principalTable: "payslips",
                        principalColumn: "payslip_id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "cme_records",
                schema: "compliance",
                columns: table => new
                {
                    cme_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "NEWID()"),
                    certificate_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    cme_cycle_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    course_name = table.Column<string>(type: "nvarchar(200)", nullable: false),
                    provider = table.Column<string>(type: "nvarchar(200)", nullable: true),
                    completed_date = table.Column<DateOnly>(type: "date", nullable: false),
                    credits = table.Column<decimal>(type: "decimal(5,2)", nullable: false),
                    file_url = table.Column<string>(type: "nvarchar(500)", nullable: true),
                    verified = table.Column<bool>(type: "bit", nullable: true, defaultValueSql: "0"),
                    verified_by = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    verified_at = table.Column<DateTime>(type: "datetime2(0)", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime2(0)", nullable: true, defaultValueSql: "SYSUTCDATETIME()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_cme_records", x => x.cme_id);
                    table.CheckConstraint("CK_cme_records_1", "[credits] >= 0");
                    table.ForeignKey(
                        name: "FK_cme_records_certificates_certificate_id",
                        column: x => x.certificate_id,
                        principalSchema: "compliance",
                        principalTable: "certificates",
                        principalColumn: "certificate_id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_cme_records_cme_cycles_cme_cycle_id",
                        column: x => x.cme_cycle_id,
                        principalSchema: "compliance",
                        principalTable: "cme_cycles",
                        principalColumn: "cycle_id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "procedure_assignments",
                schema: "payroll",
                columns: table => new
                {
                    assignment_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "NEWID()"),
                    slip_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    staff_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    role = table.Column<string>(type: "nvarchar(50)", nullable: false),
                    rule_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    commission_amount = table.Column<decimal>(type: "decimal(15,2)", nullable: true),
                    payslip_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    status = table.Column<string>(type: "nvarchar(20)", nullable: true, defaultValueSql: "'pending'")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_procedure_assignments", x => x.assignment_id);
                    table.ForeignKey(
                        name: "FK_procedure_assignments_commission_rules_rule_id",
                        column: x => x.rule_id,
                        principalSchema: "payroll",
                        principalTable: "commission_rules",
                        principalColumn: "rule_id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_procedure_assignments_payslips_payslip_id",
                        column: x => x.payslip_id,
                        principalSchema: "payroll",
                        principalTable: "payslips",
                        principalColumn: "payslip_id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_procedure_assignments_procedure_slips_slip_id",
                        column: x => x.slip_id,
                        principalSchema: "payroll",
                        principalTable: "procedure_slips",
                        principalColumn: "slip_id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "password_reset_tokens",
                schema: "iam",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    user_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    token_hash = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    password_stamp = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    email = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    created_at = table.Column<DateTime>(type: "datetime2(0)", nullable: false),
                    expires_at = table.Column<DateTime>(type: "datetime2(0)", nullable: false),
                    used_at = table.Column<DateTime>(type: "datetime2(0)", nullable: true),
                    attempts = table.Column<int>(type: "int", nullable: false),
                    max_attempts = table.Column<int>(type: "int", nullable: false),
                    code_length = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_password_reset_tokens", x => x.id);
                    table.ForeignKey(
                        name: "FK_password_reset_tokens_credentials_user_id",
                        column: x => x.user_id,
                        principalSchema: "iam",
                        principalTable: "credentials",
                        principalColumn: "user_id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "refresh_tokens",
                schema: "iam",
                columns: table => new
                {
                    token_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "NEWID()"),
                    user_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    account_version = table.Column<int>(type: "int", nullable: false),
                    token_hash = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    device_info = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    expires_at = table.Column<DateTime>(type: "datetime2(0)", nullable: false),
                    revoked = table.Column<bool>(type: "bit", nullable: false),
                    revoked_at = table.Column<DateTime>(type: "datetime2(0)", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime2(0)", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_refresh_tokens", x => x.token_id);
                    table.ForeignKey(
                        name: "FK_refresh_tokens_credentials_user_id",
                        column: x => x.user_id,
                        principalSchema: "iam",
                        principalTable: "credentials",
                        principalColumn: "user_id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "complaint_attachments",
                schema: "payroll",
                columns: table => new
                {
                    attachment_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "NEWID()"),
                    complaint_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    file_url = table.Column<string>(type: "nvarchar(500)", nullable: false),
                    file_name = table.Column<string>(type: "nvarchar(255)", nullable: true),
                    uploaded_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    uploaded_at = table.Column<DateTime>(type: "datetime2(0)", nullable: true, defaultValueSql: "SYSUTCDATETIME()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_complaint_attachments", x => x.attachment_id);
                    table.ForeignKey(
                        name: "FK_complaint_attachments_complaints_complaint_id",
                        column: x => x.complaint_id,
                        principalSchema: "payroll",
                        principalTable: "complaints",
                        principalColumn: "complaint_id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "contracts",
                schema: "hr",
                columns: table => new
                {
                    contract_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "NEWID()"),
                    staff_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    contract_code = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    contract_type = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    daily_rate = table.Column<decimal>(type: "decimal(15,2)", precision: 15, scale: 2, nullable: false),
                    effective_from = table.Column<DateOnly>(type: "date", nullable: false),
                    effective_to = table.Column<DateOnly>(type: "date", nullable: true),
                    is_insurance_eligible = table.Column<bool>(type: "bit", nullable: false, defaultValue: true),
                    insurance_salary_basis = table.Column<decimal>(type: "decimal(15,2)", precision: 15, scale: 2, nullable: true),
                    status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false, defaultValue: "active"),
                    file_url = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime2(0)", nullable: false, defaultValueSql: "SYSUTCDATETIME()"),
                    updated_at = table.Column<DateTime>(type: "datetime2(0)", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_contracts", x => x.contract_id);
                    table.CheckConstraint("CK_contracts_1", "[effective_to] IS NULL OR [effective_to] >= [effective_from]");
                    table.CheckConstraint("CK_contracts_2", "[daily_rate] >= 0 AND ([insurance_salary_basis] IS NULL OR [insurance_salary_basis] >= 0)");
                });

            migrationBuilder.CreateTable(
                name: "degrees",
                schema: "hr",
                columns: table => new
                {
                    degree_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "NEWID()"),
                    staff_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    degree_type = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    degree_name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    issued_by = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    issued_at = table.Column<DateOnly>(type: "date", nullable: true),
                    file_url = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime2(0)", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_degrees", x => x.degree_id);
                });

            migrationBuilder.CreateTable(
                name: "departments",
                schema: "hr",
                columns: table => new
                {
                    department_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "NEWID()"),
                    dept_code = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    manager_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false, defaultValue: "active"),
                    created_at = table.Column<DateTime>(type: "datetime2(0)", nullable: false, defaultValueSql: "SYSUTCDATETIME()"),
                    updated_at = table.Column<DateTime>(type: "datetime2(0)", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_departments", x => x.department_id);
                });

            migrationBuilder.CreateTable(
                name: "staff",
                schema: "hr",
                columns: table => new
                {
                    staff_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "NEWID()"),
                    user_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    staff_code = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    device_enroll_id = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    full_name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    date_of_birth = table.Column<DateOnly>(type: "date", nullable: true),
                    gender = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    phone = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    email = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    id_card_number = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    avatar_url = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    department_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    position_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    scope_of_practice = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    date_joined = table.Column<DateOnly>(type: "date", nullable: false),
                    date_left = table.Column<DateOnly>(type: "date", nullable: true),
                    dependent_count = table.Column<int>(type: "int", nullable: false),
                    status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false, defaultValue: "active"),
                    created_by = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime2(0)", nullable: false, defaultValueSql: "SYSUTCDATETIME()"),
                    updated_at = table.Column<DateTime>(type: "datetime2(0)", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_staff", x => x.staff_id);
                    table.CheckConstraint("CK_staff_1", "[date_left] IS NULL OR [date_left] >= [date_joined]");
                    table.CheckConstraint("CK_staff_2", "[dependent_count] >= 0");
                    table.ForeignKey(
                        name: "FK_staff_departments_department_id",
                        column: x => x.department_id,
                        principalSchema: "hr",
                        principalTable: "departments",
                        principalColumn: "department_id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_staff_positions_position_id",
                        column: x => x.position_id,
                        principalSchema: "hr",
                        principalTable: "positions",
                        principalColumn: "position_id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_allowance_types_code",
                schema: "payroll",
                table: "allowance_types",
                column: "code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_attendance_records_import_id",
                schema: "attendance",
                table: "attendance_records",
                column: "import_id");

            migrationBuilder.CreateIndex(
                name: "IX_attendance_records_on_call_shift_id",
                schema: "attendance",
                table: "attendance_records",
                column: "on_call_shift_id");

            migrationBuilder.CreateIndex(
                name: "IX_attendance_records_staff_code_work_date",
                schema: "attendance",
                table: "attendance_records",
                columns: new[] { "staff_code", "work_date" });

            migrationBuilder.CreateIndex(
                name: "IX_attendance_records_staff_id_work_date_shift_type",
                schema: "attendance",
                table: "attendance_records",
                columns: new[] { "staff_id", "work_date", "shift_type" },
                unique: true,
                filter: "[shift_type] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_attendance_records_work_date",
                schema: "attendance",
                table: "attendance_records",
                columns: new[] { "work_date", "department_id", "validation_status" });

            migrationBuilder.CreateIndex(
                name: "IX_certificates_certificate_number",
                schema: "compliance",
                table: "certificates",
                column: "certificate_number",
                unique: true,
                filter: "[certificate_number] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_certificates_expiry_date",
                schema: "compliance",
                table: "certificates",
                columns: new[] { "expiry_date", "status" });

            migrationBuilder.CreateIndex(
                name: "IX_cme_cycles_certificate_id_cycle_number",
                schema: "compliance",
                table: "cme_cycles",
                columns: new[] { "certificate_id", "cycle_number" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_cme_cycles_cycle_end",
                schema: "compliance",
                table: "cme_cycles",
                columns: new[] { "cycle_end", "status" });

            migrationBuilder.CreateIndex(
                name: "IX_cme_records_certificate_id",
                schema: "compliance",
                table: "cme_records",
                column: "certificate_id");

            migrationBuilder.CreateIndex(
                name: "IX_cme_records_cme_cycle_id",
                schema: "compliance",
                table: "cme_records",
                column: "cme_cycle_id");

            migrationBuilder.CreateIndex(
                name: "IX_commission_rules_service_id",
                schema: "payroll",
                table: "commission_rules",
                column: "service_id");

            migrationBuilder.CreateIndex(
                name: "IX_complaint_attachments_complaint_id",
                schema: "payroll",
                table: "complaint_attachments",
                column: "complaint_id");

            migrationBuilder.CreateIndex(
                name: "IX_complaints_payslip_id",
                schema: "payroll",
                table: "complaints",
                column: "payslip_id");

            migrationBuilder.CreateIndex(
                name: "IX_compliance_scans_certificate_id",
                schema: "compliance",
                table: "compliance_scans",
                column: "certificate_id");

            migrationBuilder.CreateIndex(
                name: "IX_contracts_contract_code",
                schema: "hr",
                table: "contracts",
                column: "contract_code",
                unique: true,
                filter: "[contract_code] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_contracts_staff_id",
                schema: "hr",
                table: "contracts",
                column: "staff_id");

            migrationBuilder.CreateIndex(
                name: "IX_degrees_staff_id",
                schema: "hr",
                table: "degrees",
                column: "staff_id");

            migrationBuilder.CreateIndex(
                name: "IX_departments_dept_code",
                schema: "hr",
                table: "departments",
                column: "dept_code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_departments_manager_id",
                schema: "hr",
                table: "departments",
                column: "manager_id");

            migrationBuilder.CreateIndex(
                name: "IX_departments_name",
                schema: "hr",
                table: "departments",
                column: "name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_monthly_timesheets_pay_month",
                schema: "attendance",
                table: "monthly_timesheets",
                column: "pay_month",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_notifications_recipient_unread",
                schema: "notification",
                table: "notifications",
                columns: new[] { "recipient_id", "is_read", "created_at" },
                descending: new[] { false, false, true });

            migrationBuilder.CreateIndex(
                name: "IX_password_reset_tokens_token_hash",
                schema: "iam",
                table: "password_reset_tokens",
                column: "token_hash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_password_reset_tokens_user_id",
                schema: "iam",
                table: "password_reset_tokens",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "IX_payroll_locks_pay_month",
                schema: "payroll",
                table: "payroll_locks",
                column: "pay_month",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_payslip_allowances_allowance_id",
                schema: "payroll",
                table: "payslip_allowances",
                column: "allowance_id");

            migrationBuilder.CreateIndex(
                name: "IX_payslip_allowances_payslip_id",
                schema: "payroll",
                table: "payslip_allowances",
                column: "payslip_id");

            migrationBuilder.CreateIndex(
                name: "IX_payslip_deductions_payslip",
                schema: "payroll",
                table: "payslip_deductions",
                columns: new[] { "payslip_id", "deduction_type" });

            migrationBuilder.CreateIndex(
                name: "IX_payslips_bank_export_id",
                schema: "payroll",
                table: "payslips",
                column: "bank_export_id");

            migrationBuilder.CreateIndex(
                name: "IX_payslips_pay_month_status",
                schema: "payroll",
                table: "payslips",
                columns: new[] { "pay_month", "status", "department_id" });

            migrationBuilder.CreateIndex(
                name: "IX_payslips_staff_id_pay_month",
                schema: "payroll",
                table: "payslips",
                columns: new[] { "staff_id", "pay_month" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_positions_name",
                schema: "hr",
                table: "positions",
                column: "name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_procedure_assignments_payslip_id",
                schema: "payroll",
                table: "procedure_assignments",
                column: "payslip_id");

            migrationBuilder.CreateIndex(
                name: "IX_procedure_assignments_rule_id",
                schema: "payroll",
                table: "procedure_assignments",
                column: "rule_id");

            migrationBuilder.CreateIndex(
                name: "IX_procedure_assignments_slip_id",
                schema: "payroll",
                table: "procedure_assignments",
                column: "slip_id");

            migrationBuilder.CreateIndex(
                name: "IX_procedure_services_service_code",
                schema: "payroll",
                table: "procedure_services",
                column: "service_code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_procedure_slips_service_id",
                schema: "payroll",
                table: "procedure_slips",
                column: "service_id");

            migrationBuilder.CreateIndex(
                name: "IX_procedure_slips_slip_number",
                schema: "payroll",
                table: "procedure_slips",
                column: "slip_number",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_refresh_tokens_token_hash",
                schema: "iam",
                table: "refresh_tokens",
                column: "token_hash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_refresh_tokens_user_id",
                schema: "iam",
                table: "refresh_tokens",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "IX_staff_department_id",
                schema: "hr",
                table: "staff",
                column: "department_id");

            migrationBuilder.CreateIndex(
                name: "IX_staff_device_enroll_id",
                schema: "hr",
                table: "staff",
                column: "device_enroll_id",
                unique: true,
                filter: "[device_enroll_id] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_staff_email",
                schema: "hr",
                table: "staff",
                column: "email",
                unique: true,
                filter: "[email] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_staff_id_card_number",
                schema: "hr",
                table: "staff",
                column: "id_card_number",
                unique: true,
                filter: "[id_card_number] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_staff_position_id",
                schema: "hr",
                table: "staff",
                column: "position_id");

            migrationBuilder.CreateIndex(
                name: "IX_staff_staff_code",
                schema: "hr",
                table: "staff",
                column: "staff_code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_staff_user_id",
                schema: "hr",
                table: "staff",
                column: "user_id",
                unique: true,
                filter: "[user_id] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_staff_allowances_allowance_id",
                schema: "payroll",
                table: "staff_allowances",
                column: "allowance_id");

            migrationBuilder.CreateIndex(
                name: "IX_staff_allowances_staff_effective",
                schema: "payroll",
                table: "staff_allowances",
                columns: new[] { "staff_id", "status", "effective_from", "effective_to" });

            migrationBuilder.CreateIndex(
                name: "IX_system_policies_policy_key",
                schema: "iam",
                table: "system_policies",
                column: "policy_key",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_system_policies_updated_by",
                schema: "iam",
                table: "system_policies",
                column: "updated_by");

            migrationBuilder.CreateIndex(
                name: "IX_users_email",
                schema: "iam",
                table: "users",
                column: "email",
                unique: true,
                filter: "[email] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_users_employee_id",
                schema: "iam",
                table: "users",
                column: "employee_id",
                unique: true,
                filter: "[employee_id] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_users_normalized_username",
                schema: "iam",
                table: "users",
                column: "normalized_username",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_users_username",
                schema: "iam",
                table: "users",
                column: "username",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_contracts_staff_staff_id",
                schema: "hr",
                table: "contracts",
                column: "staff_id",
                principalSchema: "hr",
                principalTable: "staff",
                principalColumn: "staff_id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_degrees_staff_staff_id",
                schema: "hr",
                table: "degrees",
                column: "staff_id",
                principalSchema: "hr",
                principalTable: "staff",
                principalColumn: "staff_id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_departments_staff_manager_id",
                schema: "hr",
                table: "departments",
                column: "manager_id",
                principalSchema: "hr",
                principalTable: "staff",
                principalColumn: "staff_id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_departments_staff_manager_id",
                schema: "hr",
                table: "departments");

            migrationBuilder.DropTable(
                name: "attendance_records",
                schema: "attendance");

            migrationBuilder.DropTable(
                name: "audit_logs",
                schema: "iam");

            migrationBuilder.DropTable(
                name: "cme_records",
                schema: "compliance");

            migrationBuilder.DropTable(
                name: "complaint_attachments",
                schema: "payroll");

            migrationBuilder.DropTable(
                name: "compliance_scans",
                schema: "compliance");

            migrationBuilder.DropTable(
                name: "contracts",
                schema: "hr");

            migrationBuilder.DropTable(
                name: "degrees",
                schema: "hr");

            migrationBuilder.DropTable(
                name: "leave_requests",
                schema: "attendance");

            migrationBuilder.DropTable(
                name: "maternity_cases",
                schema: "payroll");

            migrationBuilder.DropTable(
                name: "monthly_timesheets",
                schema: "attendance");

            migrationBuilder.DropTable(
                name: "notifications",
                schema: "notification");

            migrationBuilder.DropTable(
                name: "password_reset_tokens",
                schema: "iam");

            migrationBuilder.DropTable(
                name: "payroll_insurance_configs",
                schema: "payroll");

            migrationBuilder.DropTable(
                name: "payroll_locks",
                schema: "payroll");

            migrationBuilder.DropTable(
                name: "payroll_tax_brackets",
                schema: "payroll");

            migrationBuilder.DropTable(
                name: "payslip_allowances",
                schema: "payroll");

            migrationBuilder.DropTable(
                name: "payslip_deductions",
                schema: "payroll");

            migrationBuilder.DropTable(
                name: "procedure_assignments",
                schema: "payroll");

            migrationBuilder.DropTable(
                name: "refresh_tokens",
                schema: "iam");

            migrationBuilder.DropTable(
                name: "staff_allowances",
                schema: "payroll");

            migrationBuilder.DropTable(
                name: "system_policies",
                schema: "iam");

            migrationBuilder.DropTable(
                name: "work_schedule_templates",
                schema: "attendance");

            migrationBuilder.DropTable(
                name: "attendance_imports",
                schema: "attendance");

            migrationBuilder.DropTable(
                name: "on_call_shifts",
                schema: "attendance");

            migrationBuilder.DropTable(
                name: "cme_cycles",
                schema: "compliance");

            migrationBuilder.DropTable(
                name: "complaints",
                schema: "payroll");

            migrationBuilder.DropTable(
                name: "commission_rules",
                schema: "payroll");

            migrationBuilder.DropTable(
                name: "procedure_slips",
                schema: "payroll");

            migrationBuilder.DropTable(
                name: "credentials",
                schema: "iam");

            migrationBuilder.DropTable(
                name: "allowance_types",
                schema: "payroll");

            migrationBuilder.DropTable(
                name: "certificates",
                schema: "compliance");

            migrationBuilder.DropTable(
                name: "payslips",
                schema: "payroll");

            migrationBuilder.DropTable(
                name: "procedure_services",
                schema: "payroll");

            migrationBuilder.DropTable(
                name: "users",
                schema: "iam");

            migrationBuilder.DropTable(
                name: "bank_exports",
                schema: "payroll");

            migrationBuilder.DropTable(
                name: "staff",
                schema: "hr");

            migrationBuilder.DropTable(
                name: "departments",
                schema: "hr");

            migrationBuilder.DropTable(
                name: "positions",
                schema: "hr");
        }
    }
}
