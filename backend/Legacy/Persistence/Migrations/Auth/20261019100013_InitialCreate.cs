using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Vnc.HRMS.Persistence.Migrations.Auth
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "auth");

            migrationBuilder.CreateTable(
                name: "credentials",
                schema: "auth",
                columns: table => new
                {
                    user_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    password_hash = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    failed_login_count = table.Column<int>(type: "int", nullable: false),
                    locked_until = table.Column<DateTime>(type: "datetime2(0)", nullable: true),
                    last_login = table.Column<DateTime>(type: "datetime2(0)", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime2(0)", nullable: false, defaultValueSql: "SYSUTCDATETIME()"),
                    updated_at = table.Column<DateTime>(type: "datetime2(0)", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_credentials", x => x.user_id);
                });

            migrationBuilder.CreateTable(
                name: "refresh_tokens",
                schema: "auth",
                columns: table => new
                {
                    token_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "NEWID()"),
                    user_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    token_hash = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    device_info = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    expires_at = table.Column<DateTime>(type: "datetime2(0)", nullable: false),
                    revoked = table.Column<bool>(type: "bit", nullable: false),
                    revoked_at = table.Column<DateTime>(type: "datetime2(0)", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime2(0)", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_refresh_tokens", x => x.token_id);
                    table.ForeignKey(
                        name: "FK_refresh_tokens_credentials_user_id",
                        column: x => x.user_id,
                        principalSchema: "auth",
                        principalTable: "credentials",
                        principalColumn: "user_id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_refresh_tokens_token_hash",
                schema: "auth",
                table: "refresh_tokens",
                column: "token_hash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_refresh_tokens_user_id",
                schema: "auth",
                table: "refresh_tokens",
                column: "user_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "refresh_tokens",
                schema: "auth");

            migrationBuilder.DropTable(
                name: "credentials",
                schema: "auth");
        }
    }
}
