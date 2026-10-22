using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Vnc.HRMS.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class InitialMicroservice : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "payroll");

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
                    insurance_eligible = table.Column<bool>(type: "bit", nullable: false, defaultValueSql: "0"),
                    contribution_months = table.Column<int>(type: "int", nullable: true),
                    average_insurance_salary = table.Column<decimal>(type: "decimal(15,2)", nullable: true),
                    benefit_amount = table.Column<decimal>(type: "decimal(15,2)", nullable: false, defaultValueSql: "0"),
                    additional_benefit_amount = table.Column<decimal>(type: "decimal(15,2)", nullable: false, defaultValueSql: "0"),
                    total_benefit_amount = table.Column<decimal>(type: "decimal(18,2)", nullable: false, computedColumnSql: "[benefit_amount] + [additional_benefit_amount]", stored: true),
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

            migrationBuilder.CreateIndex(
                name: "IX_allowance_types_code",
                schema: "payroll",
                table: "allowance_types",
                column: "code",
                unique: true);

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
                name: "IX_staff_allowances_allowance_id",
                schema: "payroll",
                table: "staff_allowances",
                column: "allowance_id");

            migrationBuilder.CreateIndex(
                name: "IX_staff_allowances_staff_effective",
                schema: "payroll",
                table: "staff_allowances",
                columns: new[] { "staff_id", "status", "effective_from", "effective_to" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "complaint_attachments",
                schema: "payroll");

            migrationBuilder.DropTable(
                name: "maternity_cases",
                schema: "payroll");

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
                name: "staff_allowances",
                schema: "payroll");

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
                name: "allowance_types",
                schema: "payroll");

            migrationBuilder.DropTable(
                name: "payslips",
                schema: "payroll");

            migrationBuilder.DropTable(
                name: "procedure_services",
                schema: "payroll");

            migrationBuilder.DropTable(
                name: "bank_exports",
                schema: "payroll");
        }
    }
}
