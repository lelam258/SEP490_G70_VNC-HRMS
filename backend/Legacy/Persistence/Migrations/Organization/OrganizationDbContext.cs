using Microsoft.EntityFrameworkCore;
using Vnc.HRMS.Models.Organization;
using Vnc.HRMS.Configurations.Entities;

namespace Vnc.HRMS.Persistence.Migrations.Organization;

public sealed class OrganizationDbContext(DbContextOptions<OrganizationDbContext> options) : TimestampDbContext(options)
{
    public DbSet<Department> Departments => Set<Department>();
    public DbSet<Position> Positions => Set<Position>();

    protected override void OnModelCreating(ModelBuilder modelBuilder) { modelBuilder.HasDefaultSchema("organization"); OrganizationModelConfiguration.Configure(modelBuilder); }
}
