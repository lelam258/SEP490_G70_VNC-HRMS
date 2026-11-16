using Vnc.HRMS.DTOs.Leave;

namespace Vnc.HRMS.Services.Interfaces;

public interface ILeaveApprovalService
{
    Task<IReadOnlyList<LeaveApprovalSummaryDto>> GetQueueAsync(
        Guid currentUserId,
        string currentUserRole,
        LeaveApprovalFilter filter,
        CancellationToken ct);

    Task<LeaveApprovalDetailDto> GetDetailAsync(
        Guid currentUserId,
        string currentUserRole,
        Guid requestId,
        CancellationToken ct);

    Task<LeaveApprovalDetailDto> ApproveAsync(
        Guid currentUserId,
        string currentUserRole,
        Guid requestId,
        CancellationToken ct);

    Task<LeaveApprovalDetailDto> RejectAsync(
        Guid currentUserId,
        string currentUserRole,
        Guid requestId,
        RejectLeaveRequestDto input,
        CancellationToken ct);
}

