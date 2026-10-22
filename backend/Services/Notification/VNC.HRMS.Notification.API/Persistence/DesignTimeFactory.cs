using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
namespace Vnc.HRMS.Persistence;
public sealed class DesignTimeFactory : IDesignTimeDbContextFactory<NotificationDbContext>
{
    public NotificationDbContext CreateDbContext(string[] args)
    {
        var connection = Environment.GetEnvironmentVariable("ConnectionStrings__Notification") ?? "Server=localhost;Database=VNC_Notification_DB;Integrated Security=True;Encrypt=True;TrustServerCertificate=True;";
        return new(new DbContextOptionsBuilder<NotificationDbContext>().UseSqlServer(connection).Options);
    }
}
