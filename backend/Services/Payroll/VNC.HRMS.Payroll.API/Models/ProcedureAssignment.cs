namespace Vnc.HRMS.Models;
public sealed class ProcedureAssignment
{
    public Guid AssignmentId { get; set; }
    public Guid SlipId { get; set; }
    public Guid StaffId { get; set; }
    public string Role { get; set; } = string.Empty;
    public Guid? RuleId { get; set; }
    public decimal? CommissionAmount { get; set; }
    public Guid? PayslipId { get; set; }
    public string? Status { get; set; }
}
