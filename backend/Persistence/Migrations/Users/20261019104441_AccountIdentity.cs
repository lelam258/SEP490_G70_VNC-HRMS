using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Vnc.HRMS.Persistence.Migrations.Users
{
    /// <inheritdoc />
    public partial class AccountIdentity : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "email",
                schema: "users",
                table: "users",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "employee_id",
                schema: "users",
                table: "users",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "is_provisioned",
                schema: "users",
                table: "users",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "normalized_username",
                schema: "users",
                table: "users",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<byte[]>(
                name: "version",
                schema: "users",
                table: "users",
                type: "rowversion",
                rowVersion: true,
                nullable: false,
                defaultValue: new byte[0]);

            migrationBuilder.Sql("UPDATE [users].[users] SET [normalized_username] = UPPER(LTRIM(RTRIM([username])));");

            migrationBuilder.CreateIndex(
                name: "IX_users_email",
                schema: "users",
                table: "users",
                column: "email",
                unique: true,
                filter: "[email] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_users_employee_id",
                schema: "users",
                table: "users",
                column: "employee_id",
                unique: true,
                filter: "[employee_id] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_users_normalized_username",
                schema: "users",
                table: "users",
                column: "normalized_username",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_users_email",
                schema: "users",
                table: "users");

            migrationBuilder.DropIndex(
                name: "IX_users_employee_id",
                schema: "users",
                table: "users");

            migrationBuilder.DropIndex(
                name: "IX_users_normalized_username",
                schema: "users",
                table: "users");

            migrationBuilder.DropColumn(
                name: "email",
                schema: "users",
                table: "users");

            migrationBuilder.DropColumn(
                name: "employee_id",
                schema: "users",
                table: "users");

            migrationBuilder.DropColumn(
                name: "is_provisioned",
                schema: "users",
                table: "users");

            migrationBuilder.DropColumn(
                name: "normalized_username",
                schema: "users",
                table: "users");

            migrationBuilder.DropColumn(
                name: "version",
                schema: "users",
                table: "users");
        }
    }
}
