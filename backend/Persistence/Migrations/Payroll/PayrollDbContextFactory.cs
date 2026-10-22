using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Vnc.HRMS.Persistence.Migrations.Payroll;

public sealed class PayrollDbContextFactory : IDesignTimeDbContextFactory<PayrollDbContext>
{
    public PayrollDbContext CreateDbContext(string[] args)
    {
        var configuration = MigrationConfiguration.Load(args);
        var options = new DbContextOptionsBuilder<PayrollDbContext>();
        options.UseSqlServer(configuration.GetConnectionString("DefaultConnection"), sql => sql.MigrationsHistoryTable("__EFMigrationsHistory", "payroll"));
        return new PayrollDbContext(options.Options);
    }
}
