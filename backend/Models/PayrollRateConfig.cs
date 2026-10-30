namespace Vnc.HRMS.Models;

public sealed class PayrollRateConfig
{
    public Guid ConfigId { get; set; }
    public string Code { get; set; } = string.Empty;
    public Guid? PositionId { get; set; }
    public Guid? StaffId { get; set; }
    public decimal Value { get; set; }
    public string Unit { get; set; } = string.Empty;
    public string? Description { get; set; }
    public DateOnly EffectiveFrom { get; set; }
    public DateOnly? EffectiveTo { get; set; }
    public string Status { get; set; } = "active";
    public Guid? CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
