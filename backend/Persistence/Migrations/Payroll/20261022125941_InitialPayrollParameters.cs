using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Vnc.HRMS.Persistence.Migrations.Payroll
{
    /// <inheritdoc />
    public partial class InitialPayrollParameters : Migration
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
                    code = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    value_type = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false, defaultValue: "fixed"),
                    default_value = table.Column<decimal>(type: "decimal(15,2)", precision: 15, scale: 2, nullable: true),
                    applies_to = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false, defaultValue: "all"),
                    is_taxable = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    is_insurance_basis = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false, defaultValue: "active"),
                    created_at = table.Column<DateTime>(type: "datetime2(0)", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_allowance_types", x => x.allowance_id);
                });

            migrationBuilder.CreateTable(
                name: "commission_rules",
                schema: "payroll",
                columns: table => new
                {
                    rule_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "NEWID()"),
                    service_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    role = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    value_type = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false, defaultValue: "fixed"),
                    commission_value = table.Column<decimal>(type: "decimal(15,4)", precision: 15, scale: 4, nullable: false),
                    effective_from = table.Column<DateOnly>(type: "date", nullable: false),
                    effective_to = table.Column<DateOnly>(type: "date", nullable: true),
                    status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false, defaultValue: "active"),
                    created_by = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime2(0)", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_commission_rules", x => x.rule_id);
                });

            migrationBuilder.CreateTable(
                name: "payroll_insurance_configs",
                schema: "payroll",
                columns: table => new
                {
                    config_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "NEWID()"),
                    insurance_type = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    payer = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    rate_percent = table.Column<decimal>(type: "decimal(5,2)", precision: 5, scale: 2, nullable: false),
                    applies_to = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false, defaultValue: "all"),
                    effective_from = table.Column<DateOnly>(type: "date", nullable: false),
                    effective_to = table.Column<DateOnly>(type: "date", nullable: true),
                    status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false, defaultValue: "active")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_payroll_insurance_configs", x => x.config_id);
                });

            migrationBuilder.CreateTable(
                name: "payroll_tax_brackets",
                schema: "payroll",
                columns: table => new
                {
                    bracket_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "NEWID()"),
                    income_from = table.Column<decimal>(type: "decimal(15,2)", precision: 15, scale: 2, nullable: false),
                    income_to = table.Column<decimal>(type: "decimal(15,2)", precision: 15, scale: 2, nullable: true),
                    tax_rate_percent = table.Column<decimal>(type: "decimal(5,2)", precision: 5, scale: 2, nullable: false),
                    effective_from = table.Column<DateOnly>(type: "date", nullable: false),
                    effective_to = table.Column<DateOnly>(type: "date", nullable: true),
                    status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false, defaultValue: "active")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_payroll_tax_brackets", x => x.bracket_id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_allowance_types_code",
                schema: "payroll",
                table: "allowance_types",
                column: "code",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "allowance_types",
                schema: "payroll");

            migrationBuilder.DropTable(
                name: "commission_rules",
                schema: "payroll");

            migrationBuilder.DropTable(
                name: "payroll_insurance_configs",
                schema: "payroll");

            migrationBuilder.DropTable(
                name: "payroll_tax_brackets",
                schema: "payroll");
        }
    }
}
