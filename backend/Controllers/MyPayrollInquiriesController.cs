using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Vnc.HRMS.Common.Exceptions;
using Vnc.HRMS.DTOs.Payroll;
using Vnc.HRMS.Services.Interfaces;

namespace Vnc.HRMS.Controllers;

/// <summary>
/// Cổng tự phục vụ gửi và theo dõi thắc mắc bảng lương của nhân viên (SRS 7.8–7.10).
/// </summary>
[ApiController]
[Authorize(Roles = "employee,department_head,hr_staff,hr_manager,accountant")]
[Route("api/me/payroll-inquiries")]
public sealed class MyPayrollInquiriesController(IPayrollInquiryService service) : ControllerBase
{
    private Guid GetCurrentUserId()
    {
        var sub = User.FindFirst("sub")?.Value ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!Guid.TryParse(sub, out var userId))
            throw new AppException(401, "Chưa xác thực người dùng.");
        return userId;
    }

    [HttpGet("options")]
    public Task<PayrollInquiryFormOptionsDto> GetOptions(CancellationToken ct)
        => service.GetMyFormOptionsAsync(GetCurrentUserId(), ct);

    [HttpGet]
    public Task<List<PayrollInquiryListItemDto>> ListMine(
        [FromQuery] MyPayrollInquiryFilter filter, CancellationToken ct)
        => service.ListMyInquiriesAsync(GetCurrentUserId(), filter, ct);

    [HttpGet("{complaintId:guid}")]
    public Task<PayrollInquiryDetailDto> GetDetail(Guid complaintId, CancellationToken ct)
        => service.GetMyInquiryDetailAsync(GetCurrentUserId(), complaintId, ct);

    [HttpPost]
    public async Task<ActionResult<PayrollInquiryDetailDto>> Submit(
        [FromBody] CreatePayrollInquiryRequest request, CancellationToken ct)
    {
        var created = await service.SubmitMyInquiryAsync(GetCurrentUserId(), request, ct);
        return CreatedAtAction(nameof(GetDetail), new { complaintId = created.ComplaintId }, created);
    }
}
