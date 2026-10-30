using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Vnc.HRMS.Common.Exceptions;
using Vnc.HRMS.DTOs.SelfService;
using Vnc.HRMS.Services.Interfaces;

namespace Vnc.HRMS.Controllers;

[ApiController]
[Authorize(Policy = "SelfService")]
[Route("api/me/leave-requests")]
public sealed class MyLeaveRequestsController(ILeaveRequestService leaveService) : ControllerBase
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

    [HttpGet("types")]
    public async Task<ActionResult<IReadOnlyList<LeaveTypeDto>>> GetLeaveTypes(CancellationToken ct)
        => Ok(await leaveService.GetLeaveTypesAsync(ct));

    [HttpGet]
    public Task<List<LeaveRequestSummaryDto>> ListMyLeaveRequests([FromQuery] string? status, CancellationToken ct)
        => leaveService.ListMyLeaveRequestsAsync(GetCurrentUserId(), status, ct);

    [HttpGet("{id:guid}")]
    public Task<LeaveRequestDetailDto> GetLeaveRequestDetail(Guid id, CancellationToken ct)
        => leaveService.GetLeaveRequestDetailAsync(GetCurrentUserId(), id, ct);

    [HttpPost]
    [RequestSizeLimit(15 * 1024 * 1024)]
    public async Task<ActionResult<LeaveRequestDetailDto>> CreateLeaveRequest(
        [FromForm] CreateLeaveRequestInput input, CancellationToken ct)
    {
        var result = await leaveService.CreateLeaveRequestAsync(GetCurrentUserId(), input, ct);
        return CreatedAtAction(nameof(GetLeaveRequestDetail), new { id = result.RequestId }, result);
    }

    [HttpPost("{id:guid}/withdraw")]
    public Task<LeaveRequestDetailDto> WithdrawLeaveRequest(Guid id, CancellationToken ct)
        => leaveService.WithdrawLeaveRequestAsync(GetCurrentUserId(), id, ct);
}
