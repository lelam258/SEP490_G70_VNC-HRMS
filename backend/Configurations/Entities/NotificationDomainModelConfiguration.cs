using Microsoft.EntityFrameworkCore;
using Vnc.HRMS.Models;
namespace Vnc.HRMS.Configurations.Entities;
public static class NotificationDomainModelConfiguration
{
    public static void Configure(ModelBuilder modelBuilder)
    {
        {
            var entity = modelBuilder.Entity<Notification>(); entity.ToTable("notifications", "dbo");
            entity.Property(x => x.NotificationId).HasColumnName("notification_id").HasColumnType("uniqueidentifier").HasDefaultValueSql("NEWID()");
            entity.Property(x => x.RecipientId).HasColumnName("recipient_id").HasColumnType("uniqueidentifier");
            entity.Property(x => x.SenderService).HasColumnName("sender_service").HasColumnType("nvarchar(50)");
            entity.Property(x => x.Type).HasColumnName("type").HasColumnType("nvarchar(50)");
            entity.Property(x => x.Title).HasColumnName("title").HasColumnType("nvarchar(200)");
            entity.Property(x => x.Body).HasColumnName("body").HasColumnType("nvarchar(max)");
            entity.Property(x => x.ActionUrl).HasColumnName("action_url").HasColumnType("nvarchar(500)");
            entity.Property(x => x.EntityType).HasColumnName("entity_type").HasColumnType("nvarchar(50)");
            entity.Property(x => x.EntityId).HasColumnName("entity_id").HasColumnType("uniqueidentifier");
            entity.Property(x => x.Channel).HasColumnName("channel").HasColumnType("nvarchar(20)").HasDefaultValueSql("'in_app'");
            entity.Property(x => x.IsRead).HasColumnName("is_read").HasColumnType("bit").HasDefaultValueSql("0");
            entity.Property(x => x.ReadAt).HasColumnName("read_at").HasColumnType("datetime2(0)");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at").HasColumnType("datetime2(0)").HasDefaultValueSql("SYSUTCDATETIME()");
            entity.HasKey(x => x.NotificationId);
        }
        modelBuilder.Entity<Notification>().HasIndex(x => new { x.RecipientId, x.IsRead, x.CreatedAt }).HasDatabaseName("IX_notifications_recipient_unread").IsDescending(false, false, true);
    }
}
