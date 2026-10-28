using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Vnc.HRMS.Common.Exceptions;
using Vnc.HRMS.DTOs.Payroll;
using Vnc.HRMS.Services.Interfaces;

namespace Vnc.HRMS.Controllers;

[ApiController]
[Authorize(Roles = "accountant")]
[Route("api/payroll/periods")]
public sealed class PayrollPeriodsController(IPayrollPeriodService periodService) : ControllerBase
{
    private Guid GetCurrentUserId()
    {
        var sub = User.FindFirst("sub")?.Value ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!Guid.TryParse(sub, out var userId))
        {
            throw new AppException(401, "Chưa xác thực người dùng.");
        }
        return userId;
    }

    [HttpGet]
    public Task<List<PayrollPeriodDto>> ListPeriods(CancellationToken ct)
        => periodService.ListPeriodsAsync(ct);

    [HttpGet("{month}")]
    public Task<PayrollPeriodDetailDto> GetPeriodDetail(string month, CancellationToken ct)
        => periodService.GetPeriodDetailAsync(month, ct);

    [HttpPost]
    public async Task<ActionResult<PayrollPeriodDto>> CreatePeriod(
        [FromBody] CreatePayrollPeriodRequest request, CancellationToken ct)
    {
        var result = await periodService.CreatePeriodAsync(GetCurrentUserId(), request, ct);
        return CreatedAtAction(nameof(GetPeriodDetail), new { month = result.PayMonth }, result);
    }
}
