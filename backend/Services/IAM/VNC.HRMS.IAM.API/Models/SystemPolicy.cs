namespace Vnc.HRMS.Models;
public sealed class SystemPolicy
{
    public Guid PolicyId { get; set; }
    public string PolicyKey { get; set; } = string.Empty;
    public string PolicyValue { get; set; } = string.Empty;
    public string? ValueType { get; set; }
    public string? Description { get; set; }
    public Guid? UpdatedBy { get; set; }
    public DateTime? UpdatedAt { get; set; }
}
