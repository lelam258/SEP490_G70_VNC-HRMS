using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Vnc.HRMS.Persistence.Migrations.Auth
{
    /// <inheritdoc />
    public partial class EmailOtpRecovery : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "attempts",
                schema: "auth",
                table: "password_reset_tokens",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "code_length",
                schema: "auth",
                table: "password_reset_tokens",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "max_attempts",
                schema: "auth",
                table: "password_reset_tokens",
                type: "int",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "attempts",
                schema: "auth",
                table: "password_reset_tokens");

            migrationBuilder.DropColumn(
                name: "code_length",
                schema: "auth",
                table: "password_reset_tokens");

            migrationBuilder.DropColumn(
                name: "max_attempts",
                schema: "auth",
                table: "password_reset_tokens");
        }
    }
}
