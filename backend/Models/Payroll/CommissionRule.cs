namespace Vnc.HRMS.Models.Payroll;

public sealed class CommissionRule
{
    public Guid RuleId { get; set; }
    public Guid ServiceId { get; set; }
    public string Role { get; set; } = string.Empty; // primary_doctor, assistant, technician...
    public string ValueType { get; set; } = "fixed"; // fixed | percentage
    public decimal CommissionValue { get; set; }
    public DateOnly EffectiveFrom { get; set; }
    public DateOnly? EffectiveTo { get; set; }
    public string Status { get; set; } = "active";
    public Guid? CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; }
}
