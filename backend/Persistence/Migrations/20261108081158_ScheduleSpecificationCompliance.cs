using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Vnc.HRMS.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ScheduleSpecificationCompliance : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "PublishedSnapshot",
                table: "ScheduleWeeks",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Status",
                table: "ScheduleFacilities",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "active");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PublishedSnapshot",
                table: "ScheduleWeeks");

            migrationBuilder.DropColumn(
                name: "Status",
                table: "ScheduleFacilities");
        }
    }
}
