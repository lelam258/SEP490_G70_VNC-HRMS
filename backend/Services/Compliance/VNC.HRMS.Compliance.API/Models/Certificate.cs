namespace Vnc.HRMS.Models;
public sealed class Certificate
{
    public Guid CertificateId { get; set; }
    public Guid StaffId { get; set; }
    public Guid? DepartmentId { get; set; }
    public string? CertificateNumber { get; set; }
    public string CertificateType { get; set; } = string.Empty;
    public string? IssuingAuthority { get; set; }
    public DateOnly? IssueDate { get; set; }
    public DateOnly? ExpiryDate { get; set; }
    public string? ScopeOfPractice { get; set; }
    public int? CmeCycleMonths { get; set; }
    public decimal? CmeRequiredCredits { get; set; }
    public string? Status { get; set; }
    public string? FileUrl { get; set; }
    public Guid? UploadedBy { get; set; }
    public DateTime? CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}
