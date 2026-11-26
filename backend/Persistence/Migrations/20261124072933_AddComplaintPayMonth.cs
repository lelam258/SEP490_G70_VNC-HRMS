using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Vnc.HRMS.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddComplaintPayMonth : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_complaints_staff_id",
                schema: "dbo",
                table: "complaints");

            migrationBuilder.AddColumn<string>(
                name: "pay_month",
                schema: "dbo",
                table: "complaints",
                type: "nvarchar(7)",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_complaints_pay_month_status",
                schema: "dbo",
                table: "complaints",
                columns: new[] { "pay_month", "status" });

            migrationBuilder.CreateIndex(
                name: "IX_complaints_staff_submitted",
                schema: "dbo",
                table: "complaints",
                columns: new[] { "staff_id", "submitted_at" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_complaints_pay_month_status",
                schema: "dbo",
                table: "complaints");

            migrationBuilder.DropIndex(
                name: "IX_complaints_staff_submitted",
                schema: "dbo",
                table: "complaints");

            migrationBuilder.DropColumn(
                name: "pay_month",
                schema: "dbo",
                table: "complaints");

            migrationBuilder.CreateIndex(
                name: "IX_complaints_staff_id",
                schema: "dbo",
                table: "complaints",
                column: "staff_id");
        }
    }
}
