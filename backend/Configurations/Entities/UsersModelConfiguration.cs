using Microsoft.EntityFrameworkCore;
using Vnc.HRMS.Models.Users;
namespace Vnc.HRMS.Configurations.Entities;
public static class UsersModelConfiguration
{
    public static void Configure(ModelBuilder modelBuilder)
    {
        var user = modelBuilder.Entity<User>();
        user.ToTable("users", "dbo");
        user.HasKey(x => x.UserId);
        user.Property(x => x.PasswordHash).HasColumnName("password_hash").HasMaxLength(255);
        user.Property(x => x.FailedLoginCount).HasColumnName("failed_login_count").HasDefaultValue(0);
        user.Property(x => x.LockedUntil).HasColumnName("locked_until").HasColumnType("datetime2(0)");
        user.Property(x => x.LastLogin).HasColumnName("last_login").HasColumnType("datetime2(0)");
        user.Property(x => x.UserId).HasColumnName("user_id").HasDefaultValueSql("NEWID()");
        user.Property(x => x.Username).HasColumnName("username").HasMaxLength(50);
        user.Property(x => x.FullName).HasColumnName("full_name").HasMaxLength(100);
        user.Property(x => x.Role).HasColumnName("role").HasMaxLength(30);
        user.Property(x => x.AccountStatus).HasColumnName("account_status").HasMaxLength(20).HasDefaultValue("active");
        user.Property(x => x.CreatedAt).HasColumnName("created_at").HasColumnType("datetime2(0)").HasDefaultValueSql("SYSUTCDATETIME()");
        user.Property(x => x.UpdatedAt).HasColumnName("updated_at").HasColumnType("datetime2(0)").HasDefaultValueSql("SYSUTCDATETIME()");
        user.HasIndex(x => x.Username).IsUnique();
        user.Property(x => x.NormalizedUsername).HasColumnName("normalized_username").HasMaxLength(50);
        user.HasIndex(x => x.NormalizedUsername).IsUnique();
        user.Property(x => x.Email).HasColumnName("email").HasMaxLength(100);
        user.HasIndex(x => x.Email).IsUnique();
        user.Ignore(x => x.EmployeeId);
        user.Property(x => x.IsProvisioned).HasColumnName("is_provisioned");
        user.Property(x => x.SecurityVersion).HasColumnName("security_version");
        user.Property(x => x.Version).HasColumnName("version").IsRowVersion();
    }
}
