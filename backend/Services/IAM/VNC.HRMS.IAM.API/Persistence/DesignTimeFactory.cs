using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
namespace Vnc.HRMS.Persistence;
public sealed class DesignTimeFactory : IDesignTimeDbContextFactory<IamDbContext>
{
    public IamDbContext CreateDbContext(string[] args)
    {
        var connection = Environment.GetEnvironmentVariable("ConnectionStrings__IAM") ?? "Server=localhost;Database=VNC_IAM_DB;Integrated Security=True;Encrypt=True;TrustServerCertificate=True;";
        return new(new DbContextOptionsBuilder<IamDbContext>().UseSqlServer(connection).Options);
    }
}
