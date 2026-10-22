namespace Vnc.HRMS.Models;
public sealed class AttendanceRecord
{
    public Guid AttendanceId { get; set; }
    public Guid StaffId { get; set; }
    public string StaffCode { get; set; } = string.Empty;
    public Guid? DepartmentId { get; set; }
    public Guid? ImportId { get; set; }
    public Guid? OnCallShiftId { get; set; }
    public DateOnly WorkDate { get; set; }
    public string? ShiftType { get; set; }
    public DateTime? CheckIn { get; set; }
    public DateTime? CheckOut { get; set; }
    public decimal? ActualHours { get; set; }
    public string? Source { get; set; }
    public string? ValidationStatus { get; set; }
    public string? Note { get; set; }
    public Guid? ReconciledBy { get; set; }
    public DateTime? ReconciledAt { get; set; }
    public string? ReconcileNote { get; set; }
    public Guid? ConfirmedBy { get; set; }
    public DateTime? ConfirmedAt { get; set; }
    public Guid? PayslipId { get; set; }
    public DateTime? CreatedAt { get; set; }
}
