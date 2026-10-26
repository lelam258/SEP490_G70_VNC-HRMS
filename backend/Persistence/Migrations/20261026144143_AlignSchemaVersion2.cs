using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Vnc.HRMS.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AlignSchemaVersion2 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_password_reset_tokens_credentials_user_id",
                schema: "iam",
                table: "password_reset_tokens");

            migrationBuilder.DropForeignKey(
                name: "FK_refresh_tokens_credentials_user_id",
                schema: "iam",
                table: "refresh_tokens");

            migrationBuilder.DropIndex(
                name: "IX_users_employee_id",
                schema: "iam",
                table: "users");

            migrationBuilder.DropIndex(
                name: "IX_staff_user_id",
                schema: "hr",
                table: "staff");

            migrationBuilder.EnsureSchema(
                name: "dbo");

            migrationBuilder.RenameTable(
                name: "work_schedule_templates",
                schema: "attendance",
                newName: "work_schedule_templates",
                newSchema: "dbo");

            migrationBuilder.RenameTable(
                name: "users",
                schema: "iam",
                newName: "users",
                newSchema: "dbo");

            migrationBuilder.RenameTable(
                name: "system_policies",
                schema: "iam",
                newName: "system_policies",
                newSchema: "dbo");

            migrationBuilder.RenameTable(
                name: "staff_allowances",
                schema: "payroll",
                newName: "staff_allowances",
                newSchema: "dbo");

            migrationBuilder.RenameTable(
                name: "staff",
                schema: "hr",
                newName: "staff",
                newSchema: "dbo");

            migrationBuilder.RenameTable(
                name: "refresh_tokens",
                schema: "iam",
                newName: "refresh_tokens",
                newSchema: "dbo");

            migrationBuilder.RenameTable(
                name: "procedure_slips",
                schema: "payroll",
                newName: "procedure_slips",
                newSchema: "dbo");

            migrationBuilder.RenameTable(
                name: "procedure_services",
                schema: "payroll",
                newName: "procedure_services",
                newSchema: "dbo");

            migrationBuilder.RenameTable(
                name: "procedure_assignments",
                schema: "payroll",
                newName: "procedure_assignments",
                newSchema: "dbo");

            migrationBuilder.RenameTable(
                name: "positions",
                schema: "hr",
                newName: "positions",
                newSchema: "dbo");

            migrationBuilder.RenameTable(
                name: "payslips",
                schema: "payroll",
                newName: "payslips",
                newSchema: "dbo");

            migrationBuilder.RenameTable(
                name: "payslip_deductions",
                schema: "payroll",
                newName: "payslip_deductions",
                newSchema: "dbo");

            migrationBuilder.RenameTable(
                name: "payslip_allowances",
                schema: "payroll",
                newName: "payslip_allowances",
                newSchema: "dbo");

            migrationBuilder.RenameTable(
                name: "payroll_tax_brackets",
                schema: "payroll",
                newName: "payroll_tax_brackets",
                newSchema: "dbo");

            migrationBuilder.RenameTable(
                name: "payroll_locks",
                schema: "payroll",
                newName: "payroll_locks",
                newSchema: "dbo");

            migrationBuilder.RenameTable(
                name: "payroll_insurance_configs",
                schema: "payroll",
                newName: "payroll_insurance_configs",
                newSchema: "dbo");

            migrationBuilder.RenameTable(
                name: "password_reset_tokens",
                schema: "iam",
                newName: "password_reset_tokens",
                newSchema: "dbo");

            migrationBuilder.RenameTable(
                name: "on_call_shifts",
                schema: "attendance",
                newName: "on_call_shifts",
                newSchema: "dbo");

            migrationBuilder.RenameTable(
                name: "notifications",
                schema: "notification",
                newName: "notifications",
                newSchema: "dbo");

            migrationBuilder.RenameTable(
                name: "monthly_timesheets",
                schema: "attendance",
                newName: "monthly_timesheets",
                newSchema: "dbo");

            migrationBuilder.RenameTable(
                name: "maternity_cases",
                schema: "payroll",
                newName: "maternity_cases",
                newSchema: "dbo");

            migrationBuilder.RenameTable(
                name: "leave_requests",
                schema: "attendance",
                newName: "leave_requests",
                newSchema: "dbo");

            migrationBuilder.RenameTable(
                name: "departments",
                schema: "hr",
                newName: "departments",
                newSchema: "dbo");

            migrationBuilder.RenameTable(
                name: "degrees",
                schema: "hr",
                newName: "degrees",
                newSchema: "dbo");

            migrationBuilder.RenameTable(
                name: "contracts",
                schema: "hr",
                newName: "contracts",
                newSchema: "dbo");

            migrationBuilder.RenameTable(
                name: "compliance_scans",
                schema: "compliance",
                newName: "compliance_scans",
                newSchema: "dbo");

            migrationBuilder.RenameTable(
                name: "complaints",
                schema: "payroll",
                newName: "complaints",
                newSchema: "dbo");

            migrationBuilder.RenameTable(
                name: "complaint_attachments",
                schema: "payroll",
                newName: "complaint_attachments",
                newSchema: "dbo");

            migrationBuilder.RenameTable(
                name: "commission_rules",
                schema: "payroll",
                newName: "commission_rules",
                newSchema: "dbo");

            migrationBuilder.RenameTable(
                name: "cme_records",
                schema: "compliance",
                newName: "cme_records",
                newSchema: "dbo");

            migrationBuilder.RenameTable(
                name: "cme_cycles",
                schema: "compliance",
                newName: "cme_cycles",
                newSchema: "dbo");

            migrationBuilder.RenameTable(
                name: "certificates",
                schema: "compliance",
                newName: "certificates",
                newSchema: "dbo");

            migrationBuilder.RenameTable(
                name: "bank_exports",
                schema: "payroll",
                newName: "bank_exports",
                newSchema: "dbo");

            migrationBuilder.RenameTable(
                name: "audit_logs",
                schema: "iam",
                newName: "audit_logs",
                newSchema: "dbo");

            migrationBuilder.RenameTable(
                name: "attendance_records",
                schema: "attendance",
                newName: "attendance_records",
                newSchema: "dbo");

            migrationBuilder.RenameTable(
                name: "attendance_imports",
                schema: "attendance",
                newName: "attendance_imports",
                newSchema: "dbo");

            migrationBuilder.RenameTable(
                name: "allowance_types",
                schema: "payroll",
                newName: "allowance_types",
                newSchema: "dbo");

            migrationBuilder.AddColumn<int>(
                name: "failed_login_count",
                schema: "dbo",
                table: "users",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTime>(
                name: "last_login",
                schema: "dbo",
                table: "users",
                type: "datetime2(0)",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "locked_until",
                schema: "dbo",
                table: "users",
                type: "datetime2(0)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "password_hash",
                schema: "dbo",
                table: "users",
                type: "nvarchar(255)",
                maxLength: 255,
                nullable: false,
                defaultValue: "");

            // Move identity data before removing the old credentials table or employee_id.
            // SQL and all DDL execute in EF's migration transaction.
            migrationBuilder.Sql("""
                IF EXISTS (SELECT 1 FROM dbo.users u LEFT JOIN iam.credentials c ON c.user_id=u.user_id
                           WHERE u.is_provisioned=1 AND c.user_id IS NULL)
                    THROW 51100, 'A provisioned account has no credential. Resolve before migrating.', 1;
                IF EXISTS (SELECT 1 FROM dbo.users u LEFT JOIN dbo.staff s ON s.staff_id=u.employee_id
                           WHERE u.employee_id IS NOT NULL AND s.staff_id IS NULL)
                    THROW 51101, 'An account references a missing staff profile.', 1;
                IF EXISTS (SELECT 1 FROM dbo.staff s LEFT JOIN dbo.users u ON u.user_id=s.user_id
                           WHERE s.user_id IS NOT NULL AND u.user_id IS NULL)
                    THROW 51102, 'A staff profile references a missing account.', 1;
                IF EXISTS (SELECT 1 FROM dbo.staff s JOIN dbo.users u ON u.employee_id=s.staff_id
                           WHERE s.user_id IS NOT NULL AND s.user_id<>u.user_id)
                    THROW 51103, 'Conflicting staff/account links. Migration cancelled.', 1;
                IF EXISTS (SELECT 1 FROM dbo.staff s JOIN dbo.users u ON u.user_id=s.user_id
                           WHERE u.employee_id IS NOT NULL AND u.employee_id<>s.staff_id)
                    THROW 51104, 'An account is linked to two staff profiles.', 1;

                UPDATE u SET password_hash=c.password_hash, failed_login_count=c.failed_login_count,
                    locked_until=c.locked_until, last_login=c.last_login
                FROM dbo.users u JOIN iam.credentials c ON c.user_id=u.user_id;
                IF EXISTS (SELECT 1 FROM iam.credentials c LEFT JOIN dbo.users u ON u.user_id=c.user_id
                           WHERE u.user_id IS NULL OR CONVERT(varbinary(max),u.password_hash)<>CONVERT(varbinary(max),c.password_hash))
                    THROW 51105, 'Password hash verification failed.', 1;

                UPDATE s SET user_id=u.user_id FROM dbo.staff s JOIN dbo.users u ON u.employee_id=s.staff_id;
                IF EXISTS (SELECT user_id FROM dbo.staff WHERE user_id IS NOT NULL GROUP BY user_id HAVING COUNT(*)>1)
                    THROW 51106, 'Duplicate staff/account links.', 1;
                IF EXISTS (SELECT 1 FROM dbo.staff s JOIN dbo.users u ON u.email=s.email WHERE s.user_id IS NULL AND s.email IS NOT NULL)
                    THROW 51107, 'Unlinked staff email conflicts with an existing account. Link it explicitly first.', 1;

                DECLARE @pending TABLE(staff_id uniqueidentifier PRIMARY KEY, user_id uniqueidentifier NOT NULL);
                INSERT INTO @pending SELECT staff_id,NEWID() FROM dbo.staff WHERE user_id IS NULL;
                INSERT INTO dbo.users(user_id,username,normalized_username,password_hash,email,full_name,role,account_status,
                    is_provisioned,security_version,failed_login_count,created_at,updated_at)
                SELECT p.user_id,'pending_'+REPLACE(CONVERT(nvarchar(36),p.user_id),'-',''),
                    UPPER('pending_'+REPLACE(CONVERT(nvarchar(36),p.user_id),'-','')),
                    '',s.email,s.full_name,'employee','inactive',0,0,0,SYSUTCDATETIME(),SYSUTCDATETIME()
                FROM @pending p JOIN dbo.staff s ON s.staff_id=p.staff_id;
                UPDATE s SET user_id=p.user_id FROM dbo.staff s JOIN @pending p ON p.staff_id=s.staff_id;
                """);

            migrationBuilder.DropColumn(
                name: "employee_id",
                schema: "dbo",
                table: "users");

            migrationBuilder.DropTable(
                name: "credentials",
                schema: "iam");

            migrationBuilder.AlterColumn<Guid>(
                name: "user_id",
                schema: "dbo",
                table: "staff",
                type: "uniqueidentifier",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier",
                oldNullable: true);

            migrationBuilder.AddColumn<string>(
                name: "device_enroll_id",
                schema: "dbo",
                table: "attendance_records",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_staff_user_id",
                schema: "dbo",
                table: "staff",
                column: "user_id",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_password_reset_tokens_users_user_id",
                schema: "dbo",
                table: "password_reset_tokens",
                column: "user_id",
                principalSchema: "dbo",
                principalTable: "users",
                principalColumn: "user_id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_refresh_tokens_users_user_id",
                schema: "dbo",
                table: "refresh_tokens",
                column: "user_id",
                principalSchema: "dbo",
                principalTable: "users",
                principalColumn: "user_id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_staff_users_user_id",
                schema: "dbo",
                table: "staff",
                column: "user_id",
                principalSchema: "dbo",
                principalTable: "users",
                principalColumn: "user_id",
                onDelete: ReferentialAction.Restrict);
            migrationBuilder.CreateIndex(
                name: "IX_staff_created_by",
                schema: "dbo",
                table: "staff",
                column: "created_by");

            migrationBuilder.CreateIndex(
                name: "IX_procedure_slips_department_id",
                schema: "dbo",
                table: "procedure_slips",
                column: "department_id");

            migrationBuilder.CreateIndex(
                name: "IX_procedure_assignments_staff_id",
                schema: "dbo",
                table: "procedure_assignments",
                column: "staff_id");

            migrationBuilder.CreateIndex(
                name: "IX_payslips_contract_id",
                schema: "dbo",
                table: "payslips",
                column: "contract_id");

            migrationBuilder.CreateIndex(
                name: "IX_on_call_shifts_department_id",
                schema: "dbo",
                table: "on_call_shifts",
                column: "department_id");

            migrationBuilder.CreateIndex(
                name: "IX_on_call_shifts_staff_id",
                schema: "dbo",
                table: "on_call_shifts",
                column: "staff_id");

            migrationBuilder.CreateIndex(
                name: "IX_monthly_timesheets_locked_by",
                schema: "dbo",
                table: "monthly_timesheets",
                column: "locked_by");

            migrationBuilder.CreateIndex(
                name: "IX_maternity_cases_leave_request_id",
                schema: "dbo",
                table: "maternity_cases",
                column: "leave_request_id");

            migrationBuilder.CreateIndex(
                name: "IX_maternity_cases_staff_id",
                schema: "dbo",
                table: "maternity_cases",
                column: "staff_id");

            migrationBuilder.CreateIndex(
                name: "IX_leave_requests_department_id",
                schema: "dbo",
                table: "leave_requests",
                column: "department_id");

            migrationBuilder.CreateIndex(
                name: "IX_leave_requests_staff_id",
                schema: "dbo",
                table: "leave_requests",
                column: "staff_id");

            migrationBuilder.CreateIndex(
                name: "IX_compliance_scans_staff_id",
                schema: "dbo",
                table: "compliance_scans",
                column: "staff_id");

            migrationBuilder.CreateIndex(
                name: "IX_complaints_staff_id",
                schema: "dbo",
                table: "complaints",
                column: "staff_id");

            migrationBuilder.CreateIndex(
                name: "IX_certificates_staff_id",
                schema: "dbo",
                table: "certificates",
                column: "staff_id");

            migrationBuilder.CreateIndex(
                name: "IX_bank_exports_exported_by",
                schema: "dbo",
                table: "bank_exports",
                column: "exported_by");

            migrationBuilder.CreateIndex(
                name: "IX_attendance_records_department_id",
                schema: "dbo",
                table: "attendance_records",
                column: "department_id");

            migrationBuilder.CreateIndex(
                name: "IX_attendance_imports_imported_by",
                schema: "dbo",
                table: "attendance_imports",
                column: "imported_by");

            migrationBuilder.AddForeignKey(
                name: "FK_attendance_imports_users_imported_by",
                schema: "dbo",
                table: "attendance_imports",
                column: "imported_by",
                principalSchema: "dbo",
                principalTable: "users",
                principalColumn: "user_id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_attendance_records_departments_department_id",
                schema: "dbo",
                table: "attendance_records",
                column: "department_id",
                principalSchema: "dbo",
                principalTable: "departments",
                principalColumn: "department_id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_attendance_records_staff_staff_id",
                schema: "dbo",
                table: "attendance_records",
                column: "staff_id",
                principalSchema: "dbo",
                principalTable: "staff",
                principalColumn: "staff_id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_bank_exports_users_exported_by",
                schema: "dbo",
                table: "bank_exports",
                column: "exported_by",
                principalSchema: "dbo",
                principalTable: "users",
                principalColumn: "user_id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_certificates_staff_staff_id",
                schema: "dbo",
                table: "certificates",
                column: "staff_id",
                principalSchema: "dbo",
                principalTable: "staff",
                principalColumn: "staff_id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_complaints_staff_staff_id",
                schema: "dbo",
                table: "complaints",
                column: "staff_id",
                principalSchema: "dbo",
                principalTable: "staff",
                principalColumn: "staff_id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_compliance_scans_staff_staff_id",
                schema: "dbo",
                table: "compliance_scans",
                column: "staff_id",
                principalSchema: "dbo",
                principalTable: "staff",
                principalColumn: "staff_id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_leave_requests_departments_department_id",
                schema: "dbo",
                table: "leave_requests",
                column: "department_id",
                principalSchema: "dbo",
                principalTable: "departments",
                principalColumn: "department_id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_leave_requests_staff_staff_id",
                schema: "dbo",
                table: "leave_requests",
                column: "staff_id",
                principalSchema: "dbo",
                principalTable: "staff",
                principalColumn: "staff_id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_maternity_cases_leave_requests_leave_request_id",
                schema: "dbo",
                table: "maternity_cases",
                column: "leave_request_id",
                principalSchema: "dbo",
                principalTable: "leave_requests",
                principalColumn: "request_id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_maternity_cases_staff_staff_id",
                schema: "dbo",
                table: "maternity_cases",
                column: "staff_id",
                principalSchema: "dbo",
                principalTable: "staff",
                principalColumn: "staff_id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_monthly_timesheets_users_locked_by",
                schema: "dbo",
                table: "monthly_timesheets",
                column: "locked_by",
                principalSchema: "dbo",
                principalTable: "users",
                principalColumn: "user_id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_notifications_users_recipient_id",
                schema: "dbo",
                table: "notifications",
                column: "recipient_id",
                principalSchema: "dbo",
                principalTable: "users",
                principalColumn: "user_id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_on_call_shifts_departments_department_id",
                schema: "dbo",
                table: "on_call_shifts",
                column: "department_id",
                principalSchema: "dbo",
                principalTable: "departments",
                principalColumn: "department_id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_on_call_shifts_staff_staff_id",
                schema: "dbo",
                table: "on_call_shifts",
                column: "staff_id",
                principalSchema: "dbo",
                principalTable: "staff",
                principalColumn: "staff_id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_payslips_contracts_contract_id",
                schema: "dbo",
                table: "payslips",
                column: "contract_id",
                principalSchema: "dbo",
                principalTable: "contracts",
                principalColumn: "contract_id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_payslips_staff_staff_id",
                schema: "dbo",
                table: "payslips",
                column: "staff_id",
                principalSchema: "dbo",
                principalTable: "staff",
                principalColumn: "staff_id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_procedure_assignments_staff_staff_id",
                schema: "dbo",
                table: "procedure_assignments",
                column: "staff_id",
                principalSchema: "dbo",
                principalTable: "staff",
                principalColumn: "staff_id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_procedure_slips_departments_department_id",
                schema: "dbo",
                table: "procedure_slips",
                column: "department_id",
                principalSchema: "dbo",
                principalTable: "departments",
                principalColumn: "department_id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_staff_users_created_by",
                schema: "dbo",
                table: "staff",
                column: "created_by",
                principalSchema: "dbo",
                principalTable: "users",
                principalColumn: "user_id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_staff_allowances_staff_staff_id",
                schema: "dbo",
                table: "staff_allowances",
                column: "staff_id",
                principalSchema: "dbo",
                principalTable: "staff",
                principalColumn: "staff_id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_attendance_imports_users_imported_by",
                schema: "dbo",
                table: "attendance_imports");

            migrationBuilder.DropForeignKey(
                name: "FK_attendance_records_departments_department_id",
                schema: "dbo",
                table: "attendance_records");

            migrationBuilder.DropForeignKey(
                name: "FK_attendance_records_staff_staff_id",
                schema: "dbo",
                table: "attendance_records");

            migrationBuilder.DropForeignKey(
                name: "FK_bank_exports_users_exported_by",
                schema: "dbo",
                table: "bank_exports");

            migrationBuilder.DropForeignKey(
                name: "FK_certificates_staff_staff_id",
                schema: "dbo",
                table: "certificates");

            migrationBuilder.DropForeignKey(
                name: "FK_complaints_staff_staff_id",
                schema: "dbo",
                table: "complaints");

            migrationBuilder.DropForeignKey(
                name: "FK_compliance_scans_staff_staff_id",
                schema: "dbo",
                table: "compliance_scans");

            migrationBuilder.DropForeignKey(
                name: "FK_leave_requests_departments_department_id",
                schema: "dbo",
                table: "leave_requests");

            migrationBuilder.DropForeignKey(
                name: "FK_leave_requests_staff_staff_id",
                schema: "dbo",
                table: "leave_requests");

            migrationBuilder.DropForeignKey(
                name: "FK_maternity_cases_leave_requests_leave_request_id",
                schema: "dbo",
                table: "maternity_cases");

            migrationBuilder.DropForeignKey(
                name: "FK_maternity_cases_staff_staff_id",
                schema: "dbo",
                table: "maternity_cases");

            migrationBuilder.DropForeignKey(
                name: "FK_monthly_timesheets_users_locked_by",
                schema: "dbo",
                table: "monthly_timesheets");

            migrationBuilder.DropForeignKey(
                name: "FK_notifications_users_recipient_id",
                schema: "dbo",
                table: "notifications");

            migrationBuilder.DropForeignKey(
                name: "FK_on_call_shifts_departments_department_id",
                schema: "dbo",
                table: "on_call_shifts");

            migrationBuilder.DropForeignKey(
                name: "FK_on_call_shifts_staff_staff_id",
                schema: "dbo",
                table: "on_call_shifts");

            migrationBuilder.DropForeignKey(
                name: "FK_payslips_contracts_contract_id",
                schema: "dbo",
                table: "payslips");

            migrationBuilder.DropForeignKey(
                name: "FK_payslips_staff_staff_id",
                schema: "dbo",
                table: "payslips");

            migrationBuilder.DropForeignKey(
                name: "FK_procedure_assignments_staff_staff_id",
                schema: "dbo",
                table: "procedure_assignments");

            migrationBuilder.DropForeignKey(
                name: "FK_procedure_slips_departments_department_id",
                schema: "dbo",
                table: "procedure_slips");

            migrationBuilder.DropForeignKey(
                name: "FK_staff_users_created_by",
                schema: "dbo",
                table: "staff");

            migrationBuilder.DropForeignKey(
                name: "FK_staff_allowances_staff_staff_id",
                schema: "dbo",
                table: "staff_allowances");

            migrationBuilder.DropIndex(
                name: "IX_staff_created_by",
                schema: "dbo",
                table: "staff");

            migrationBuilder.DropIndex(
                name: "IX_procedure_slips_department_id",
                schema: "dbo",
                table: "procedure_slips");

            migrationBuilder.DropIndex(
                name: "IX_procedure_assignments_staff_id",
                schema: "dbo",
                table: "procedure_assignments");

            migrationBuilder.DropIndex(
                name: "IX_payslips_contract_id",
                schema: "dbo",
                table: "payslips");

            migrationBuilder.DropIndex(
                name: "IX_on_call_shifts_department_id",
                schema: "dbo",
                table: "on_call_shifts");

            migrationBuilder.DropIndex(
                name: "IX_on_call_shifts_staff_id",
                schema: "dbo",
                table: "on_call_shifts");

            migrationBuilder.DropIndex(
                name: "IX_monthly_timesheets_locked_by",
                schema: "dbo",
                table: "monthly_timesheets");

            migrationBuilder.DropIndex(
                name: "IX_maternity_cases_leave_request_id",
                schema: "dbo",
                table: "maternity_cases");

            migrationBuilder.DropIndex(
                name: "IX_maternity_cases_staff_id",
                schema: "dbo",
                table: "maternity_cases");

            migrationBuilder.DropIndex(
                name: "IX_leave_requests_department_id",
                schema: "dbo",
                table: "leave_requests");

            migrationBuilder.DropIndex(
                name: "IX_leave_requests_staff_id",
                schema: "dbo",
                table: "leave_requests");

            migrationBuilder.DropIndex(
                name: "IX_compliance_scans_staff_id",
                schema: "dbo",
                table: "compliance_scans");

            migrationBuilder.DropIndex(
                name: "IX_complaints_staff_id",
                schema: "dbo",
                table: "complaints");

            migrationBuilder.DropIndex(
                name: "IX_certificates_staff_id",
                schema: "dbo",
                table: "certificates");

            migrationBuilder.DropIndex(
                name: "IX_bank_exports_exported_by",
                schema: "dbo",
                table: "bank_exports");

            migrationBuilder.DropIndex(
                name: "IX_attendance_records_department_id",
                schema: "dbo",
                table: "attendance_records");

            migrationBuilder.DropIndex(
                name: "IX_attendance_imports_imported_by",
                schema: "dbo",
                table: "attendance_imports");
            migrationBuilder.DropForeignKey(
                name: "FK_password_reset_tokens_users_user_id",
                schema: "dbo",
                table: "password_reset_tokens");

            migrationBuilder.DropForeignKey(
                name: "FK_refresh_tokens_users_user_id",
                schema: "dbo",
                table: "refresh_tokens");

            migrationBuilder.DropForeignKey(
                name: "FK_staff_users_user_id",
                schema: "dbo",
                table: "staff");

            migrationBuilder.DropIndex(
                name: "IX_staff_user_id",
                schema: "dbo",
                table: "staff");

            migrationBuilder.DropColumn(
                name: "device_enroll_id",
                schema: "dbo",
                table: "attendance_records");

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

            migrationBuilder.RenameTable(
                name: "work_schedule_templates",
                schema: "dbo",
                newName: "work_schedule_templates",
                newSchema: "attendance");

            migrationBuilder.RenameTable(
                name: "users",
                schema: "dbo",
                newName: "users",
                newSchema: "iam");

            migrationBuilder.RenameTable(
                name: "system_policies",
                schema: "dbo",
                newName: "system_policies",
                newSchema: "iam");

            migrationBuilder.RenameTable(
                name: "staff_allowances",
                schema: "dbo",
                newName: "staff_allowances",
                newSchema: "payroll");

            migrationBuilder.RenameTable(
                name: "staff",
                schema: "dbo",
                newName: "staff",
                newSchema: "hr");

            migrationBuilder.RenameTable(
                name: "refresh_tokens",
                schema: "dbo",
                newName: "refresh_tokens",
                newSchema: "iam");

            migrationBuilder.RenameTable(
                name: "procedure_slips",
                schema: "dbo",
                newName: "procedure_slips",
                newSchema: "payroll");

            migrationBuilder.RenameTable(
                name: "procedure_services",
                schema: "dbo",
                newName: "procedure_services",
                newSchema: "payroll");

            migrationBuilder.RenameTable(
                name: "procedure_assignments",
                schema: "dbo",
                newName: "procedure_assignments",
                newSchema: "payroll");

            migrationBuilder.RenameTable(
                name: "positions",
                schema: "dbo",
                newName: "positions",
                newSchema: "hr");

            migrationBuilder.RenameTable(
                name: "payslips",
                schema: "dbo",
                newName: "payslips",
                newSchema: "payroll");

            migrationBuilder.RenameTable(
                name: "payslip_deductions",
                schema: "dbo",
                newName: "payslip_deductions",
                newSchema: "payroll");

            migrationBuilder.RenameTable(
                name: "payslip_allowances",
                schema: "dbo",
                newName: "payslip_allowances",
                newSchema: "payroll");

            migrationBuilder.RenameTable(
                name: "payroll_tax_brackets",
                schema: "dbo",
                newName: "payroll_tax_brackets",
                newSchema: "payroll");

            migrationBuilder.RenameTable(
                name: "payroll_locks",
                schema: "dbo",
                newName: "payroll_locks",
                newSchema: "payroll");

            migrationBuilder.RenameTable(
                name: "payroll_insurance_configs",
                schema: "dbo",
                newName: "payroll_insurance_configs",
                newSchema: "payroll");

            migrationBuilder.RenameTable(
                name: "password_reset_tokens",
                schema: "dbo",
                newName: "password_reset_tokens",
                newSchema: "iam");

            migrationBuilder.RenameTable(
                name: "on_call_shifts",
                schema: "dbo",
                newName: "on_call_shifts",
                newSchema: "attendance");

            migrationBuilder.RenameTable(
                name: "notifications",
                schema: "dbo",
                newName: "notifications",
                newSchema: "notification");

            migrationBuilder.RenameTable(
                name: "monthly_timesheets",
                schema: "dbo",
                newName: "monthly_timesheets",
                newSchema: "attendance");

            migrationBuilder.RenameTable(
                name: "maternity_cases",
                schema: "dbo",
                newName: "maternity_cases",
                newSchema: "payroll");

            migrationBuilder.RenameTable(
                name: "leave_requests",
                schema: "dbo",
                newName: "leave_requests",
                newSchema: "attendance");

            migrationBuilder.RenameTable(
                name: "departments",
                schema: "dbo",
                newName: "departments",
                newSchema: "hr");

            migrationBuilder.RenameTable(
                name: "degrees",
                schema: "dbo",
                newName: "degrees",
                newSchema: "hr");

            migrationBuilder.RenameTable(
                name: "contracts",
                schema: "dbo",
                newName: "contracts",
                newSchema: "hr");

            migrationBuilder.RenameTable(
                name: "compliance_scans",
                schema: "dbo",
                newName: "compliance_scans",
                newSchema: "compliance");

            migrationBuilder.RenameTable(
                name: "complaints",
                schema: "dbo",
                newName: "complaints",
                newSchema: "payroll");

            migrationBuilder.RenameTable(
                name: "complaint_attachments",
                schema: "dbo",
                newName: "complaint_attachments",
                newSchema: "payroll");

            migrationBuilder.RenameTable(
                name: "commission_rules",
                schema: "dbo",
                newName: "commission_rules",
                newSchema: "payroll");

            migrationBuilder.RenameTable(
                name: "cme_records",
                schema: "dbo",
                newName: "cme_records",
                newSchema: "compliance");

            migrationBuilder.RenameTable(
                name: "cme_cycles",
                schema: "dbo",
                newName: "cme_cycles",
                newSchema: "compliance");

            migrationBuilder.RenameTable(
                name: "certificates",
                schema: "dbo",
                newName: "certificates",
                newSchema: "compliance");

            migrationBuilder.RenameTable(
                name: "bank_exports",
                schema: "dbo",
                newName: "bank_exports",
                newSchema: "payroll");

            migrationBuilder.RenameTable(
                name: "audit_logs",
                schema: "dbo",
                newName: "audit_logs",
                newSchema: "iam");

            migrationBuilder.RenameTable(
                name: "attendance_records",
                schema: "dbo",
                newName: "attendance_records",
                newSchema: "attendance");

            migrationBuilder.RenameTable(
                name: "attendance_imports",
                schema: "dbo",
                newName: "attendance_imports",
                newSchema: "attendance");

            migrationBuilder.RenameTable(
                name: "allowance_types",
                schema: "dbo",
                newName: "allowance_types",
                newSchema: "payroll");

            migrationBuilder.AddColumn<Guid>(
                name: "employee_id",
                schema: "iam",
                table: "users",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "user_id",
                schema: "hr",
                table: "staff",
                type: "uniqueidentifier",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier");

            migrationBuilder.CreateTable(
                name: "credentials",
                schema: "iam",
                columns: table => new
                {
                    user_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    created_at = table.Column<DateTime>(type: "datetime2(0)", nullable: false, defaultValueSql: "SYSUTCDATETIME()"),
                    failed_login_count = table.Column<int>(type: "int", nullable: false),
                    last_login = table.Column<DateTime>(type: "datetime2(0)", nullable: true),
                    locked_until = table.Column<DateTime>(type: "datetime2(0)", nullable: true),
                    password_hash = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    updated_at = table.Column<DateTime>(type: "datetime2(0)", nullable: false, defaultValueSql: "SYSUTCDATETIME()"),
                    version = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
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

            migrationBuilder.CreateIndex(
                name: "IX_users_employee_id",
                schema: "iam",
                table: "users",
                column: "employee_id",
                unique: true,
                filter: "[employee_id] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_staff_user_id",
                schema: "hr",
                table: "staff",
                column: "user_id",
                unique: true,
                filter: "[user_id] IS NOT NULL");

            migrationBuilder.Sql("""
                INSERT INTO iam.credentials(user_id,password_hash,failed_login_count,locked_until,last_login,created_at,updated_at)
                SELECT user_id,password_hash,failed_login_count,locked_until,last_login,created_at,updated_at FROM iam.users;
                UPDATE u SET employee_id=s.staff_id FROM iam.users u JOIN hr.staff s ON s.user_id=u.user_id;
                """);

            migrationBuilder.DropColumn(
                name: "failed_login_count",
                schema: "iam",
                table: "users");

            migrationBuilder.DropColumn(
                name: "last_login",
                schema: "iam",
                table: "users");

            migrationBuilder.DropColumn(
                name: "locked_until",
                schema: "iam",
                table: "users");

            migrationBuilder.DropColumn(
                name: "password_hash",
                schema: "iam",
                table: "users");

            migrationBuilder.AddForeignKey(
                name: "FK_password_reset_tokens_credentials_user_id",
                schema: "iam",
                table: "password_reset_tokens",
                column: "user_id",
                principalSchema: "iam",
                principalTable: "credentials",
                principalColumn: "user_id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_refresh_tokens_credentials_user_id",
                schema: "iam",
                table: "refresh_tokens",
                column: "user_id",
                principalSchema: "iam",
                principalTable: "credentials",
                principalColumn: "user_id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
