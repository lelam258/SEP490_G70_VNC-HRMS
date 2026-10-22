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
                name: "compliance");

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
                name: "IX_compliance_scans_certificate_id",
                schema: "compliance",
                table: "compliance_scans",
                column: "certificate_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "cme_records",
                schema: "compliance");

            migrationBuilder.DropTable(
                name: "compliance_scans",
                schema: "compliance");

            migrationBuilder.DropTable(
                name: "cme_cycles",
                schema: "compliance");

            migrationBuilder.DropTable(
                name: "certificates",
                schema: "compliance");
        }
    }
}
