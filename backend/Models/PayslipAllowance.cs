namespace Vnc.HRMS.Models;
public sealed class PayslipAllowance
{
    public Guid Id { get; set; }
    public Guid PayslipId { get; set; }
    public Guid? AllowanceId { get; set; }
    public string Name { get; set; } = string.Empty;
    public decimal Amount { get; set; }
}
