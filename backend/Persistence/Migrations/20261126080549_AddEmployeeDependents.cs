using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Vnc.HRMS.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddEmployeeDependents : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "dependents",
                schema: "dbo",
                columns: table => new
                {
                    dependent_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "NEWID()"),
                    full_name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    date_of_birth = table.Column<DateOnly>(type: "date", nullable: false),
                    gender = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    id_card_number = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    tax_code = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime2(0)", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_dependents", x => x.dependent_id);
                    table.CheckConstraint("CK_dependents_gender", "[gender] IN ('male', 'female', 'other')");
                });

            migrationBuilder.CreateTable(
                name: "staff_dependents",
                schema: "dbo",
                columns: table => new
                {
                    staff_dependent_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "NEWID()"),
                    registered_by = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    dependent_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    staff_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    relationship = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    is_active = table.Column<bool>(type: "bit", nullable: false, defaultValue: true),
                    created_at = table.Column<DateTime>(type: "datetime2(0)", nullable: false, defaultValueSql: "SYSUTCDATETIME()"),
                    updated_at = table.Column<DateTime>(type: "datetime2(0)", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_staff_dependents", x => x.staff_dependent_id);
                    table.CheckConstraint("CK_staff_dependents_relationship", "[relationship] IN ('father', 'mother', 'child', 'spouse', 'other')");
                    table.ForeignKey(
                        name: "FK_staff_dependents_dependents_dependent_id",
                        column: x => x.dependent_id,
                        principalSchema: "dbo",
                        principalTable: "dependents",
                        principalColumn: "dependent_id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_staff_dependents_staff_staff_id",
                        column: x => x.staff_id,
                        principalSchema: "dbo",
                        principalTable: "staff",
                        principalColumn: "staff_id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_staff_dependents_users_registered_by",
                        column: x => x.registered_by,
                        principalSchema: "dbo",
                        principalTable: "users",
                        principalColumn: "user_id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "dependent_documents",
                schema: "dbo",
                columns: table => new
                {
                    document_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "NEWID()"),
                    staff_dependent_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    document_type = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    file_name = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    file_url = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    verification_status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false, defaultValue: "pending"),
                    uploaded_at = table.Column<DateTime>(type: "datetime2(0)", nullable: false, defaultValueSql: "SYSUTCDATETIME()"),
                    verified_by = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_dependent_documents", x => x.document_id);
                    table.CheckConstraint("CK_dependent_documents_status", "[verification_status] IN ('pending', 'verified', 'rejected')");
                    table.ForeignKey(
                        name: "FK_dependent_documents_staff_dependents_staff_dependent_id",
                        column: x => x.staff_dependent_id,
                        principalSchema: "dbo",
                        principalTable: "staff_dependents",
                        principalColumn: "staff_dependent_id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_dependent_documents_users_verified_by",
                        column: x => x.verified_by,
                        principalSchema: "dbo",
                        principalTable: "users",
                        principalColumn: "user_id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_dependent_documents_staff_dependent_id",
                schema: "dbo",
                table: "dependent_documents",
                column: "staff_dependent_id");

            migrationBuilder.CreateIndex(
                name: "IX_dependent_documents_verified_by",
                schema: "dbo",
                table: "dependent_documents",
                column: "verified_by");

            migrationBuilder.CreateIndex(
                name: "IX_dependents_id_card_number",
                schema: "dbo",
                table: "dependents",
                column: "id_card_number",
                unique: true,
                filter: "[id_card_number] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_dependents_tax_code",
                schema: "dbo",
                table: "dependents",
                column: "tax_code",
                unique: true,
                filter: "[tax_code] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_staff_dependents_dependent_id",
                schema: "dbo",
                table: "staff_dependents",
                column: "dependent_id");

            migrationBuilder.CreateIndex(
                name: "IX_staff_dependents_registered_by",
                schema: "dbo",
                table: "staff_dependents",
                column: "registered_by");

            migrationBuilder.CreateIndex(
                name: "IX_staff_dependents_staff_id",
                schema: "dbo",
                table: "staff_dependents",
                column: "staff_id");

            migrationBuilder.CreateIndex(
                name: "IX_staff_dependents_staff_id_dependent_id",
                schema: "dbo",
                table: "staff_dependents",
                columns: new[] { "staff_id", "dependent_id" },
                unique: true,
                filter: "[is_active] = 1");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "dependent_documents",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "staff_dependents",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "dependents",
                schema: "dbo");
        }
    }
}
