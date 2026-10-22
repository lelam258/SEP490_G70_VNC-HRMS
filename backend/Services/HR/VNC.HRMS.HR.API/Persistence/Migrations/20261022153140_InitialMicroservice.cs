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
                name: "hr");

            migrationBuilder.CreateTable(
                name: "positions",
                schema: "hr",
                columns: table => new
                {
                    position_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "NEWID()"),
                    name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    scope_tag = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false, defaultValue: "active")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_positions", x => x.position_id);
                });

            migrationBuilder.CreateTable(
                name: "contracts",
                schema: "hr",
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
                    table.CheckConstraint("CK_contracts_1", "[effective_to] IS NULL OR [effective_to] >= [effective_from]");
                    table.CheckConstraint("CK_contracts_2", "[daily_rate] >= 0 AND ([insurance_salary_basis] IS NULL OR [insurance_salary_basis] >= 0)");
                });

            migrationBuilder.CreateTable(
                name: "degrees",
                schema: "hr",
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
                });

            migrationBuilder.CreateTable(
                name: "departments",
                schema: "hr",
                columns: table => new
                {
                    department_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "NEWID()"),
                    dept_code = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    manager_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false, defaultValue: "active"),
                    created_at = table.Column<DateTime>(type: "datetime2(0)", nullable: false, defaultValueSql: "SYSUTCDATETIME()"),
                    updated_at = table.Column<DateTime>(type: "datetime2(0)", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_departments", x => x.department_id);
                });

            migrationBuilder.CreateTable(
                name: "staff",
                schema: "hr",
                columns: table => new
                {
                    staff_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "NEWID()"),
                    user_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
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
                    table.CheckConstraint("CK_staff_1", "[date_left] IS NULL OR [date_left] >= [date_joined]");
                    table.CheckConstraint("CK_staff_2", "[dependent_count] >= 0");
                    table.ForeignKey(
                        name: "FK_staff_departments_department_id",
                        column: x => x.department_id,
                        principalSchema: "hr",
                        principalTable: "departments",
                        principalColumn: "department_id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_staff_positions_position_id",
                        column: x => x.position_id,
                        principalSchema: "hr",
                        principalTable: "positions",
                        principalColumn: "position_id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_contracts_contract_code",
                schema: "hr",
                table: "contracts",
                column: "contract_code",
                unique: true,
                filter: "[contract_code] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_contracts_staff_id",
                schema: "hr",
                table: "contracts",
                column: "staff_id");

            migrationBuilder.CreateIndex(
                name: "IX_degrees_staff_id",
                schema: "hr",
                table: "degrees",
                column: "staff_id");

            migrationBuilder.CreateIndex(
                name: "IX_departments_dept_code",
                schema: "hr",
                table: "departments",
                column: "dept_code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_departments_manager_id",
                schema: "hr",
                table: "departments",
                column: "manager_id");

            migrationBuilder.CreateIndex(
                name: "IX_departments_name",
                schema: "hr",
                table: "departments",
                column: "name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_positions_name",
                schema: "hr",
                table: "positions",
                column: "name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_staff_department_id",
                schema: "hr",
                table: "staff",
                column: "department_id");

            migrationBuilder.CreateIndex(
                name: "IX_staff_device_enroll_id",
                schema: "hr",
                table: "staff",
                column: "device_enroll_id",
                unique: true,
                filter: "[device_enroll_id] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_staff_email",
                schema: "hr",
                table: "staff",
                column: "email",
                unique: true,
                filter: "[email] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_staff_id_card_number",
                schema: "hr",
                table: "staff",
                column: "id_card_number",
                unique: true,
                filter: "[id_card_number] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_staff_position_id",
                schema: "hr",
                table: "staff",
                column: "position_id");

            migrationBuilder.CreateIndex(
                name: "IX_staff_staff_code",
                schema: "hr",
                table: "staff",
                column: "staff_code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_staff_user_id",
                schema: "hr",
                table: "staff",
                column: "user_id",
                unique: true,
                filter: "[user_id] IS NOT NULL");

            migrationBuilder.AddForeignKey(
                name: "FK_contracts_staff_staff_id",
                schema: "hr",
                table: "contracts",
                column: "staff_id",
                principalSchema: "hr",
                principalTable: "staff",
                principalColumn: "staff_id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_degrees_staff_staff_id",
                schema: "hr",
                table: "degrees",
                column: "staff_id",
                principalSchema: "hr",
                principalTable: "staff",
                principalColumn: "staff_id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_departments_staff_manager_id",
                schema: "hr",
                table: "departments",
                column: "manager_id",
                principalSchema: "hr",
                principalTable: "staff",
                principalColumn: "staff_id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_departments_staff_manager_id",
                schema: "hr",
                table: "departments");

            migrationBuilder.DropTable(
                name: "contracts",
                schema: "hr");

            migrationBuilder.DropTable(
                name: "degrees",
                schema: "hr");

            migrationBuilder.DropTable(
                name: "staff",
                schema: "hr");

            migrationBuilder.DropTable(
                name: "departments",
                schema: "hr");

            migrationBuilder.DropTable(
                name: "positions",
                schema: "hr");
        }
    }
}
