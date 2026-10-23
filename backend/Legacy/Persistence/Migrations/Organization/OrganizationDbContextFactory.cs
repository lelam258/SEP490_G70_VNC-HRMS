using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
namespace Vnc.HRMS.Persistence.Migrations.Organization;
public sealed class OrganizationDbContextFactory : IDesignTimeDbContextFactory<OrganizationDbContext>
{
    public OrganizationDbContext CreateDbContext(string[] args)
    {
        var configuration = MigrationConfiguration.Load(args);
        var options = new DbContextOptionsBuilder<OrganizationDbContext>();
        options.UseSqlServer(configuration.GetConnectionString("DefaultConnection"), sql => sql.MigrationsHistoryTable("__EFMigrationsHistory", "organization"));
        return new OrganizationDbContext(options.Options);
    }
}
