using Vnc.HRMS.DTOs.SelfService;
using Vnc.HRMS.Models;
using Vnc.HRMS.Models.Employees;
using Vnc.HRMS.Models.Users;

namespace Vnc.HRMS.Repositories.Interfaces;

public interface ISelfServiceRepository
{
    Task<Staff?> FindStaffByUserIdAsync(Guid userId, CancellationToken ct);
    Task<User?> FindUserByIdAsync(Guid userId, CancellationToken ct);
    Task<bool> IsIdCardInUseAsync(string idCardNumber, Guid excludeStaffId, CancellationToken ct);
    Task<UserProfileDto?> GetProfileByUserIdAsync(Guid userId, CancellationToken ct);
    Task<IReadOnlyList<LeaveTypeDto>> GetActiveLeaveTypesAsync(CancellationToken ct);
    Task<bool> IsValidLeaveTypeAsync(string code, CancellationToken ct);
    Task<List<LeaveRequestSummaryDto>> ListLeaveRequestsAsync(Guid staffId, string? status, CancellationToken ct);
    Task<LeaveRequest?> FindLeaveRequestByIdAsync(Guid requestId, CancellationToken ct);
    Task<LeaveRequestDetailDto?> GetLeaveRequestDetailAsync(Guid requestId, CancellationToken ct);
    Task<bool> HasOverlappingLeaveAsync(Guid staffId, DateOnly startDate, DateOnly endDate, Guid? excludeRequestId, CancellationToken ct);
    void AddLeaveRequest(LeaveRequest leaveRequest);
}
