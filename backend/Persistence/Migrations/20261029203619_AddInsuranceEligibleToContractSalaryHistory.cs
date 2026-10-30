using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Vnc.HRMS.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddInsuranceEligibleToContractSalaryHistory : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "is_insurance_eligible",
                schema: "dbo",
                table: "contract_salary_histories",
                type: "bit",
                nullable: false,
                defaultValue: false);

            // Existing history rows were copied from their contract, so take the flag from there.
            migrationBuilder.Sql(@"
UPDATE h SET h.is_insurance_eligible = c.is_insurance_eligible
FROM dbo.contract_salary_histories h
JOIN dbo.contracts c ON c.contract_id = h.contract_id;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "is_insurance_eligible",
                schema: "dbo",
                table: "contract_salary_histories");
        }
    }
}
