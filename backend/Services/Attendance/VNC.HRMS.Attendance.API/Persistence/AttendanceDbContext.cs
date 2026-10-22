using Microsoft.EntityFrameworkCore;
using Vnc.HRMS.Configurations.Entities;
using Vnc.HRMS.Models;
namespace Vnc.HRMS.Persistence;
public sealed class AttendanceDbContext(DbContextOptions<AttendanceDbContext> options) : TimestampDbContext(options)
{
    public DbSet<AttendanceImport> AttendanceImports => Set<AttendanceImport>();
    public DbSet<OnCallShift> OnCallShifts => Set<OnCallShift>();
    public DbSet<AttendanceRecord> AttendanceRecords => Set<AttendanceRecord>();
    public DbSet<LeaveRequest> LeaveRequests => Set<LeaveRequest>();
    public DbSet<WorkScheduleTemplate> WorkScheduleTemplates => Set<WorkScheduleTemplate>();
    public DbSet<MonthlyTimesheet> MonthlyTimesheets => Set<MonthlyTimesheet>();
    protected override void OnModelCreating(ModelBuilder modelBuilder) => DomainModelConfiguration.Configure(modelBuilder);
}
