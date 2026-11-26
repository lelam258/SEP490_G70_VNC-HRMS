using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Vnc.HRMS.Common.Exceptions;
using Vnc.HRMS.DTOs.Payroll;
using Vnc.HRMS.Services.Helpers;
using Vnc.HRMS.Services.Interfaces;

namespace Vnc.HRMS.Controllers;

/// <summary>
/// Cổng tự phục vụ xem phiếu lương đã chốt của nhân viên (SRS 6.13 View My Payslip).
/// </summary>
[ApiController]
[Authorize(Roles = "employee,department_head,hr_staff,hr_manager,accountant")]
[Route("api/me/payslips")]
public sealed class MyPayslipsController(IPayrollPeriodService periodService) : ControllerBase
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
    public Task<List<MyPayslipSummaryDto>> ListMyPayslips(
        [FromQuery] int? year, CancellationToken ct)
        => periodService.ListMyPayslipsAsync(GetCurrentUserId(), year, ct);

    [HttpGet("by-month/{month}")]
    public Task<MyPayslipMonthLookupDto> GetMyPayslipByMonth(
        string month, CancellationToken ct)
        => periodService.GetMyPayslipByMonthAsync(GetCurrentUserId(), month, ct);

    [HttpGet("{payslipId:guid}")]
    public Task<PayslipDetailDto> GetMyPayslipDetail(
        Guid payslipId, CancellationToken ct)
        => periodService.GetMyPayslipDetailAsync(GetCurrentUserId(), payslipId, ct);

    [HttpGet("{payslipId:guid}/pdf")]
    public async Task<IActionResult> DownloadMyPayslipPdf(
        Guid payslipId, CancellationToken ct)
    {
        var detail = await periodService.GetMyPayslipDetailAsync(GetCurrentUserId(), payslipId, ct);
        var pdfBytes = PayslipPdfGenerator.Generate(detail);
        var safeCode = string.IsNullOrWhiteSpace(detail.StaffCode) ? "NV" : detail.StaffCode.Trim();
        var fileName = $"PhieuLuong_{safeCode}_{detail.PayMonth}.pdf";
        return File(pdfBytes, "application/pdf", fileName);
    }
}
