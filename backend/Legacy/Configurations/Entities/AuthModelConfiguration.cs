using Microsoft.EntityFrameworkCore;
using Vnc.HRMS.Models.Auth;
namespace Vnc.HRMS.Configurations.Entities;
public static class AuthModelConfiguration
{
    public static void Configure(ModelBuilder modelBuilder)
    {
        var credential = modelBuilder.Entity<Credential>();
        credential.ToTable("credentials", "auth");
        credential.HasKey(x => x.UserId);
        credential.Property(x => x.UserId).HasColumnName("user_id").ValueGeneratedNever();
        credential.Property(x => x.PasswordHash).HasColumnName("password_hash").HasMaxLength(255);
        credential.Property(x => x.Version).HasColumnName("version").IsRowVersion();
        credential.Property(x => x.FailedLoginCount).HasColumnName("failed_login_count");
        credential.Property(x => x.LockedUntil).HasColumnName("locked_until").HasColumnType("datetime2(0)");
        credential.Property(x => x.LastLogin).HasColumnName("last_login").HasColumnType("datetime2(0)");
        credential.Property(x => x.CreatedAt).HasColumnName("created_at").HasColumnType("datetime2(0)").HasDefaultValueSql("SYSUTCDATETIME()");
        credential.Property(x => x.UpdatedAt).HasColumnName("updated_at").HasColumnType("datetime2(0)").HasDefaultValueSql("SYSUTCDATETIME()");
        var refreshtoken = modelBuilder.Entity<RefreshToken>();
        refreshtoken.ToTable("refresh_tokens", "auth");
        refreshtoken.HasKey(x => x.TokenId);
        refreshtoken.Property(x => x.TokenId).HasColumnName("token_id").HasDefaultValueSql("NEWID()");
        refreshtoken.Property(x => x.UserId).HasColumnName("user_id");
        refreshtoken.Property(x => x.AccountVersion).HasColumnName("account_version");
        refreshtoken.Property(x => x.TokenHash).HasColumnName("token_hash").HasMaxLength(255);
        refreshtoken.Property(x => x.DeviceInfo).HasColumnName("device_info").HasMaxLength(200);
        refreshtoken.Property(x => x.ExpiresAt).HasColumnName("expires_at").HasColumnType("datetime2(0)");
        refreshtoken.Property(x => x.Revoked).HasColumnName("revoked");
        refreshtoken.Property(x => x.RevokedAt).HasColumnName("revoked_at").HasColumnType("datetime2(0)");
        refreshtoken.Property(x => x.CreatedAt).HasColumnName("created_at").HasColumnType("datetime2(0)").HasDefaultValueSql("SYSUTCDATETIME()");
        refreshtoken.HasIndex(x => x.TokenHash).IsUnique();
        modelBuilder.Entity<RefreshToken>().HasOne<Credential>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        var reset = modelBuilder.Entity<PasswordResetToken>();
        reset.ToTable("password_reset_tokens", "auth");
        reset.HasKey(x => x.Id);
        reset.Property(x => x.Id).HasColumnName("id").ValueGeneratedNever();
        reset.Property(x => x.UserId).HasColumnName("user_id");
        reset.Property(x => x.TokenHash).HasColumnName("token_hash").HasMaxLength(64);
        reset.Property(x => x.PasswordStamp).HasColumnName("password_stamp").HasMaxLength(64);
        reset.Property(x => x.Email).HasColumnName("email").HasMaxLength(100);
        reset.Property(x => x.CreatedAt).HasColumnName("created_at").HasColumnType("datetime2(0)");
        reset.Property(x => x.ExpiresAt).HasColumnName("expires_at").HasColumnType("datetime2(0)");
        reset.Property(x => x.UsedAt).HasColumnName("used_at").HasColumnType("datetime2(0)");
        reset.Property(x => x.Attempts).HasColumnName("attempts");
        reset.Property(x => x.MaxAttempts).HasColumnName("max_attempts");
        reset.Property(x => x.CodeLength).HasColumnName("code_length");
        reset.HasIndex(x => x.TokenHash).IsUnique();
        reset.HasIndex(x => x.UserId);
        reset.HasOne<Credential>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
    }
}
