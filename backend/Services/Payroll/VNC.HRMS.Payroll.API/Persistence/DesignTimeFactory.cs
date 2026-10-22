using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
namespace Vnc.HRMS.Persistence;
public sealed class DesignTimeFactory : IDesignTimeDbContextFactory<PayrollDbContext>
{
    public PayrollDbContext CreateDbContext(string[] args)
    {
        var connection = Environment.GetEnvironmentVariable("ConnectionStrings__Payroll") ?? "Server=localhost;Database=VNC_Payroll_DB;Integrated Security=True;Encrypt=True;TrustServerCertificate=True;";
        return new(new DbContextOptionsBuilder<PayrollDbContext>().UseSqlServer(connection).Options);
    }
}
