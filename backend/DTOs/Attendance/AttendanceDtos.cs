using System.ComponentModel.DataAnnotations;

namespace Vnc.HRMS.DTOs.Attendance;

public sealed record AttendanceTimePair(DateTime? In, DateTime? Out);
public sealed record TimePairInput(string? In, string? Out);
public sealed record CorrectImportRowRequest(Guid StaffId, DateOnly WorkDate, string ShiftType,
    TimePairInput[] Pairs, [Required, StringLength(1000)] string Reason, [Required] string Version);
public sealed record CommitImportRequest([Required] string Version, bool IncludeWarnings = false);
public sealed record ExcludeImportRowRequest([Required, StringLength(1000)] string Reason, [Required] string Version);
public sealed record SaveOnCallRequest(Guid StaffId, Guid FacilityId, DateOnly Date, string Category,
    string Start, string End, string? Note, string? DeviationReason, string? SupervisorEvidence,
    Guid? AttendanceEvidenceId, string? Version);

public sealed class AttendanceFilter
{
    public string? Month { get; set; }
    public Guid? FacilityId { get; set; }
    public Guid? DepartmentId { get; set; }
    public Guid? StaffId { get; set; }
    public string? Search { get; set; }
    public string? Status { get; set; }
    public string? Source { get; set; }
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 20;
}

public sealed record AttendanceItem(Guid Id, Guid StaffId, string StaffCode, string StaffName,
    Guid? DepartmentId, string? DepartmentName, Guid? FacilityId, string? FacilityName,
    DateOnly WorkDate, string? ShiftType, DateTime? CheckIn, DateTime? CheckOut, decimal? ActualHours,
    string? Source, string? Status, Guid? ImportId, Guid? OnCallShiftId);

public sealed record AuditFilter(DateOnly? From = null, DateOnly? To = null, string? Module = null,
    Guid? UserId = null, string? Action = null, Guid? FacilityId = null, Guid? DepartmentId = null,
    Guid? StaffId = null, string? Month = null, int Page = 1, int PageSize = 20);

public sealed record ChangeAccountStatusRequest([Required] string Status, [Required] string Version);
public sealed record ChangeAccountRoleRequest([Required] string Role, [Required] string Version);

public sealed class AttendanceUploadForm
{
    [Required] public IFormFile File { get; set; } = null!;
    public Guid FacilityId { get; set; }
    [Required] public string Month { get; set; } = "";
    public string? DeviceSource { get; set; }
    public string? ColumnMapping { get; set; }
    public string? DateOrder { get; set; }
}
