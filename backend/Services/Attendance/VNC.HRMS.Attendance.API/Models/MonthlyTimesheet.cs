namespace Vnc.HRMS.Models;
public sealed class MonthlyTimesheet
{
    public Guid TimesheetId { get; set; }
    public string PayMonth { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public Guid? LockedBy { get; set; }
    public DateTime? LockedAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
