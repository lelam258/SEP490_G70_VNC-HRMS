using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Vnc.HRMS.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ClinicScheduleRegulations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_ScheduleAssignments_StaffId_Date_Shift",
                table: "ScheduleAssignments");

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "ActualEndAt",
                table: "ScheduleAssignments",
                type: "datetimeoffset",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "EndNote",
                table: "ScheduleAssignments",
                type: "nvarchar(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "EndRecordedAt",
                table: "ScheduleAssignments",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "EndRecordedBy",
                table: "ScheduleAssignments",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_ScheduleAssignments_StaffId_Date_Shift_CoverageId",
                table: "ScheduleAssignments",
                columns: new[] { "StaffId", "Date", "Shift", "CoverageId" },
                unique: true,
                filter: "[Cancelled] = 0");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_ScheduleAssignments_StaffId_Date_Shift_CoverageId",
                table: "ScheduleAssignments");

            migrationBuilder.DropColumn(
                name: "ActualEndAt",
                table: "ScheduleAssignments");

            migrationBuilder.DropColumn(
                name: "EndNote",
                table: "ScheduleAssignments");

            migrationBuilder.DropColumn(
                name: "EndRecordedAt",
                table: "ScheduleAssignments");

            migrationBuilder.DropColumn(
                name: "EndRecordedBy",
                table: "ScheduleAssignments");

            migrationBuilder.CreateIndex(
                name: "IX_ScheduleAssignments_StaffId_Date_Shift",
                table: "ScheduleAssignments",
                columns: new[] { "StaffId", "Date", "Shift" },
                unique: true,
                filter: "[Cancelled] = 0");
        }
    }
}
