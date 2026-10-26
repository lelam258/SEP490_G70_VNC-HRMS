using Microsoft.EntityFrameworkCore;
using Vnc.HRMS.Models.Auth;
namespace Vnc.HRMS.Configurations.Entities;
public static class AuthModelConfiguration
{
    public static void Configure(ModelBuilder modelBuilder)
    {
        var refreshtoken = modelBuilder.Entity<RefreshToken>();
        refreshtoken.ToTable("refresh_tokens", "dbo");
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
        modelBuilder.Entity<RefreshToken>().HasOne<Vnc.HRMS.Models.Users.User>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        var reset = modelBuilder.Entity<PasswordResetToken>();
        reset.ToTable("password_reset_tokens", "dbo");
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
        reset.HasOne<Vnc.HRMS.Models.Users.User>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
    }
}
