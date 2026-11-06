using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Vnc.HRMS.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class WeeklyWorkSchedules : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ScheduleFacilities",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ScheduleFacilities", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ScheduleWeeks",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    DepartmentId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Monday = table.Column<DateOnly>(type: "date", nullable: false),
                    Published = table.Column<bool>(type: "bit", nullable: false),
                    Version = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ScheduleWeeks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ScheduleWeeks_departments_DepartmentId",
                        column: x => x.DepartmentId,
                        principalSchema: "dbo",
                        principalTable: "departments",
                        principalColumn: "department_id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ScheduleCoverage",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    FacilityId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    DepartmentId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ScheduleCoverage", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ScheduleCoverage_ScheduleFacilities_FacilityId",
                        column: x => x.FacilityId,
                        principalTable: "ScheduleFacilities",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ScheduleCoverage_departments_DepartmentId",
                        column: x => x.DepartmentId,
                        principalSchema: "dbo",
                        principalTable: "departments",
                        principalColumn: "department_id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ScheduleChanges",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    WeekId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ActorId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    At = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Detail = table.Column<string>(type: "nvarchar(4000)", maxLength: 4000, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ScheduleChanges", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ScheduleChanges_ScheduleWeeks_WeekId",
                        column: x => x.WeekId,
                        principalTable: "ScheduleWeeks",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ScheduleAssignments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    WeekId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    StaffId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CoverageId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Date = table.Column<DateOnly>(type: "date", nullable: false),
                    Shift = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Cancelled = table.Column<bool>(type: "bit", nullable: false),
                    Reason = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    TransferConsent = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    PatientConfirmed = table.Column<bool>(type: "bit", nullable: false),
                    PatientEvidence = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    ConfirmedBy = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    ConfirmedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ScheduleAssignments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ScheduleAssignments_ScheduleCoverage_CoverageId",
                        column: x => x.CoverageId,
                        principalTable: "ScheduleCoverage",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ScheduleAssignments_ScheduleWeeks_WeekId",
                        column: x => x.WeekId,
                        principalTable: "ScheduleWeeks",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ScheduleAssignments_staff_StaffId",
                        column: x => x.StaffId,
                        principalSchema: "dbo",
                        principalTable: "staff",
                        principalColumn: "staff_id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ScheduleAssignments_CoverageId",
                table: "ScheduleAssignments",
                column: "CoverageId");

            migrationBuilder.CreateIndex(
                name: "IX_ScheduleAssignments_StaffId_Date_Shift",
                table: "ScheduleAssignments",
                columns: new[] { "StaffId", "Date", "Shift" },
                unique: true,
                filter: "[Cancelled] = 0");

            migrationBuilder.CreateIndex(
                name: "IX_ScheduleAssignments_WeekId",
                table: "ScheduleAssignments",
                column: "WeekId");

            migrationBuilder.CreateIndex(
                name: "IX_ScheduleChanges_WeekId",
                table: "ScheduleChanges",
                column: "WeekId");

            migrationBuilder.CreateIndex(
                name: "IX_ScheduleCoverage_DepartmentId",
                table: "ScheduleCoverage",
                column: "DepartmentId");

            migrationBuilder.CreateIndex(
                name: "IX_ScheduleCoverage_FacilityId_DepartmentId_Name",
                table: "ScheduleCoverage",
                columns: new[] { "FacilityId", "DepartmentId", "Name" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ScheduleWeeks_DepartmentId_Monday",
                table: "ScheduleWeeks",
                columns: new[] { "DepartmentId", "Monday" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ScheduleAssignments");

            migrationBuilder.DropTable(
                name: "ScheduleChanges");

            migrationBuilder.DropTable(
                name: "ScheduleCoverage");

            migrationBuilder.DropTable(
                name: "ScheduleWeeks");

            migrationBuilder.DropTable(
                name: "ScheduleFacilities");
        }
    }
}
