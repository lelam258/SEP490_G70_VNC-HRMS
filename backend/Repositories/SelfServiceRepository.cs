using Microsoft.EntityFrameworkCore;
using Vnc.HRMS.DTOs.SelfService;
using Vnc.HRMS.Models;
using Vnc.HRMS.Models.Employees;
using Vnc.HRMS.Models.Users;
using Vnc.HRMS.Persistence;
using Vnc.HRMS.Repositories.Interfaces;
using Vnc.HRMS.Services.Rules;

namespace Vnc.HRMS.Repositories;

public sealed class SelfServiceRepository(AppDbContext db) : ISelfServiceRepository
{
    private static string GetLeaveTypeName(string code) => code.ToLowerInvariant() switch
    {
        "annual" => "Nghỉ phép năm",
        "personal_paid" => "Nghỉ việc riêng (hưởng lương)",
        "sick" => "Nghỉ ốm đau, tai nạn",
        "maternity" => "Nghỉ thai sản",
        "unpaid" => "Nghỉ không lương",
        _ => "Khác"
    };

    public async Task<IReadOnlyList<LeaveTypeDto>> GetActiveLeaveTypesAsync(CancellationToken ct)
    {
        var types = await db.LeaveTypes.AsNoTracking()
            .Where(t => t.Status == "active")
            .ToListAsync(ct);

        return types
            .OrderBy(t => t.Code switch
            {
                "annual" => 0,
                "personal_paid" => 1,
                "sick" => 2,
                "maternity" => 3,
                "unpaid" => 4,
                _ => 5
            })
            .ThenBy(t => t.Name)
            .Select(t => new LeaveTypeDto(t.Code, t.Name, t.Description, t.IsPaid))
            .ToList();
    }

    public Task<bool> IsValidLeaveTypeAsync(string code, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(code)) return Task.FromResult(false);
        var normalized = code.Trim();
        return db.LeaveTypes.AnyAsync(t => t.Status == "active" && t.Code == normalized, ct);
    }

    public Task<Staff?> FindStaffByUserIdAsync(Guid userId, CancellationToken ct)
        => db.Staff.SingleOrDefaultAsync(x => x.UserId == userId, ct);

    public Task<User?> FindUserByIdAsync(Guid userId, CancellationToken ct)
        => db.Users.SingleOrDefaultAsync(x => x.UserId == userId, ct);

    public Task<bool> IsIdCardInUseAsync(string idCardNumber, Guid excludeStaffId, CancellationToken ct)
        => db.Staff.AnyAsync(x => x.StaffId != excludeStaffId && x.IdCardNumber == idCardNumber, ct);

    public async Task<UserProfileDto?> GetProfileByUserIdAsync(Guid userId, CancellationToken ct)
    {
        var row = await (
            from s in db.Staff.AsNoTracking()
            where s.UserId == userId
            join d in db.Departments.AsNoTracking() on s.DepartmentId equals d.DepartmentId into depts
            from d in depts.DefaultIfEmpty()
            join p in db.Positions.AsNoTracking() on s.PositionId equals p.PositionId into pos
            from p in pos.DefaultIfEmpty()
            select new
            {
                Staff = s,
                DepartmentName = d != null ? d.Name : null,
                PositionName = p != null ? p.Name : null
            }
        ).SingleOrDefaultAsync(ct);

        if (row is null) return null;

        var sEntity = row.Staff;
        return new UserProfileDto(
            sEntity.StaffId,
            sEntity.StaffCode,
            sEntity.FullName,
            sEntity.DateOfBirth,
            sEntity.Gender,
            sEntity.Phone,
            sEntity.Email,
            ProfileRules.MaskIdCard(sEntity.IdCardNumber),
            sEntity.AvatarUrl,
            row.DepartmentName,
            row.PositionName,
            sEntity.DateJoined,
            sEntity.ScopeOfPractice,
            sEntity.DependentCount,
            sEntity.Status);
    }

    public async Task<List<LeaveRequestSummaryDto>> ListLeaveRequestsAsync(Guid staffId, string? status, CancellationToken ct)
    {
        var query = db.LeaveRequests.AsNoTracking().Where(x => x.StaffId == staffId);

        if (!string.IsNullOrWhiteSpace(status) && !string.Equals(status, "all", StringComparison.OrdinalIgnoreCase))
        {
            var normalizedStatus = status.Trim().ToLowerInvariant();
            query = query.Where(x => x.Status != null && x.Status.ToLower() == normalizedStatus);
        }

        var list = await query
            .OrderByDescending(x => x.CreatedAt)
            .ToListAsync(ct);

        var leaveTypeMap = await db.LeaveTypes.AsNoTracking()
            .ToDictionaryAsync(t => t.Code, t => t.Name, StringComparer.OrdinalIgnoreCase, ct);

        return list.Select(x => new LeaveRequestSummaryDto(
            x.RequestId,
            x.LeaveType,
            leaveTypeMap.TryGetValue(x.LeaveType, out var typeName) ? typeName : GetLeaveTypeName(x.LeaveType),
            x.StartDate,
            x.EndDate,
            x.TotalDays ?? 0,
            x.Reason,
            x.AttachmentUrl,
            x.Status ?? "pending",
            x.CreatedAt
        )).ToList();
    }

    public Task<LeaveRequest?> FindLeaveRequestByIdAsync(Guid requestId, CancellationToken ct)
        => db.LeaveRequests.SingleOrDefaultAsync(x => x.RequestId == requestId, ct);

    public async Task<LeaveRequestDetailDto?> GetLeaveRequestDetailAsync(Guid requestId, CancellationToken ct)
    {
        var lr = await db.LeaveRequests.AsNoTracking().SingleOrDefaultAsync(x => x.RequestId == requestId, ct);
        if (lr is null) return null;

        var leaveTypeEntity = await db.LeaveTypes.AsNoTracking().FirstOrDefaultAsync(t => t.Code == lr.LeaveType, ct);
        var leaveTypeName = leaveTypeEntity?.Name ?? GetLeaveTypeName(lr.LeaveType);

        string? approverName = null;
        if (lr.ApprovedBy.HasValue)
        {
            var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.UserId == lr.ApprovedBy.Value, ct);
            approverName = user?.FullName;
            if (approverName is null)
            {
                var staff = await db.Staff.AsNoTracking().FirstOrDefaultAsync(s => s.StaffId == lr.ApprovedBy.Value, ct);
                approverName = staff?.FullName;
            }
        }

        return new LeaveRequestDetailDto(
            lr.RequestId,
            lr.LeaveType,
            leaveTypeName,
            lr.StartDate,
            lr.EndDate,
            lr.TotalDays ?? 0,
            lr.Reason,
            lr.AttachmentUrl,
            lr.Status ?? "pending",
            approverName,
            lr.ApprovedAt,
            lr.RejectedReason,
            lr.CreatedAt,
            lr.UpdatedAt
        );
    }

    public Task<bool> HasOverlappingLeaveAsync(
        Guid staffId, DateOnly startDate, DateOnly endDate, Guid? excludeRequestId, CancellationToken ct)
    {
        var query = db.LeaveRequests.Where(x =>
            x.StaffId == staffId &&
            (x.Status == "pending" || x.Status == "approved") &&
            startDate <= x.EndDate &&
            endDate >= x.StartDate);

        if (excludeRequestId.HasValue)
        {
            query = query.Where(x => x.RequestId != excludeRequestId.Value);
        }

        return query.AnyAsync(ct);
    }

    public void AddLeaveRequest(LeaveRequest leaveRequest)
        => db.LeaveRequests.Add(leaveRequest);
}
