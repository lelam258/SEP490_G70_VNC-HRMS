using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Vnc.HRMS.Persistence.Migrations.Employees
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "employees");

            migrationBuilder.CreateTable(
                name: "staff",
                schema: "employees",
                columns: table => new
                {
                    staff_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "NEWID()"),
                    user_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    staff_code = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    device_enroll_id = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    full_name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    date_of_birth = table.Column<DateOnly>(type: "date", nullable: true),
                    gender = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    phone = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    email = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    id_card_number = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    avatar_url = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    department_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    position_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    scope_of_practice = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    date_joined = table.Column<DateOnly>(type: "date", nullable: false),
                    date_left = table.Column<DateOnly>(type: "date", nullable: true),
                    dependent_count = table.Column<int>(type: "int", nullable: false),
                    status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false, defaultValue: "active"),
                    created_by = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime2(0)", nullable: false, defaultValueSql: "SYSUTCDATETIME()"),
                    updated_at = table.Column<DateTime>(type: "datetime2(0)", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_staff", x => x.staff_id);
                });

            migrationBuilder.CreateTable(
                name: "contracts",
                schema: "employees",
                columns: table => new
                {
                    contract_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "NEWID()"),
                    staff_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    contract_code = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    contract_type = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    daily_rate = table.Column<decimal>(type: "decimal(15,2)", precision: 15, scale: 2, nullable: false),
                    effective_from = table.Column<DateOnly>(type: "date", nullable: false),
                    effective_to = table.Column<DateOnly>(type: "date", nullable: true),
                    is_insurance_eligible = table.Column<bool>(type: "bit", nullable: false, defaultValue: true),
                    insurance_salary_basis = table.Column<decimal>(type: "decimal(15,2)", precision: 15, scale: 2, nullable: true),
                    status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false, defaultValue: "active"),
                    file_url = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime2(0)", nullable: false, defaultValueSql: "SYSUTCDATETIME()"),
                    updated_at = table.Column<DateTime>(type: "datetime2(0)", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_contracts", x => x.contract_id);
                    table.ForeignKey(
                        name: "FK_contracts_staff_staff_id",
                        column: x => x.staff_id,
                        principalSchema: "employees",
                        principalTable: "staff",
                        principalColumn: "staff_id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "degrees",
                schema: "employees",
                columns: table => new
                {
                    degree_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "NEWID()"),
                    staff_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    degree_type = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    degree_name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    issued_by = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    issued_at = table.Column<DateOnly>(type: "date", nullable: true),
                    file_url = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime2(0)", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_degrees", x => x.degree_id);
                    table.ForeignKey(
                        name: "FK_degrees_staff_staff_id",
                        column: x => x.staff_id,
                        principalSchema: "employees",
                        principalTable: "staff",
                        principalColumn: "staff_id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_contracts_contract_code",
                schema: "employees",
                table: "contracts",
                column: "contract_code",
                unique: true,
                filter: "[contract_code] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_contracts_staff_id",
                schema: "employees",
                table: "contracts",
                column: "staff_id");

            migrationBuilder.CreateIndex(
                name: "IX_degrees_staff_id",
                schema: "employees",
                table: "degrees",
                column: "staff_id");

            migrationBuilder.CreateIndex(
                name: "IX_staff_device_enroll_id",
                schema: "employees",
                table: "staff",
                column: "device_enroll_id",
                unique: true,
                filter: "[device_enroll_id] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_staff_email",
                schema: "employees",
                table: "staff",
                column: "email",
                unique: true,
                filter: "[email] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_staff_id_card_number",
                schema: "employees",
                table: "staff",
                column: "id_card_number",
                unique: true,
                filter: "[id_card_number] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_staff_staff_code",
                schema: "employees",
                table: "staff",
                column: "staff_code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_staff_user_id",
                schema: "employees",
                table: "staff",
                column: "user_id",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "contracts",
                schema: "employees");

            migrationBuilder.DropTable(
                name: "degrees",
                schema: "employees");

            migrationBuilder.DropTable(
                name: "staff",
                schema: "employees");
        }
    }
}
