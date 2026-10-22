using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
namespace Vnc.HRMS.Persistence.Migrations;

[DbContext(typeof(IamDbContext))]
[Migration("20261022180000_SplitHrAccountRoles")]
public sealed class SplitHrAccountRoles : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        UPDATE [iam].[users] SET [role] = N'hr_manager', [security_version] = [security_version] + 1,
            [updated_at] = SYSUTCDATETIME() WHERE [role] = N'hr';
        """);
    protected override void Down(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        UPDATE [iam].[users] SET [role] = N'hr', [security_version] = [security_version] + 1,
            [updated_at] = SYSUTCDATETIME() WHERE [role] = N'hr_manager';
        """);
}
