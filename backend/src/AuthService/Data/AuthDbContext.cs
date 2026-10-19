using Microsoft.EntityFrameworkCore;
using Vnc.HRMS.AuthService.Models;

namespace Vnc.HRMS.AuthService.Data;

public sealed class AuthDbContext(DbContextOptions<AuthDbContext> options) : DbContext(options)
{
    public DbSet<Credential> Credentials => Set<Credential>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("auth");
        var credential = modelBuilder.Entity<Credential>();
        credential.ToTable("credentials");
        credential.HasKey(x => x.UserId);
        credential.Property(x => x.UserId).HasColumnName("user_id").ValueGeneratedNever();
        credential.Property(x => x.PasswordHash).HasColumnName("password_hash").HasMaxLength(255);
        credential.Property(x => x.FailedLoginCount).HasColumnName("failed_login_count");
        credential.Property(x => x.LockedUntil).HasColumnName("locked_until").HasColumnType("datetime2(0)");
        credential.Property(x => x.LastLogin).HasColumnName("last_login").HasColumnType("datetime2(0)");
        credential.Property(x => x.CreatedAt).HasColumnName("created_at").HasColumnType("datetime2(0)").HasDefaultValueSql("SYSUTCDATETIME()");
        credential.Property(x => x.UpdatedAt).HasColumnName("updated_at").HasColumnType("datetime2(0)").HasDefaultValueSql("SYSUTCDATETIME()");
        var refreshtoken = modelBuilder.Entity<RefreshToken>();
        refreshtoken.ToTable("refresh_tokens");
        refreshtoken.HasKey(x => x.TokenId);
        refreshtoken.Property(x => x.TokenId).HasColumnName("token_id").HasDefaultValueSql("NEWID()");
        refreshtoken.Property(x => x.UserId).HasColumnName("user_id");
        refreshtoken.Property(x => x.TokenHash).HasColumnName("token_hash").HasMaxLength(255);
        refreshtoken.Property(x => x.DeviceInfo).HasColumnName("device_info").HasMaxLength(200);
        refreshtoken.Property(x => x.ExpiresAt).HasColumnName("expires_at").HasColumnType("datetime2(0)");
        refreshtoken.Property(x => x.Revoked).HasColumnName("revoked");
        refreshtoken.Property(x => x.RevokedAt).HasColumnName("revoked_at").HasColumnType("datetime2(0)");
        refreshtoken.Property(x => x.CreatedAt).HasColumnName("created_at").HasColumnType("datetime2(0)").HasDefaultValueSql("SYSUTCDATETIME()");
        refreshtoken.HasIndex(x => x.TokenHash).IsUnique();
        modelBuilder.Entity<RefreshToken>().HasOne<Credential>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
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

