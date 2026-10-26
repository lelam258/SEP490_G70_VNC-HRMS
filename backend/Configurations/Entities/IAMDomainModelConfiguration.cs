using Microsoft.EntityFrameworkCore;
using Vnc.HRMS.Models;
namespace Vnc.HRMS.Configurations.Entities;
public static class IAMDomainModelConfiguration
{
    public static void Configure(ModelBuilder modelBuilder)
    {
        {
            var entity = modelBuilder.Entity<AuditLog>(); entity.ToTable("audit_logs", "dbo");
            entity.Property(x => x.LogId).HasColumnName("log_id").HasColumnType("uniqueidentifier").HasDefaultValueSql("NEWID()");
            entity.Property(x => x.UserId).HasColumnName("user_id").HasColumnType("uniqueidentifier");
            entity.Property(x => x.Username).HasColumnName("username").HasColumnType("nvarchar(50)");
            entity.Property(x => x.Action).HasColumnName("action").HasColumnType("nvarchar(100)");
            entity.Property(x => x.EntityType).HasColumnName("entity_type").HasColumnType("nvarchar(50)");
            entity.Property(x => x.EntityId).HasColumnName("entity_id").HasColumnType("uniqueidentifier");
            entity.Property(x => x.OldValue).HasColumnName("old_value").HasColumnType("nvarchar(max)");
            entity.Property(x => x.NewValue).HasColumnName("new_value").HasColumnType("nvarchar(max)");
            entity.Property(x => x.IpAddress).HasColumnName("ip_address").HasColumnType("nvarchar(45)");
            entity.Property(x => x.UserAgent).HasColumnName("user_agent").HasColumnType("nvarchar(300)");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at").HasColumnType("datetime2(0)").HasDefaultValueSql("SYSUTCDATETIME()");
            entity.HasKey(x => x.LogId);
        }
        {
            var entity = modelBuilder.Entity<SystemPolicy>(); entity.ToTable("system_policies", "dbo");
            entity.Property(x => x.PolicyId).HasColumnName("policy_id").HasColumnType("uniqueidentifier").HasDefaultValueSql("NEWID()");
            entity.Property(x => x.PolicyKey).HasColumnName("policy_key").HasColumnType("nvarchar(100)");
            entity.HasIndex(x => x.PolicyKey).IsUnique();
            entity.Property(x => x.PolicyValue).HasColumnName("policy_value").HasColumnType("nvarchar(500)");
            entity.Property(x => x.ValueType).HasColumnName("value_type").HasColumnType("nvarchar(20)").HasDefaultValueSql("'string'");
            entity.Property(x => x.Description).HasColumnName("description").HasColumnType("nvarchar(max)");
            entity.Property(x => x.UpdatedBy).HasColumnName("updated_by").HasColumnType("uniqueidentifier");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at").HasColumnType("datetime2(0)").HasDefaultValueSql("SYSUTCDATETIME()");
            entity.HasKey(x => x.PolicyId);
        }
        modelBuilder.Entity<SystemPolicy>().HasOne<Vnc.HRMS.Models.Users.User>().WithMany().HasForeignKey(x => x.UpdatedBy).OnDelete(DeleteBehavior.Restrict);
    }
}
