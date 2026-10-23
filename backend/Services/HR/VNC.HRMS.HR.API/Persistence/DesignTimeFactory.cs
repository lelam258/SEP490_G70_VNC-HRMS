using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
namespace Vnc.HRMS.Persistence;
public sealed class DesignTimeFactory : IDesignTimeDbContextFactory<HrDbContext>
{
    public HrDbContext CreateDbContext(string[] args)
    {
        var connection = Environment.GetEnvironmentVariable("ConnectionStrings__HR") ?? "Server=localhost;Database=VNC_HR_DB;Integrated Security=True;Encrypt=True;TrustServerCertificate=True;";
        return new(new DbContextOptionsBuilder<HrDbContext>().UseSqlServer(connection).Options);
    }
}
