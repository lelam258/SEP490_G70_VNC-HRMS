using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
namespace Vnc.HRMS.Persistence.Migrations.Users;
public sealed class UserDbContextFactory : IDesignTimeDbContextFactory<UserDbContext>
{
    public UserDbContext CreateDbContext(string[] args)
    {
        var configuration = MigrationConfiguration.Load(args);
        var options = new DbContextOptionsBuilder<UserDbContext>();
        options.UseSqlServer(configuration.GetConnectionString("DefaultConnection"), sql => sql.MigrationsHistoryTable("__EFMigrationsHistory", "users"));
        return new UserDbContext(options.Options);
    }
}
