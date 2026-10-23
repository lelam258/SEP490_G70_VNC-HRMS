namespace Vnc.HRMS.Models;
public sealed class PayslipDeduction
{
    public Guid PayslipDeductionId { get; set; }
    public Guid PayslipId { get; set; }
    public string DeductionType { get; set; } = string.Empty;
    public string DeductionName { get; set; } = string.Empty;
    public decimal CalculationBase { get; set; }
    public decimal? RatePercent { get; set; }
    public decimal Amount { get; set; }
    public string Payer { get; set; } = string.Empty;
    public Guid? ConfigReferenceId { get; set; }
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; }
}
