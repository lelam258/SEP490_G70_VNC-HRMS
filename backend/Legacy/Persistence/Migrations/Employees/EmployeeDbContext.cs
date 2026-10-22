using Microsoft.EntityFrameworkCore;
using Vnc.HRMS.Models.Employees;
using Vnc.HRMS.Configurations.Entities;

namespace Vnc.HRMS.Persistence.Migrations.Employees;

public sealed class EmployeeDbContext(DbContextOptions<EmployeeDbContext> options) : TimestampDbContext(options)
{
    public DbSet<Staff> Staff => Set<Staff>();
    public DbSet<Contract> Contracts => Set<Contract>();
    public DbSet<Degree> Degrees => Set<Degree>();

    protected override void OnModelCreating(ModelBuilder modelBuilder) { modelBuilder.HasDefaultSchema("employees"); EmployeesModelConfiguration.Configure(modelBuilder); }
}
