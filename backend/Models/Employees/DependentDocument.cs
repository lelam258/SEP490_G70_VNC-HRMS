namespace Vnc.HRMS.Models.Employees;

public sealed class DependentDocument
{
    public Guid DocumentId { get; set; }
    public Guid StaffDependentId { get; set; }
    public string DocumentType { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
    public string? FileUrl { get; set; }
    public string VerificationStatus { get; set; } = "pending";
    public DateTime UploadedAt { get; set; }
    public Guid? VerifiedBy { get; set; }
}
