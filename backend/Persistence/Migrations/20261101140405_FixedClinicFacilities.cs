using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Vnc.HRMS.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class FixedClinicFacilities : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Match by name to preserve existing facility IDs and schedule references.
            migrationBuilder.Sql("""
                IF NOT EXISTS (SELECT 1 FROM [ScheduleFacilities] WHERE [Name] = N'Cơ sở 1')
                    INSERT INTO [ScheduleFacilities] ([Id], [Name]) VALUES ('11111111-1111-4111-8111-111111111111', N'Cơ sở 1');
                IF NOT EXISTS (SELECT 1 FROM [ScheduleFacilities] WHERE [Name] = N'Cơ sở 2')
                    INSERT INTO [ScheduleFacilities] ([Id], [Name]) VALUES ('22222222-2222-4222-8222-222222222222', N'Cơ sở 2');
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Keep reference data: existing schedules can depend on these facilities.
        }
    }
}
