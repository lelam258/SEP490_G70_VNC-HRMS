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
                name: "attendance");

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
                name: "IX_monthly_timesheets_pay_month",
                schema: "attendance",
                table: "monthly_timesheets",
                column: "pay_month",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "attendance_records",
                schema: "attendance");

            migrationBuilder.DropTable(
                name: "leave_requests",
                schema: "attendance");

            migrationBuilder.DropTable(
                name: "monthly_timesheets",
                schema: "attendance");

            migrationBuilder.DropTable(
                name: "work_schedule_templates",
                schema: "attendance");

            migrationBuilder.DropTable(
                name: "attendance_imports",
                schema: "attendance");

            migrationBuilder.DropTable(
                name: "on_call_shifts",
                schema: "attendance");
        }
    }
}
