namespace Vnc.HRMS.Models;
public sealed class AuditLog
{
    public Guid LogId { get; set; }
    public Guid? UserId { get; set; }
    public string? Username { get; set; }
    public string Action { get; set; } = string.Empty;
    public string? EntityType { get; set; }
    public Guid? EntityId { get; set; }
    public string? OldValue { get; set; }
    public string? NewValue { get; set; }
    public string? IpAddress { get; set; }
    public string? UserAgent { get; set; }
    public DateTime? CreatedAt { get; set; }
    public string Module { get; set; } = "system";
    public string Result { get; set; } = "success";
    public Guid? FacilityId { get; set; }
    public Guid? DepartmentId { get; set; }
    public Guid? StaffId { get; set; }
    public DateOnly? WorkDate { get; set; }
}
