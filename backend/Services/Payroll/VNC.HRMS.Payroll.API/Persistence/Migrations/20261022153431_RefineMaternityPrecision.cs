using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Vnc.HRMS.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class RefineMaternityPrecision : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<bool>(
                name: "insurance_eligible",
                schema: "payroll",
                table: "maternity_cases",
                type: "bit",
                nullable: false,
                defaultValue: false,
                oldClrType: typeof(bool),
                oldType: "bit",
                oldDefaultValueSql: "0");

            migrationBuilder.DropColumn(name: "total_benefit_amount", schema: "payroll", table: "maternity_cases");
            migrationBuilder.AddColumn<decimal>(
                name: "total_benefit_amount",
                schema: "payroll",
                table: "maternity_cases",
                type: "decimal(16,2)",
                precision: 16,
                scale: 2,
                nullable: false,
                computedColumnSql: "[benefit_amount] + [additional_benefit_amount]",
                stored: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<bool>(
                name: "insurance_eligible",
                schema: "payroll",
                table: "maternity_cases",
                type: "bit",
                nullable: false,
                defaultValueSql: "0",
                oldClrType: typeof(bool),
                oldType: "bit",
                oldDefaultValue: false);

            migrationBuilder.DropColumn(name: "total_benefit_amount", schema: "payroll", table: "maternity_cases");
            migrationBuilder.AddColumn<decimal>(
                name: "total_benefit_amount",
                schema: "payroll",
                table: "maternity_cases",
                type: "decimal(18,2)",
                nullable: false,
                computedColumnSql: "[benefit_amount] + [additional_benefit_amount]",
                stored: true);
        }
    }
}
