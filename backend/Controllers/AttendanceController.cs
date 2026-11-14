using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Vnc.HRMS.Common.Exceptions;
using Vnc.HRMS.DTOs.Attendance;
using Vnc.HRMS.Services;

namespace Vnc.HRMS.Controllers;

[ApiController, Authorize, Route("api/attendance")]
public sealed class AttendanceController(AttendanceService legacy, AttendanceRecordService records,
    AttendanceImportService imports, OnCallService onCall, AuditViewerService audit) : ControllerBase
{
    private const string Readers = "admin,hr_manager,hr_staff,department_head,employee";
    private const string ImportReaders = "admin,hr_manager,hr_staff";
    private const string HistoryReaders = "admin,hr_manager,hr_staff,department_head,accountant";

    [HttpGet("options"), Authorize(Roles = Readers + ",accountant")]
    public Task<object> Options(CancellationToken ct) => records.Options(User, ct);
    [HttpGet("records"), Authorize(Roles = Readers)]
    public Task<object> Records([FromQuery] AttendanceFilter filter, CancellationToken ct) => records.List(User, filter, ct);
    [HttpGet("records/{id:guid}"), Authorize(Roles = Readers)]
    public Task<object> Record(Guid id, CancellationToken ct) => records.Detail(User, id, ct);
    [HttpGet("manual-context"), Authorize]
    public Task<object> ManualContext(Guid staffId, Guid facilityId, DateOnly date, CancellationToken ct)
        => records.ManualContext(User, staffId, facilityId, date, ct);
    [HttpPost("records/manual"), Authorize]
    public Task<object> CreateManual(CreateManualAttendanceRequest request, CancellationToken ct)
        => records.CreateManual(User, request, ct);
    [HttpPost("records/{id:guid}/reconcile"), Authorize]
    public Task<object> Reconcile(Guid id, ReconcileAttendanceRequest request, CancellationToken ct)
        => records.Reconcile(User, id, request, ct);
    [HttpPost("records/{id:guid}/verify"), Authorize]
    public Task<object> Verify(Guid id, VerifyAttendanceRequest request, CancellationToken ct)
        => records.Verify(User, id, request, ct);

    [HttpGet("imports"), Authorize(Roles = ImportReaders)]
    public Task<object> Imports(string? month, Guid? facilityId, CancellationToken ct, int page = 1, int pageSize = 20)
        => imports.List(month, facilityId, page, pageSize, ct);
    [HttpPost("imports"), Authorize(Roles = "hr_staff"), RequestSizeLimit(11 * 1024 * 1024)]
    public async Task<object> Import([FromForm] AttendanceUploadForm request, CancellationToken ct)
    {
        var file = request.File;
        if (file.Length <= 0 || file.Length > AttendanceWorkbookParser.MaximumFileBytes) throw new AppException(400, "Tệp chấm công tối đa 10 MB.");
        await using var stream = new MemoryStream();
        await file.CopyToAsync(stream, ct);
        return await imports.Stage(User, file.FileName, stream.ToArray(), request.FacilityId, request.Month, request.DeviceSource, request.ColumnMapping, ct, request.DateOrder);
    }
    [HttpPost("imports/analyze"), Authorize(Roles = "hr_staff"), RequestSizeLimit(11 * 1024 * 1024)]
    public async Task<object> Analyze([FromForm] AttendanceUploadForm request, CancellationToken ct,
        string? status = null, string? errorCode = null, int page = 1, int pageSize = 20)
    {
        var file = request.File;
        if (file.Length <= 0 || file.Length > AttendanceWorkbookParser.MaximumFileBytes) throw new AppException(400, "Tệp chấm công tối đa 10 MB.");
        await using var stream = new MemoryStream();
        await file.CopyToAsync(stream, ct);
        return await imports.Analyze(User, file.FileName, stream.ToArray(), request.FacilityId, request.Month,
            request.DeviceSource, request.ColumnMapping, request.DateOrder, status, errorCode, page, pageSize, ct);
    }
    [HttpGet("imports/{id:guid}"), Authorize(Roles = ImportReaders)]
    public Task<object> Preview(Guid id, CancellationToken ct, string? status = null, string? errorCode = null, int page = 1, int pageSize = 20)
        => imports.Preview(id, status, errorCode, page, pageSize, ct);
    [HttpPost("imports/{id:guid}/commit"), Authorize(Roles = "hr_staff")]
    public Task<object> Commit(Guid id, CommitImportRequest request, CancellationToken ct)
        => imports.Commit(User, id, request.Version, request.IncludeWarnings, ct);
    [HttpPut("imports/{id:guid}/rows/{rowId:guid}"), Authorize(Roles = "hr_staff")]
    public Task<object> Correct(Guid id, Guid rowId, CorrectImportRowRequest request, CancellationToken ct)
        => imports.Correct(User, id, rowId, request, ct);
    [HttpPost("imports/{id:guid}/rows/{rowId:guid}/exclude"), Authorize(Roles = "hr_staff")]
    public Task<object> Exclude(Guid id, Guid rowId, ExcludeImportRowRequest request, CancellationToken ct)
        => imports.Exclude(User, id, rowId, request, ct);
    [HttpGet("imports/{id:guid}/source"), Authorize(Roles = ImportReaders)]
    public async Task<IActionResult> Source(Guid id, CancellationToken ct)
    {
        var source = await imports.Source(id, ct);
        return File(source.Bytes, "application/octet-stream", source.Name);
    }
    [HttpGet("imports/{id:guid}/errors.csv"), Authorize(Roles = ImportReaders)]
    public async Task<IActionResult> Errors(Guid id, CancellationToken ct)
        => File(Encoding.UTF8.GetPreamble().Concat(Encoding.UTF8.GetBytes(await imports.ErrorCsv(id, ct))).ToArray(), "text/csv; charset=utf-8", $"import-{id}-errors.csv");

    [HttpGet("on-call-shifts"), Authorize(Roles = Readers)]
    public Task<object> OnCalls([FromQuery] AttendanceFilter filter, CancellationToken ct) => onCall.List(User, filter, ct);
    [HttpGet("on-call-context"), Authorize(Roles = "hr_staff")]
    public Task<object> OnCallContext(Guid staffId, Guid facilityId, DateOnly date, CancellationToken ct) => onCall.Context(User, staffId, facilityId, date, ct);
    [HttpGet("on-call-shifts/{id:guid}"), Authorize(Roles = Readers)]
    public Task<object> OnCall(Guid id, CancellationToken ct) => onCall.Detail(User, id, ct);
    [HttpPost("on-call-shifts"), Authorize(Roles = "hr_staff")]
    public Task<object> CreateOnCall(SaveOnCallRequest request, CancellationToken ct) => onCall.Save(User, null, request, ct);
    [HttpPut("on-call-shifts/{id:guid}"), Authorize(Roles = "hr_staff")]
    public Task<object> EditOnCall(Guid id, SaveOnCallRequest request, CancellationToken ct) => onCall.Save(User, id, request, ct);
    [HttpPost("on-call-shifts/{id:guid}/verify"), Authorize]
    public Task<object> VerifyOnCall(Guid id, VerifyOnCallRequest request, CancellationToken ct) => onCall.Verify(User, id, request, ct);

    [HttpGet("monthly-timesheets/{month}"), Authorize]
    public Task<object> MonthlySummary(string month, [FromQuery] Guid? departmentId, [FromQuery] Guid? facilityId, CancellationToken ct)
        => records.MonthlySummary(User, month, departmentId, facilityId, ct);
    [HttpPost("monthly-timesheets/{month}/lock"), Authorize]
    public Task<object> LockMonthly(string month, LockMonthlyAttendanceRequest? request, CancellationToken ct)
        => records.LockMonthly(User, month, request ?? new LockMonthlyAttendanceRequest(), ct);

    [HttpGet("history"), Authorize(Roles = HistoryReaders)]
    public Task<object> History([FromQuery] AuditFilter filter, CancellationToken ct) => audit.List(User, filter, true, ct);
    [HttpGet("history/options"), Authorize(Roles = HistoryReaders)]
    public Task<object> HistoryOptions(CancellationToken ct) => audit.Options(User, true, ct);
    [HttpGet("history/{id:guid}"), Authorize(Roles = HistoryReaders)]
    public Task<object> HistoryEvent(Guid id, CancellationToken ct) => audit.Detail(User, id, true, ct);
    [HttpGet("history/export.csv"), Authorize(Roles = "admin,hr_manager,hr_staff,accountant")]
    public async Task<IActionResult> ExportHistory([FromQuery] AuditFilter filter, CancellationToken ct)
        => File(Encoding.UTF8.GetPreamble().Concat(Encoding.UTF8.GetBytes(await audit.HistoryCsv(User, filter, ct))).ToArray(), "text/csv; charset=utf-8", "attendance-history.csv");

    [HttpGet("leave-requests"), Authorize(Policy = "Admin")]
    public Task<object> LeaveRequests(CancellationToken ct, int page = 1, int pageSize = 25) => legacy.LeaveRequestsAsync(page, pageSize, ct);
    [HttpGet("monthly-timesheets"), Authorize(Policy = "Admin")]
    public Task<object> MonthlyTimesheets(CancellationToken ct, int page = 1, int pageSize = 25) => legacy.MonthlyTimesheetsAsync(page, pageSize, ct);
}
