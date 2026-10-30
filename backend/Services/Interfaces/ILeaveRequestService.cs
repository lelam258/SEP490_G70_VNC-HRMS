using Vnc.HRMS.DTOs.SelfService;

namespace Vnc.HRMS.Services.Interfaces;

public interface ILeaveRequestService
{
    Task<IReadOnlyList<LeaveTypeDto>> GetLeaveTypesAsync(CancellationToken ct);
    Task<List<LeaveRequestSummaryDto>> ListMyLeaveRequestsAsync(Guid userId, string? status, CancellationToken ct);
    Task<LeaveRequestDetailDto> GetLeaveRequestDetailAsync(Guid userId, Guid requestId, CancellationToken ct);
    Task<LeaveRequestDetailDto> CreateLeaveRequestAsync(Guid userId, CreateLeaveRequestInput input, CancellationToken ct);
    Task<LeaveRequestDetailDto> WithdrawLeaveRequestAsync(Guid userId, Guid requestId, CancellationToken ct);
}
