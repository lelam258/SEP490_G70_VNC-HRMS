namespace Vnc.HRMS.Models;
public sealed class CmeCycle
{
    public Guid CycleId { get; set; }
    public Guid CertificateId { get; set; }
    public int CycleNumber { get; set; }
    public DateOnly CycleStart { get; set; }
    public DateOnly CycleEnd { get; set; }
    public decimal RequiredCredits { get; set; }
    public decimal? EarnedCredits { get; set; }
    public string? Status { get; set; }
}
