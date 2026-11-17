using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Vnc.HRMS.DTOs.Compliance;
using Vnc.HRMS.Security;
using Vnc.HRMS.Services;

namespace Vnc.HRMS.Controllers;

[ApiController]
[Authorize(Roles = $"{AccountRoles.HrManager},{AccountRoles.HrStaff},{AccountRoles.DepartmentManager},{AccountRoles.Administrator}")]
[Route("api/compliance")]
public sealed class ComplianceController(ComplianceService service) : ControllerBase
{
    [HttpGet("dashboard")]
    public Task<ComplianceDashboardResponseDto> Dashboard(
        [FromQuery] OperationalComplianceFilterRequestDto filter,
        CancellationToken ct = default)
    {
        Guid? userId = Guid.TryParse(User.FindFirstValue("sub"), out var uid) ? uid : null;
        string? role = User.FindFirstValue("role") ?? User.FindFirstValue(ClaimTypes.Role);
        return service.GetDashboardAsync(userId, role, filter, ct);
    }

    [HttpGet("filter-options")]
    public Task<ReportFilterOptionsDto> FilterOptions(CancellationToken ct = default)
    {
        Guid? userId = Guid.TryParse(User.FindFirstValue("sub"), out var uid) ? uid : null;
        string? role = User.FindFirstValue("role") ?? User.FindFirstValue(ClaimTypes.Role);
        return service.GetFilterOptionsAsync(userId, role, ct);
    }

    [HttpPost("remind")]
    public Task<SendComplianceReminderResponseDto> SendReminder(
        [FromBody] SendComplianceReminderRequest request,
        CancellationToken ct = default)
    {
        Guid? userId = Guid.TryParse(User.FindFirstValue("sub"), out var uid) ? uid : null;
        string? role = User.FindFirstValue("role") ?? User.FindFirstValue(ClaimTypes.Role);
        return service.SendRemindersAsync(request, userId, role, ct);
    }

    [HttpGet("certificates")]
    public Task<object> Certificates([FromQuery] int page = 1, [FromQuery] int pageSize = 25, CancellationToken ct = default) =>
        service.CertificatesAsync(page, pageSize, ct);

    [HttpGet("cme-cycles")]
    public Task<object> CmeCycles([FromQuery] int page = 1, [FromQuery] int pageSize = 25, CancellationToken ct = default) =>
        service.CmeCyclesAsync(page, pageSize, ct);

    [HttpGet("cme-records")]
    public Task<object> CmeRecords([FromQuery] int page = 1, [FromQuery] int pageSize = 25, CancellationToken ct = default) =>
        service.CmeRecordsAsync(page, pageSize, ct);

    [HttpGet("scans")]
    public Task<object> ComplianceScans([FromQuery] int page = 1, [FromQuery] int pageSize = 25, CancellationToken ct = default) =>
        service.ComplianceScansAsync(page, pageSize, ct);
}
