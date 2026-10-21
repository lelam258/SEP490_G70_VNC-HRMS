using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
namespace Vnc.HRMS.Persistence.Migrations.Auth;
public sealed class AuthDbContextFactory : IDesignTimeDbContextFactory<AuthDbContext>
{
    public AuthDbContext CreateDbContext(string[] args)
    {
        var configuration = MigrationConfiguration.Load(args);
        var options = new DbContextOptionsBuilder<AuthDbContext>();
        options.UseSqlServer(configuration.GetConnectionString("DefaultConnection"), sql => sql.MigrationsHistoryTable("__EFMigrationsHistory", "auth"));
        return new AuthDbContext(options.Options);
    }
}
