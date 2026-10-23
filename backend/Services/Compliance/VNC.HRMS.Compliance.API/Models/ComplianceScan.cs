namespace Vnc.HRMS.Models;
public sealed class ComplianceScan
{
    public Guid ScanId { get; set; }
    public Guid StaffId { get; set; }
    public Guid? DepartmentId { get; set; }
    public Guid? CertificateId { get; set; }
    public DateTime? ScanDate { get; set; }
    public DateOnly? ExpiryDate { get; set; }
    public int? DaysRemaining { get; set; }
    public decimal? CmeCreditsEarned { get; set; }
    public decimal? CmeCreditsNeeded { get; set; }
    public string ComplianceStatus { get; set; } = string.Empty;
    public bool? AlertSent { get; set; }
    public DateTime? AlertSentAt { get; set; }
}
