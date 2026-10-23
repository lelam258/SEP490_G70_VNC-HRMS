namespace Vnc.HRMS.Models;
public sealed class Complaint
{
    public Guid ComplaintId { get; set; }
    public Guid StaffId { get; set; }
    public Guid? DepartmentId { get; set; }
    public Guid? PayslipId { get; set; }
    public string InquiryType { get; set; } = string.Empty;
    public string Subject { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string? Response { get; set; }
    public Guid? RepliedBy { get; set; }
    public DateTime? RepliedAt { get; set; }
    public string? Status { get; set; }
    public DateTime? SubmittedAt { get; set; }
    public DateTime? ResolvedAt { get; set; }
}
