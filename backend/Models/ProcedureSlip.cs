namespace Vnc.HRMS.Models;

public sealed class ProcedureSlip
{
    public Guid SlipId { get; set; }
    public Guid ServiceId { get; set; }
    public Guid? DepartmentId { get; set; }
    public string SlipNumber { get; set; } = string.Empty;
    public DateOnly ProcedureDate { get; set; }
    public string? PatientCode { get; set; }
    public decimal? ChargedAmount { get; set; }
    public decimal? DirectCost { get; set; }
    public bool IsAfterHours { get; set; }
    public decimal? DurationHours { get; set; }
    public Guid? IndicatingStaffId { get; set; }
    public string? Status { get; set; }
    public Guid? RecordedBy { get; set; }
    public Guid? VerifiedBy { get; set; }
    public DateTime? VerifiedAt { get; set; }
    public string? RejectedReason { get; set; }
    public DateTime? CreatedAt { get; set; }
}
