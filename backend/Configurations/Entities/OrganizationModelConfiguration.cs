using Microsoft.EntityFrameworkCore;
using Vnc.HRMS.Models;
using Vnc.HRMS.Models.Organization;
namespace Vnc.HRMS.Configurations.Entities;
public static class OrganizationModelConfiguration
{
    public static void Configure(ModelBuilder modelBuilder)
    {
        var department = modelBuilder.Entity<Department>();
        department.ToTable("departments", "dbo");
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
        department.HasOne<Vnc.HRMS.Models.Employees.Staff>().WithMany().HasForeignKey(x => x.ManagerId).OnDelete(DeleteBehavior.Restrict);
        var position = modelBuilder.Entity<Position>();
        position.ToTable("positions", "dbo");
        position.HasKey(x => x.PositionId);
        position.Property(x => x.PositionId).HasColumnName("position_id").HasDefaultValueSql("NEWID()");
        position.Property(x => x.Name).HasColumnName("name").HasMaxLength(100);
        position.Property(x => x.ScopeTag).HasColumnName("scope_tag").HasMaxLength(50);
        position.Property(x => x.Status).HasColumnName("status").HasMaxLength(20).HasDefaultValue("active");
        position.HasIndex(x => x.Name).IsUnique();

        var site = modelBuilder.Entity<Site>();
        site.ToTable("sites", "dbo");
        site.HasKey(x => x.SiteId);
        site.Property(x => x.SiteId).HasColumnName("site_id").HasDefaultValueSql("NEWID()");
        site.Property(x => x.SiteCode).HasColumnName("site_code").HasMaxLength(20);
        site.Property(x => x.Name).HasColumnName("name").HasMaxLength(100);
        site.Property(x => x.Address).HasColumnName("address").HasMaxLength(255);
        site.Property(x => x.Status).HasColumnName("status").HasMaxLength(20).HasDefaultValue("active");
        site.HasIndex(x => x.SiteCode).IsUnique();
    }
}
