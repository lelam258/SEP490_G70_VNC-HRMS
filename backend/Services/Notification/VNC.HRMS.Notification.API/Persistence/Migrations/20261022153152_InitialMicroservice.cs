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
                name: "notification");

            migrationBuilder.CreateTable(
                name: "notifications",
                schema: "notification",
                columns: table => new
                {
                    notification_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "NEWID()"),
                    recipient_id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    sender_service = table.Column<string>(type: "nvarchar(50)", nullable: false),
                    type = table.Column<string>(type: "nvarchar(50)", nullable: false),
                    title = table.Column<string>(type: "nvarchar(200)", nullable: false),
                    body = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    action_url = table.Column<string>(type: "nvarchar(500)", nullable: true),
                    entity_type = table.Column<string>(type: "nvarchar(50)", nullable: true),
                    entity_id = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    channel = table.Column<string>(type: "nvarchar(20)", nullable: true, defaultValueSql: "'in_app'"),
                    is_read = table.Column<bool>(type: "bit", nullable: true, defaultValueSql: "0"),
                    read_at = table.Column<DateTime>(type: "datetime2(0)", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime2(0)", nullable: true, defaultValueSql: "SYSUTCDATETIME()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_notifications", x => x.notification_id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_notifications_recipient_unread",
                schema: "notification",
                table: "notifications",
                columns: new[] { "recipient_id", "is_read", "created_at" },
                descending: new[] { false, false, true });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "notifications",
                schema: "notification");
        }
    }
}
