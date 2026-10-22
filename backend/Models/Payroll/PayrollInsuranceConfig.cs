namespace Vnc.HRMS.Models.Payroll;

public sealed class PayrollInsuranceConfig
{
    public Guid ConfigId { get; set; }
    public string InsuranceType { get; set; } = string.Empty; // BHXH | BHYT | BHTN
    public string Payer { get; set; } = string.Empty; // company | employee
    public decimal RatePercent { get; set; }
    public string AppliesTo { get; set; } = "all";
    public DateOnly EffectiveFrom { get; set; }
    public DateOnly? EffectiveTo { get; set; }
    public string Status { get; set; } = "active";
}
