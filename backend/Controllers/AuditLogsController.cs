using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Vnc.HRMS.DTOs.Attendance;
using Vnc.HRMS.Services;

namespace Vnc.HRMS.Controllers;

[ApiController, Authorize(Policy = "Admin"), Route("api/audit-logs")]
public sealed class AuditLogsController(AuditViewerService audit) : ControllerBase
{
    [HttpGet] public Task<object> List([FromQuery] AuditFilter filter, CancellationToken ct) => audit.List(User, filter, false, ct);
    [HttpGet("options")] public Task<object> Options(CancellationToken ct) => audit.Options(User, false, ct);
    [HttpGet("{id:guid}")] public Task<object> Detail(Guid id, CancellationToken ct) => audit.Detail(User, id, false, ct);
}
