using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Vnc.HRMS.Services;
namespace Vnc.HRMS.Controllers;
[ApiController, Authorize(Policy = "Admin"), Route("api/payroll")]
public sealed class PayrollController(PayrollService service) : ControllerBase
{
    [HttpGet("payslips")] public Task<object> Payslips([FromQuery] int page = 1, [FromQuery] int pageSize = 25, CancellationToken ct = default) => service.PayslipsAsync(page, pageSize, ct);
    [HttpGet("allowance-types")] public Task<object> AllowanceTypes([FromQuery] int page = 1, [FromQuery] int pageSize = 25, CancellationToken ct = default) => service.AllowanceTypesAsync(page, pageSize, ct);
    [HttpGet("staff-allowances")] public Task<object> StaffAllowances([FromQuery] int page = 1, [FromQuery] int pageSize = 25, CancellationToken ct = default) => service.StaffAllowancesAsync(page, pageSize, ct);
    [HttpGet("procedure-slips")] public Task<object> ProcedureSlips([FromQuery] int page = 1, [FromQuery] int pageSize = 25, CancellationToken ct = default) => service.ProcedureSlipsAsync(page, pageSize, ct);
    [HttpGet("complaints")] public Task<object> Complaints([FromQuery] int page = 1, [FromQuery] int pageSize = 25, CancellationToken ct = default) => service.ComplaintsAsync(page, pageSize, ct);
}
