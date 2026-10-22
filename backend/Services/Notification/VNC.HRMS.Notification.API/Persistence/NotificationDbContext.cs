using Microsoft.EntityFrameworkCore;
using Vnc.HRMS.Configurations.Entities;
using Vnc.HRMS.Models;
namespace Vnc.HRMS.Persistence;
public sealed class NotificationDbContext(DbContextOptions<NotificationDbContext> options) : TimestampDbContext(options)
{
    public DbSet<Notification> Notifications => Set<Notification>();
    protected override void OnModelCreating(ModelBuilder modelBuilder) => DomainModelConfiguration.Configure(modelBuilder);
}
