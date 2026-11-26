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

    [HttpPost("{month}/calculate")]
    public Task<PayrollPeriodDetailDto> CalculatePeriod(string month, CancellationToken ct)
        => periodService.CalculatePeriodAsync(GetCurrentUserId(), month, ct);

    [HttpGet("{month}/payslips/{payslipId:guid}")]
    public Task<PayslipDetailDto> GetPayslipDetail(string month, Guid payslipId, CancellationToken ct)
        => periodService.GetPayslipDetailAsync(month, payslipId, ct);

    [HttpPost("{month}/payslips/{payslipId:guid}/review")]
    public Task<PayslipDetailDto> ReviewPayslip(
        string month, Guid payslipId, [FromBody] ReviewPayslipRequest request, CancellationToken ct)
        => periodService.ReviewPayslipAsync(GetCurrentUserId(), month, payslipId, request, ct);

    [HttpPut("{month}/payslips/{payslipId:guid}")]
    public Task<PayrollPeriodDetailDto> UpdatePayslipInline(
        string month, Guid payslipId, [FromBody] UpdatePayslipInlineRequest request, CancellationToken ct)
        => periodService.UpdatePayslipInlineAsync(GetCurrentUserId(), month, payslipId, request, ct);

    [HttpPost("{month}/review-all")]
    public Task<PayrollPeriodDetailDto> ReviewAllValid(string month, CancellationToken ct)
        => periodService.ReviewAllValidAsync(GetCurrentUserId(), month, ct);

    [HttpPost("{month}/confirm")]
    public Task<PayrollPeriodDetailDto> ConfirmPeriod(
        string month, [FromBody] ConfirmPayrollPeriodRequest? request, CancellationToken ct)
        => periodService.ConfirmPeriodAsync(GetCurrentUserId(), month, request, ct);

    [HttpPost("{month}/finalize")]
    public Task<PayrollPeriodDetailDto> FinalizePeriod(
        string month, [FromBody] FinalizePayrollPeriodRequest request, CancellationToken ct)
        => periodService.FinalizePeriodAsync(GetCurrentUserId(), month, request, ct);

    [HttpPost("{month}/reopen")]
    public async Task<ActionResult<PayrollPeriodDetailDto>> ReopenPeriod(
        string month, [FromBody] ReopenPayrollPeriodRequest request, CancellationToken ct)
    {
        var result = await periodService.ReopenPeriodAsync(GetCurrentUserId(), month, request, ct);
        return Ok(result);
    }

    [HttpDelete("{month}")]
    public async Task<IActionResult> DeletePeriod(string month, CancellationToken ct)
    {
        await periodService.DeletePeriodAsync(GetCurrentUserId(), month, ct);
        return NoContent();
    }
}
