using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Vnc.HRMS.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AttendanceAndAccountWorkflows : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "AttendanceEvidenceId",
                schema: "dbo",
                table: "on_call_shifts",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DeviationReason",
                schema: "dbo",
                table: "on_call_shifts",
                type: "nvarchar(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "FacilityId",
                schema: "dbo",
                table: "on_call_shifts",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ReviewNote",
                schema: "dbo",
                table: "on_call_shifts",
                type: "nvarchar(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ScheduleAssignmentId",
                schema: "dbo",
                table: "on_call_shifts",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SupervisorEvidence",
                schema: "dbo",
                table: "on_call_shifts",
                type: "nvarchar(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "UpdatedAt",
                schema: "dbo",
                table: "on_call_shifts",
                type: "datetime2",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<byte[]>(
                name: "Version",
                schema: "dbo",
                table: "on_call_shifts",
                type: "rowversion",
                rowVersion: true,
                nullable: false,
                defaultValue: new byte[0]);

            migrationBuilder.AddColumn<Guid>(
                name: "DepartmentId",
                schema: "dbo",
                table: "audit_logs",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "FacilityId",
                schema: "dbo",
                table: "audit_logs",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Module",
                schema: "dbo",
                table: "audit_logs",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "system");

            migrationBuilder.AddColumn<string>(
                name: "Result",
                schema: "dbo",
                table: "audit_logs",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "success");

            migrationBuilder.AddColumn<Guid>(
                name: "StaffId",
                schema: "dbo",
                table: "audit_logs",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "WorkDate",
                schema: "dbo",
                table: "audit_logs",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "FacilityId",
                schema: "dbo",
                table: "attendance_records",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TimePairsJson",
                schema: "dbo",
                table: "attendance_records",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ContentHash",
                schema: "dbo",
                table: "attendance_imports",
                type: "nvarchar(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DeviceSource",
                schema: "dbo",
                table: "attendance_imports",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "FacilityId",
                schema: "dbo",
                table: "attendance_imports",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<byte[]>(
                name: "OriginalFile",
                schema: "dbo",
                table: "attendance_imports",
                type: "varbinary(max)",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "attendance_import_rows",
                schema: "dbo",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ImportId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SheetName = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    RowNumber = table.Column<int>(type: "int", nullable: false),
                    EmployeeBlock = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    DeviceEnrollId = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    StaffId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    RawDate = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    RawValuesJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    WorkDate = table.Column<DateOnly>(type: "date", nullable: true),
                    ShiftType = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    TimePairsJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    ReportedHours = table.Column<decimal>(type: "decimal(10,2)", precision: 10, scale: 2, nullable: true),
                    ActualHours = table.Column<decimal>(type: "decimal(10,2)", precision: 10, scale: 2, nullable: true),
                    LateMinutes = table.Column<decimal>(type: "decimal(10,2)", precision: 10, scale: 2, nullable: true),
                    EarlyMinutes = table.Column<decimal>(type: "decimal(10,2)", precision: 10, scale: 2, nullable: true),
                    AttendanceSymbol = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    ValidationStatus = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    ErrorCode = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    ValidationNote = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    AttendanceId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    CorrectionReason = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    CorrectedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    CorrectedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Version = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_attendance_import_rows", x => x.Id);
                    table.ForeignKey(
                        name: "FK_attendance_import_rows_attendance_imports_ImportId",
                        column: x => x.ImportId,
                        principalSchema: "dbo",
                        principalTable: "attendance_imports",
                        principalColumn: "import_id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_attendance_import_rows_attendance_records_AttendanceId",
                        column: x => x.AttendanceId,
                        principalSchema: "dbo",
                        principalTable: "attendance_records",
                        principalColumn: "attendance_id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_on_call_shifts_AttendanceEvidenceId",
                schema: "dbo",
                table: "on_call_shifts",
                column: "AttendanceEvidenceId");

            migrationBuilder.CreateIndex(
                name: "IX_on_call_shifts_FacilityId",
                schema: "dbo",
                table: "on_call_shifts",
                column: "FacilityId");

            migrationBuilder.CreateIndex(
                name: "IX_on_call_shifts_ScheduleAssignmentId",
                schema: "dbo",
                table: "on_call_shifts",
                column: "ScheduleAssignmentId");

            migrationBuilder.CreateIndex(
                name: "IX_audit_logs_Module_created_at",
                schema: "dbo",
                table: "audit_logs",
                columns: new[] { "Module", "created_at" });

            migrationBuilder.CreateIndex(
                name: "IX_attendance_records_FacilityId",
                schema: "dbo",
                table: "attendance_records",
                column: "FacilityId");

            migrationBuilder.CreateIndex(
                name: "IX_attendance_imports_FacilityId_pay_month_ContentHash",
                schema: "dbo",
                table: "attendance_imports",
                columns: new[] { "FacilityId", "pay_month", "ContentHash" });

            migrationBuilder.CreateIndex(
                name: "IX_attendance_import_rows_AttendanceId",
                schema: "dbo",
                table: "attendance_import_rows",
                column: "AttendanceId");

            migrationBuilder.CreateIndex(
                name: "IX_attendance_import_rows_ImportId_SheetName_RowNumber_ShiftType",
                schema: "dbo",
                table: "attendance_import_rows",
                columns: new[] { "ImportId", "SheetName", "RowNumber", "ShiftType" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_attendance_imports_ScheduleFacilities_FacilityId",
                schema: "dbo",
                table: "attendance_imports",
                column: "FacilityId",
                principalTable: "ScheduleFacilities",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_attendance_records_ScheduleFacilities_FacilityId",
                schema: "dbo",
                table: "attendance_records",
                column: "FacilityId",
                principalTable: "ScheduleFacilities",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_on_call_shifts_ScheduleAssignments_ScheduleAssignmentId",
                schema: "dbo",
                table: "on_call_shifts",
                column: "ScheduleAssignmentId",
                principalTable: "ScheduleAssignments",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_on_call_shifts_ScheduleFacilities_FacilityId",
                schema: "dbo",
                table: "on_call_shifts",
                column: "FacilityId",
                principalTable: "ScheduleFacilities",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_on_call_shifts_attendance_records_AttendanceEvidenceId",
                schema: "dbo",
                table: "on_call_shifts",
                column: "AttendanceEvidenceId",
                principalSchema: "dbo",
                principalTable: "attendance_records",
                principalColumn: "attendance_id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.Sql("""
                UPDATE [dbo].[on_call_shifts]
                SET [UpdatedAt] = COALESCE([created_at], SYSUTCDATETIME());

                UPDATE a SET
                    [Module] = CASE
                        WHEN [entity_type] IN (N'User', N'Account') THEN N'accounts'
                        WHEN [entity_type] IN (N'AttendanceRecord', N'AttendanceImport') THEN N'attendance'
                        WHEN [entity_type] = N'OnCallShift' THEN N'on_call'
                        WHEN [entity_type] IN (N'ScheduleWeek', N'ScheduleAssignment') THEN N'schedules'
                        WHEN [entity_type] IN (N'PayrollLock', N'MonthlyTimesheet') THEN N'payroll'
                        ELSE N'system' END,
                    [StaffId] = TRY_CONVERT(uniqueidentifier, COALESCE(JSON_VALUE(p.value, '$.staffId'), JSON_VALUE(p.value, '$.employeeId'))),
                    [DepartmentId] = TRY_CONVERT(uniqueidentifier, JSON_VALUE(p.value, '$.departmentId')),
                    [FacilityId] = TRY_CONVERT(uniqueidentifier, JSON_VALUE(p.value, '$.facilityId')),
                    [WorkDate] = TRY_CONVERT(date, COALESCE(JSON_VALUE(p.value, '$.workDate'), JSON_VALUE(p.value, '$.shiftDate'),
                        JSON_VALUE(p.value, '$.date'), NULLIF(JSON_VALUE(p.value, '$.payMonth'), '') + '-01'))
                FROM [dbo].[audit_logs] a
                CROSS APPLY (SELECT CASE WHEN ISJSON(a.[new_value]) = 1 THEN a.[new_value]
                    WHEN ISJSON(a.[old_value]) = 1 THEN a.[old_value] ELSE N'{}' END AS value) p;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_attendance_imports_ScheduleFacilities_FacilityId",
                schema: "dbo",
                table: "attendance_imports");

            migrationBuilder.DropForeignKey(
                name: "FK_attendance_records_ScheduleFacilities_FacilityId",
                schema: "dbo",
                table: "attendance_records");

            migrationBuilder.DropForeignKey(
                name: "FK_on_call_shifts_ScheduleAssignments_ScheduleAssignmentId",
                schema: "dbo",
                table: "on_call_shifts");

            migrationBuilder.DropForeignKey(
                name: "FK_on_call_shifts_ScheduleFacilities_FacilityId",
                schema: "dbo",
                table: "on_call_shifts");

            migrationBuilder.DropForeignKey(
                name: "FK_on_call_shifts_attendance_records_AttendanceEvidenceId",
                schema: "dbo",
                table: "on_call_shifts");

            migrationBuilder.DropTable(
                name: "attendance_import_rows",
                schema: "dbo");

            migrationBuilder.DropIndex(
                name: "IX_on_call_shifts_AttendanceEvidenceId",
                schema: "dbo",
                table: "on_call_shifts");

            migrationBuilder.DropIndex(
                name: "IX_on_call_shifts_FacilityId",
                schema: "dbo",
                table: "on_call_shifts");

            migrationBuilder.DropIndex(
                name: "IX_on_call_shifts_ScheduleAssignmentId",
                schema: "dbo",
                table: "on_call_shifts");

            migrationBuilder.DropIndex(
                name: "IX_audit_logs_Module_created_at",
                schema: "dbo",
                table: "audit_logs");

            migrationBuilder.DropIndex(
                name: "IX_attendance_records_FacilityId",
                schema: "dbo",
                table: "attendance_records");

            migrationBuilder.DropIndex(
                name: "IX_attendance_imports_FacilityId_pay_month_ContentHash",
                schema: "dbo",
                table: "attendance_imports");

            migrationBuilder.DropColumn(
                name: "AttendanceEvidenceId",
                schema: "dbo",
                table: "on_call_shifts");

            migrationBuilder.DropColumn(
                name: "DeviationReason",
                schema: "dbo",
                table: "on_call_shifts");

            migrationBuilder.DropColumn(
                name: "FacilityId",
                schema: "dbo",
                table: "on_call_shifts");

            migrationBuilder.DropColumn(
                name: "ReviewNote",
                schema: "dbo",
                table: "on_call_shifts");

            migrationBuilder.DropColumn(
                name: "ScheduleAssignmentId",
                schema: "dbo",
                table: "on_call_shifts");

            migrationBuilder.DropColumn(
                name: "SupervisorEvidence",
                schema: "dbo",
                table: "on_call_shifts");

            migrationBuilder.DropColumn(
                name: "UpdatedAt",
                schema: "dbo",
                table: "on_call_shifts");

            migrationBuilder.DropColumn(
                name: "Version",
                schema: "dbo",
                table: "on_call_shifts");

            migrationBuilder.DropColumn(
                name: "DepartmentId",
                schema: "dbo",
                table: "audit_logs");

            migrationBuilder.DropColumn(
                name: "FacilityId",
                schema: "dbo",
                table: "audit_logs");

            migrationBuilder.DropColumn(
                name: "Module",
                schema: "dbo",
                table: "audit_logs");

            migrationBuilder.DropColumn(
                name: "Result",
                schema: "dbo",
                table: "audit_logs");

            migrationBuilder.DropColumn(
                name: "StaffId",
                schema: "dbo",
                table: "audit_logs");

            migrationBuilder.DropColumn(
                name: "WorkDate",
                schema: "dbo",
                table: "audit_logs");

            migrationBuilder.DropColumn(
                name: "FacilityId",
                schema: "dbo",
                table: "attendance_records");

            migrationBuilder.DropColumn(
                name: "TimePairsJson",
                schema: "dbo",
                table: "attendance_records");

            migrationBuilder.DropColumn(
                name: "ContentHash",
                schema: "dbo",
                table: "attendance_imports");

            migrationBuilder.DropColumn(
                name: "DeviceSource",
                schema: "dbo",
                table: "attendance_imports");

            migrationBuilder.DropColumn(
                name: "FacilityId",
                schema: "dbo",
                table: "attendance_imports");

            migrationBuilder.DropColumn(
                name: "OriginalFile",
                schema: "dbo",
                table: "attendance_imports");
        }
    }
}
