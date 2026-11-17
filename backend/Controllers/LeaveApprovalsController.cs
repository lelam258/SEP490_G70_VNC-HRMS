using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Vnc.HRMS.Common.Exceptions;
using Vnc.HRMS.DTOs.Leave;
using Vnc.HRMS.Security;
using Vnc.HRMS.Services.Interfaces;

namespace Vnc.HRMS.Controllers;

[ApiController]
[Authorize(Roles = $"{AccountRoles.DepartmentManager},{AccountRoles.HrManager},{AccountRoles.Administrator}")]
[Route("api/leave-approvals")]
public sealed class LeaveApprovalsController(ILeaveApprovalService leaveApprovalService) : ControllerBase
{
    private (Guid UserId, string Role) GetCurrentUser()
    {
        var sub = User.FindFirst("sub")?.Value ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!Guid.TryParse(sub, out var userId))
        {
            throw new AppException(401, "Chưa xác thực người dùng.");
        }
        var role = User.FindFirst("role")?.Value ?? User.FindFirst(ClaimTypes.Role)?.Value ?? "employee";
        return (userId, role);
    }

    /// <summary>
    /// UC-7.6 / Task 83: Leave Approval Queue - Danh sách đơn xin nghỉ phép chờ duyệt.
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<LeaveApprovalSummaryDto>>> GetQueue(
        [FromQuery] LeaveApprovalFilter filter,
        CancellationToken ct)
    {
        var (userId, role) = GetCurrentUser();
        var result = await leaveApprovalService.GetQueueAsync(userId, role, filter, ct);
        return Ok(result);
    }

    /// <summary>
    /// UC-7.7 / Task 84: Xem chi tiết đơn nghỉ phép để phê duyệt hoặc từ chối.
    /// </summary>
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<LeaveApprovalDetailDto>> GetDetail(
        Guid id,
        CancellationToken ct)
    {
        var (userId, role) = GetCurrentUser();
        var result = await leaveApprovalService.GetDetailAsync(userId, role, id, ct);
        return Ok(result);
    }

    /// <summary>
    /// UC-7.7 / Task 84: Phê duyệt đơn xin nghỉ phép (Chỉ Trưởng khoa / Quản trị viên).
    /// </summary>
    [HttpPost("{id:guid}/approve")]
    [Authorize(Roles = $"{AccountRoles.DepartmentManager},{AccountRoles.Administrator}")]
    public async Task<ActionResult<LeaveApprovalDetailDto>> Approve(
        Guid id,
        CancellationToken ct)
    {
        var (userId, role) = GetCurrentUser();
        var result = await leaveApprovalService.ApproveAsync(userId, role, id, ct);
        return Ok(result);
    }

    /// <summary>
    /// UC-7.7 / Task 84: Từ chối đơn xin nghỉ phép (Chỉ Trưởng khoa / Quản trị viên).
    /// </summary>
    [HttpPost("{id:guid}/reject")]
    [Authorize(Roles = $"{AccountRoles.DepartmentManager},{AccountRoles.Administrator}")]
    public async Task<ActionResult<LeaveApprovalDetailDto>> Reject(
        Guid id,
        [FromBody] RejectLeaveRequestDto input,
        CancellationToken ct)
    {
        var (userId, role) = GetCurrentUser();
        var result = await leaveApprovalService.RejectAsync(userId, role, id, input, ct);
        return Ok(result);
    }
}

