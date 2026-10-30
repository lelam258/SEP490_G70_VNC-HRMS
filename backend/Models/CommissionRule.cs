namespace Vnc.HRMS.Models;

public sealed class CommissionRule
{
    public Guid RuleId { get; set; }
    public Guid? ServiceId { get; set; }
    public string? ServiceCategory { get; set; }
    public Guid? PositionId { get; set; }
    public string Role { get; set; } = string.Empty;
    public string ValueType { get; set; } = string.Empty;
    public string TimeCondition { get; set; } = "all";
    public decimal CommissionValue { get; set; }
    public DateOnly EffectiveFrom { get; set; }
    public DateOnly? EffectiveTo { get; set; }
    public string? Status { get; set; }
    public Guid? CreatedBy { get; set; }
    public DateTime? CreatedAt { get; set; }
}
