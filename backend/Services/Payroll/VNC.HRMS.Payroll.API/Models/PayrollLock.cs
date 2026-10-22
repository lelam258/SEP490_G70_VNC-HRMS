namespace Vnc.HRMS.Models;
public sealed class PayrollLock
{
    public Guid LockId { get; set; }
    public string PayMonth { get; set; } = string.Empty;
    public string? Status { get; set; }
    public Guid? LockedBy { get; set; }
    public DateTime? LockedAt { get; set; }
    public Guid? ExportedBy { get; set; }
    public DateTime? ExportedAt { get; set; }
    public string? ExportFileUrl { get; set; }
    public DateTime? CreatedAt { get; set; }
}
