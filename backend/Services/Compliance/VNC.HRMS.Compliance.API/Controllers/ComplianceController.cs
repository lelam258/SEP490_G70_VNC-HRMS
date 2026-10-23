using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Vnc.HRMS.Services;
namespace Vnc.HRMS.Controllers;
[ApiController, Authorize(Policy = "Admin"), Route("api/compliance")]
public sealed class ComplianceController(ComplianceService service) : ControllerBase
{
    [HttpGet("certificates")] public Task<object> Certificates([FromQuery] int page = 1, [FromQuery] int pageSize = 25, CancellationToken ct = default) => service.CertificatesAsync(page, pageSize, ct);
    [HttpGet("cme-cycles")] public Task<object> CmeCycles([FromQuery] int page = 1, [FromQuery] int pageSize = 25, CancellationToken ct = default) => service.CmeCyclesAsync(page, pageSize, ct);
    [HttpGet("cme-records")] public Task<object> CmeRecords([FromQuery] int page = 1, [FromQuery] int pageSize = 25, CancellationToken ct = default) => service.CmeRecordsAsync(page, pageSize, ct);
    [HttpGet("scans")] public Task<object> ComplianceScans([FromQuery] int page = 1, [FromQuery] int pageSize = 25, CancellationToken ct = default) => service.ComplianceScansAsync(page, pageSize, ct);
}
