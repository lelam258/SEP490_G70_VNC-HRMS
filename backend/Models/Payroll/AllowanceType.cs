namespace Vnc.HRMS.Models.Payroll;

public sealed class AllowanceType
{
    public Guid AllowanceId { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string ValueType { get; set; } = "fixed"; // fixed (cố định) | percentage (phần trăm)
    public decimal? DefaultValue { get; set; }
    public string AppliesTo { get; set; } = "all"; // all, department, position
    public bool IsTaxable { get; set; }
    public bool IsInsuranceBasis { get; set; }
    public string Status { get; set; } = "active";
    public DateTime CreatedAt { get; set; }
}
