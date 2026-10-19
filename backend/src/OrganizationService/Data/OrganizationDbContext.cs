using Microsoft.EntityFrameworkCore;
using Vnc.HRMS.OrganizationService.Models;

namespace Vnc.HRMS.OrganizationService.Data;

public sealed class OrganizationDbContext(DbContextOptions<OrganizationDbContext> options) : DbContext(options)
{
    public DbSet<Department> Departments => Set<Department>();
    public DbSet<Position> Positions => Set<Position>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("organization");
        var department = modelBuilder.Entity<Department>();
        department.ToTable("departments");
        department.HasKey(x => x.DepartmentId);
        department.Property(x => x.DepartmentId).HasColumnName("department_id").HasDefaultValueSql("NEWID()");
        department.Property(x => x.DeptCode).HasColumnName("dept_code").HasMaxLength(20);
        department.Property(x => x.Name).HasColumnName("name").HasMaxLength(100);
        department.Property(x => x.ManagerId).HasColumnName("manager_id");
        department.Property(x => x.Status).HasColumnName("status").HasMaxLength(20).HasDefaultValue("active");
        department.Property(x => x.CreatedAt).HasColumnName("created_at").HasColumnType("datetime2(0)").HasDefaultValueSql("SYSUTCDATETIME()");
        department.Property(x => x.UpdatedAt).HasColumnName("updated_at").HasColumnType("datetime2(0)").HasDefaultValueSql("SYSUTCDATETIME()");
        department.HasIndex(x => x.DeptCode).IsUnique();
        department.HasIndex(x => x.Name).IsUnique();
        var position = modelBuilder.Entity<Position>();
        position.ToTable("positions");
        position.HasKey(x => x.PositionId);
        position.Property(x => x.PositionId).HasColumnName("position_id").HasDefaultValueSql("NEWID()");
        position.Property(x => x.Name).HasColumnName("name").HasMaxLength(100);
        position.Property(x => x.ScopeTag).HasColumnName("scope_tag").HasMaxLength(50);
        position.Property(x => x.Status).HasColumnName("status").HasMaxLength(20).HasDefaultValue("active");
        position.HasIndex(x => x.Name).IsUnique();
    }

    public override int SaveChanges(bool acceptAllChangesOnSuccess)
    {
        UpdateTimestamps();
        return base.SaveChanges(acceptAllChangesOnSuccess);
    }

    public override Task<int> SaveChangesAsync(bool acceptAllChangesOnSuccess, CancellationToken cancellationToken = default)
    {
        UpdateTimestamps();
        return base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken);
    }

    private void UpdateTimestamps()
    {
        var now = DateTime.UtcNow;
        foreach (var entry in ChangeTracker.Entries().Where(e => e.State is EntityState.Added or EntityState.Modified))
        {
            if (entry.Metadata.FindProperty("UpdatedAt") is not null)
                entry.Property("UpdatedAt").CurrentValue = now;
            if (entry.Metadata.FindProperty("CreatedAt") is not null)
            {
                if (entry.State == EntityState.Added)
                    entry.Property("CreatedAt").CurrentValue = now;
                else
                    entry.Property("CreatedAt").IsModified = false;
            }
        }
    }
}

