namespace Vnc.HRMS.Models;
public sealed class PayrollInsuranceConfig
{
    public Guid ConfigId { get; set; }
    public string InsuranceType { get; set; } = string.Empty;
    public string Payer { get; set; } = string.Empty;
    public decimal RatePercent { get; set; }
    public string? AppliesTo { get; set; }
    public DateOnly EffectiveFrom { get; set; }
    public DateOnly? EffectiveTo { get; set; }
    public string? Status { get; set; }
}
