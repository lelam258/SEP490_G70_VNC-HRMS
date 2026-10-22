using Microsoft.EntityFrameworkCore;
using Vnc.HRMS.Configurations.Entities;
using Vnc.HRMS.Models.Employees;
using Vnc.HRMS.Models.Organization;
namespace Vnc.HRMS.Persistence;
public sealed class HrDbContext(DbContextOptions<HrDbContext> options) : TimestampDbContext(options)
{
    public DbSet<Staff> Staff => Set<Staff>();
    public DbSet<Contract> Contracts => Set<Contract>();
    public DbSet<Degree> Degrees => Set<Degree>();
    public DbSet<Department> Departments => Set<Department>();
    public DbSet<Position> Positions => Set<Position>();
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        EmployeesModelConfiguration.Configure(modelBuilder);
        OrganizationModelConfiguration.Configure(modelBuilder);
    }
}
