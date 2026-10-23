using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
namespace Vnc.HRMS.Persistence.Migrations.Employees;
public sealed class EmployeeDbContextFactory : IDesignTimeDbContextFactory<EmployeeDbContext>
{
    public EmployeeDbContext CreateDbContext(string[] args)
    {
        var configuration = MigrationConfiguration.Load(args);
        var options = new DbContextOptionsBuilder<EmployeeDbContext>();
        options.UseSqlServer(configuration.GetConnectionString("DefaultConnection"), sql => sql.MigrationsHistoryTable("__EFMigrationsHistory", "employees"));
        return new EmployeeDbContext(options.Options);
    }
}
