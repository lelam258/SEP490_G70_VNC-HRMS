using Microsoft.EntityFrameworkCore;

namespace Vnc.HRMS.Persistence;

public abstract class TimestampDbContext(DbContextOptions options) : DbContext(options)
{
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
        foreach (var entry in ChangeTracker.Entries().Where(e => e.State is EntityState.Added or EntityState.Modified)) {
            if (entry.Metadata.FindProperty("UpdatedAt") is not null) entry.Property("UpdatedAt").CurrentValue = now;
            if (entry.Metadata.FindProperty("CreatedAt") is null) continue;
            if (entry.State == EntityState.Added) entry.Property("CreatedAt").CurrentValue = now;
            else entry.Property("CreatedAt").IsModified = false;
        }
    }
}
