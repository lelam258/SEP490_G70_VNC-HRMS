namespace Vnc.HRMS.Models;
public sealed class Notification
{
    public Guid NotificationId { get; set; }
    public Guid RecipientId { get; set; }
    public string SenderService { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string? Body { get; set; }
    public string? ActionUrl { get; set; }
    public string? EntityType { get; set; }
    public Guid? EntityId { get; set; }
    public string? Channel { get; set; }
    public bool? IsRead { get; set; }
    public DateTime? ReadAt { get; set; }
    public DateTime? CreatedAt { get; set; }
}
