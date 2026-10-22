namespace Vnc.HRMS.Models;
public sealed class CmeRecord
{
    public Guid CmeId { get; set; }
    public Guid CertificateId { get; set; }
    public Guid? CmeCycleId { get; set; }
    public string CourseName { get; set; } = string.Empty;
    public string? Provider { get; set; }
    public DateOnly CompletedDate { get; set; }
    public decimal Credits { get; set; }
    public string? FileUrl { get; set; }
    public bool? Verified { get; set; }
    public Guid? VerifiedBy { get; set; }
    public DateTime? VerifiedAt { get; set; }
    public DateTime? CreatedAt { get; set; }
}
