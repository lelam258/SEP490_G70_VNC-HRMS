using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
namespace Vnc.HRMS.Persistence;
public sealed class DesignTimeFactory : IDesignTimeDbContextFactory<AttendanceDbContext>
{
    public AttendanceDbContext CreateDbContext(string[] args)
    {
        var connection = Environment.GetEnvironmentVariable("ConnectionStrings__Attendance") ?? "Server=localhost;Database=VNC_Attendance_DB;Integrated Security=True;Encrypt=True;TrustServerCertificate=True;";
        return new(new DbContextOptionsBuilder<AttendanceDbContext>().UseSqlServer(connection).Options);
    }
}
