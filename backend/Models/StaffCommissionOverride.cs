namespace Vnc.HRMS.Models;

public sealed class StaffCommissionOverride
{
    public Guid OverrideId { get; set; }
    public Guid StaffId { get; set; }
    public Guid? ServiceId { get; set; }
    public string? ServiceCategory { get; set; }
    public string Role { get; set; } = string.Empty;
    public string ValueType { get; set; } = string.Empty;
    public string TimeCondition { get; set; } = "all";
    public decimal CommissionValue { get; set; }
    public DateOnly EffectiveFrom { get; set; }
    public DateOnly? EffectiveTo { get; set; }
    public string Status { get; set; } = "active";
    public Guid? CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

