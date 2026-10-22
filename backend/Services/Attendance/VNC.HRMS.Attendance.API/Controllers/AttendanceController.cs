using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Vnc.HRMS.Services;
namespace Vnc.HRMS.Controllers;
[ApiController, Authorize(Policy = "Admin"), Route("api/attendance")]
public sealed class AttendanceController(AttendanceService service) : ControllerBase
{
    [HttpGet("records")] public Task<object> AttendanceRecords([FromQuery] int page = 1, [FromQuery] int pageSize = 25, CancellationToken ct = default) => service.AttendanceRecordsAsync(page, pageSize, ct);
    [HttpGet("imports")] public Task<object> AttendanceImports([FromQuery] int page = 1, [FromQuery] int pageSize = 25, CancellationToken ct = default) => service.AttendanceImportsAsync(page, pageSize, ct);
    [HttpGet("leave-requests")] public Task<object> LeaveRequests([FromQuery] int page = 1, [FromQuery] int pageSize = 25, CancellationToken ct = default) => service.LeaveRequestsAsync(page, pageSize, ct);
    [HttpGet("on-call-shifts")] public Task<object> OnCallShifts([FromQuery] int page = 1, [FromQuery] int pageSize = 25, CancellationToken ct = default) => service.OnCallShiftsAsync(page, pageSize, ct);
    [HttpGet("monthly-timesheets")] public Task<object> MonthlyTimesheets([FromQuery] int page = 1, [FromQuery] int pageSize = 25, CancellationToken ct = default) => service.MonthlyTimesheetsAsync(page, pageSize, ct);
}
