namespace Vnc.HRMS.Models;

public sealed class AttendanceImportRow
{
    public Guid Id { get; set; }
    public Guid ImportId { get; set; }
    public string SheetName { get; set; } = "";
    public int RowNumber { get; set; }
    public string EmployeeBlock { get; set; } = "";
    public string DeviceEnrollId { get; set; } = "";
    public Guid? StaffId { get; set; }
    public string RawDate { get; set; } = "";
    public string RawValuesJson { get; set; } = "[]";
    public DateOnly? WorkDate { get; set; }
    public string ShiftType { get; set; } = "main";
    public string TimePairsJson { get; set; } = "[]";
    public decimal? ReportedHours { get; set; }
    public decimal? ActualHours { get; set; }
    public decimal? LateMinutes { get; set; }
    public decimal? EarlyMinutes { get; set; }
    public string? AttendanceSymbol { get; set; }
    public string ValidationStatus { get; set; } = "error";
    public string? ErrorCode { get; set; }
    public string? ValidationNote { get; set; }
    public Guid? AttendanceId { get; set; }
    public string? CorrectionReason { get; set; }
    public Guid? CorrectedBy { get; set; }
    public DateTime? CorrectedAt { get; set; }
    public byte[] Version { get; set; } = [];
    public DateTime CreatedAt { get; set; }
}
