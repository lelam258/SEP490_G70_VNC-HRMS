using Microsoft.EntityFrameworkCore;
using Vnc.HRMS.Configurations.Entities;
using Vnc.HRMS.Models.Auth;
using Vnc.HRMS.Models.Users;
using Vnc.HRMS.Models.Employees;
using Vnc.HRMS.Models.Organization;

namespace Vnc.HRMS.Persistence;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : TimestampDbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Credential> Credentials => Set<Credential>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<PasswordResetToken> PasswordResetTokens => Set<PasswordResetToken>();
    public DbSet<Staff> Staff => Set<Staff>();
    public DbSet<Contract> Contracts => Set<Contract>();
    public DbSet<Degree> Degrees => Set<Degree>();
    public DbSet<Department> Departments => Set<Department>();
    public DbSet<Position> Positions => Set<Position>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        AuthModelConfiguration.Configure(modelBuilder);
        UsersModelConfiguration.Configure(modelBuilder);
        EmployeesModelConfiguration.Configure(modelBuilder);
        OrganizationModelConfiguration.Configure(modelBuilder);
    }
}
