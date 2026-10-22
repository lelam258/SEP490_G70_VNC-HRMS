namespace Vnc.HRMS.Models.Payroll;

public sealed class PayrollTaxBracket
{
    public Guid BracketId { get; set; }
    public decimal IncomeFrom { get; set; }
    public decimal? IncomeTo { get; set; }
    public decimal TaxRatePercent { get; set; }
    public DateOnly EffectiveFrom { get; set; }
    public DateOnly? EffectiveTo { get; set; }
    public string Status { get; set; } = "active";
}
