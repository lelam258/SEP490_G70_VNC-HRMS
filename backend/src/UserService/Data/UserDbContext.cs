using Microsoft.EntityFrameworkCore;
using Vnc.HRMS.UserService.Models;

namespace Vnc.HRMS.UserService.Data;

public sealed class UserDbContext(DbContextOptions<UserDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("users");
        var user = modelBuilder.Entity<User>();
        user.ToTable("users");
        user.HasKey(x => x.UserId);
        user.Property(x => x.UserId).HasColumnName("user_id").HasDefaultValueSql("NEWID()");
        user.Property(x => x.Username).HasColumnName("username").HasMaxLength(50);
        user.Property(x => x.FullName).HasColumnName("full_name").HasMaxLength(100);
        user.Property(x => x.Role).HasColumnName("role").HasMaxLength(30);
        user.Property(x => x.AccountStatus).HasColumnName("account_status").HasMaxLength(20).HasDefaultValue("active");
        user.Property(x => x.CreatedAt).HasColumnName("created_at").HasColumnType("datetime2(0)").HasDefaultValueSql("SYSUTCDATETIME()");
        user.Property(x => x.UpdatedAt).HasColumnName("updated_at").HasColumnType("datetime2(0)").HasDefaultValueSql("SYSUTCDATETIME()");
        user.HasIndex(x => x.Username).IsUnique();
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

