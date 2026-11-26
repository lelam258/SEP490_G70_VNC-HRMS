using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Vnc.HRMS.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddDegreePrimaryAndActive : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_certificates_staff_id",
                schema: "dbo",
                table: "certificates");

            migrationBuilder.AddColumn<bool>(
                name: "is_active",
                schema: "dbo",
                table: "certificates",
                type: "bit",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "is_primary",
                schema: "dbo",
                table: "certificates",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateIndex(
                name: "UX_certificates_staff_primary_active",
                schema: "dbo",
                table: "certificates",
                column: "staff_id",
                unique: true,
                filter: "[is_primary] = 1 AND [is_active] = 1");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "UX_certificates_staff_primary_active",
                schema: "dbo",
                table: "certificates");

            migrationBuilder.DropColumn(
                name: "is_active",
                schema: "dbo",
                table: "certificates");

            migrationBuilder.DropColumn(
                name: "is_primary",
                schema: "dbo",
                table: "certificates");

            migrationBuilder.CreateIndex(
                name: "IX_certificates_staff_id",
                schema: "dbo",
                table: "certificates",
                column: "staff_id");
        }
    }
}
