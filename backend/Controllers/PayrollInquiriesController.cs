using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Vnc.HRMS.Common.Exceptions;
using Vnc.HRMS.DTOs.Payroll;
using Vnc.HRMS.Services.Interfaces;

namespace Vnc.HRMS.Controllers;

/// <summary>
/// Hàng đợi và xử lý thắc mắc bảng lương dành cho Kế toán (SRS 7.10–7.12).
/// </summary>
[ApiController]
[Authorize(Roles = "accountant")]
[Route("api/payroll/inquiries")]
public sealed class PayrollInquiriesController(IPayrollInquiryService service) : ControllerBase
{
    private Guid GetCurrentUserId()
    {
        var sub = User.FindFirst("sub")?.Value ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!Guid.TryParse(sub, out var userId))
            throw new AppException(401, "Chưa xác thực người dùng.");
        return userId;
    }

    [HttpGet]
    public Task<PayrollInquiryQueueResponseDto> ListQueue(
        [FromQuery] PayrollInquiryQueueFilter filter, CancellationToken ct)
        => service.ListQueueAsync(filter, ct);

    [HttpGet("{complaintId:guid}")]
    public Task<PayrollInquiryDetailDto> GetDetail(Guid complaintId, CancellationToken ct)
        => service.GetAccountantDetailAsync(complaintId, ct);

    [HttpPost("{complaintId:guid}/start-review")]
    public Task<PayrollInquiryDetailDto> StartReview(Guid complaintId, CancellationToken ct)
        => service.StartReviewAsync(GetCurrentUserId(), complaintId, ct);

    [HttpPost("{complaintId:guid}/resolve")]
    public Task<PayrollInquiryDetailDto> Resolve(
        Guid complaintId, [FromBody] ResolvePayrollInquiryRequest request, CancellationToken ct)
        => service.ResolveAsync(GetCurrentUserId(), complaintId, request, ct);
}
