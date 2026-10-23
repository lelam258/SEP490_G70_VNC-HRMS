namespace Vnc.HRMS.Models;
public sealed class StaffAllowance
{
    public Guid StaffAllowanceId { get; set; }
    public Guid StaffId { get; set; }
    public Guid AllowanceId { get; set; }
    public string ValueType { get; set; } = string.Empty;
    public decimal AmountValue { get; set; }
    public DateOnly EffectiveFrom { get; set; }
    public DateOnly? EffectiveTo { get; set; }
    public string Status { get; set; } = string.Empty;
    public Guid? ApprovedBy { get; set; }
    public DateTime CreatedAt { get; set; }
}
