using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Vnc.HRMS.Persistence.Migrations.Employees
{
    /// <inheritdoc />
    public partial class EmployeesBeforeAccounts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_staff_user_id",
                schema: "employees",
                table: "staff");

            migrationBuilder.AlterColumn<Guid>(
                name: "user_id",
                schema: "employees",
                table: "staff",
                type: "uniqueidentifier",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier");

            migrationBuilder.CreateIndex(
                name: "IX_staff_user_id",
                schema: "employees",
                table: "staff",
                column: "user_id",
                unique: true,
                filter: "[user_id] IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_staff_user_id",
                schema: "employees",
                table: "staff");

            migrationBuilder.AlterColumn<Guid>(
                name: "user_id",
                schema: "employees",
                table: "staff",
                type: "uniqueidentifier",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier",
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_staff_user_id",
                schema: "employees",
                table: "staff",
                column: "user_id",
                unique: true);
        }
    }
}
