using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Vnc.HRMS.DTOs.Payroll;
using Vnc.HRMS.Services.Interfaces;

namespace Vnc.HRMS.Controllers;

/// <summary>
/// Lịch sử tính lương và đối chiếu các kỳ lương đã chạy/chốt (SRS 6.14 / Task 74).
/// </summary>
[ApiController]
[Authorize(Roles = "accountant,hr_manager")]
[Route("api/payroll/history")]
public sealed class PayrollHistoryController(IPayrollHistoryService service) : ControllerBase
{
    [HttpGet]
    public Task<PayrollHistoryResponseDto> ListHistory(
        [FromQuery] PayrollHistoryFilter filter, CancellationToken ct)
        => service.ListHistoryAsync(filter, ct);

    [HttpGet("{month}")]
    public Task<PayrollHistoryDetailDto> GetMonthDetail(
        string month, [FromQuery] Guid? departmentId, CancellationToken ct)
        => service.GetMonthHistoryDetailAsync(month, departmentId, ct);

    [HttpGet("export.csv")]
    public async Task<IActionResult> ExportCsv(
        [FromQuery] PayrollHistoryFilter filter, CancellationToken ct)
    {
        var csv = await service.ExportHistoryCsvAsync(filter, ct);
        var bytes = Encoding.UTF8.GetPreamble().Concat(Encoding.UTF8.GetBytes(csv)).ToArray();
        return File(bytes, "text/csv; charset=utf-8", "lich-su-tinh-luong.csv");
    }
}
