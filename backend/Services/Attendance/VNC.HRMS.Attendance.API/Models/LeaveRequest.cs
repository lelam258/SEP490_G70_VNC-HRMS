namespace Vnc.HRMS.Models;
public sealed class LeaveRequest
{
    public Guid RequestId { get; set; }
    public Guid StaffId { get; set; }
    public Guid DepartmentId { get; set; }
    public string LeaveType { get; set; } = string.Empty;
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public decimal? TotalDays { get; set; }
    public string? Reason { get; set; }
    public string? AttachmentUrl { get; set; }
    public string? Status { get; set; }
    public Guid? ApprovedBy { get; set; }
    public DateTime? ApprovedAt { get; set; }
    public string? RejectedReason { get; set; }
    public DateTime? CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}
