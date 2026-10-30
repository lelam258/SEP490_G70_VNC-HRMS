namespace Vnc.HRMS.Models;

public sealed class AllowanceType
{
    public Guid AllowanceId { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string ValueType { get; set; } = string.Empty;
    public decimal? DefaultValue { get; set; }
    public string? AppliesTo { get; set; }
    public string DefaultCalcMethod { get; set; } = "fixed";
    public int? MinServiceYears { get; set; }
    public bool? IsTaxable { get; set; }
    public bool? IsInsuranceBasis { get; set; }
    public string? Status { get; set; }
    public DateTime? CreatedAt { get; set; }
}
