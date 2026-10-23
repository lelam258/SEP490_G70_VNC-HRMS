using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Vnc.HRMS.Persistence.Migrations.Auth
{
    /// <inheritdoc />
    public partial class SessionVersion : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "account_version",
                schema: "auth",
                table: "refresh_tokens",
                type: "int",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "account_version",
                schema: "auth",
                table: "refresh_tokens");
        }
    }
}
