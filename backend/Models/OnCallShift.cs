namespace Vnc.HRMS.Models;
public sealed class OnCallShift
{
    public Guid ShiftId { get; set; }
    public Guid StaffId { get; set; }
    public Guid DepartmentId { get; set; }
    public DateOnly ShiftDate { get; set; }
    public string ShiftCategory { get; set; } = string.Empty;
    public DateTime? ShiftStart { get; set; }
    public DateTime? ShiftEnd { get; set; }
    public Guid RecordedBy { get; set; }
    public Guid? ConfirmedBy { get; set; }
    public DateTime? ConfirmedAt { get; set; }
    public string? Status { get; set; }
    public string? RejectedReason { get; set; }
    public string? Note { get; set; }
    public DateTime? CreatedAt { get; set; }
    public Guid? FacilityId { get; set; }
    public Guid? ScheduleAssignmentId { get; set; }
    public Guid? AttendanceEvidenceId { get; set; }
    public string? SupervisorEvidence { get; set; }
    public string? DeviationReason { get; set; }
    public string? ReviewNote { get; set; }
    public byte[] Version { get; set; } = [];
    public DateTime UpdatedAt { get; set; }
}
