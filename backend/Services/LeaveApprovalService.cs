using Microsoft.EntityFrameworkCore;
using Vnc.HRMS.Common.Exceptions;
using Vnc.HRMS.DTOs.Leave;
using Vnc.HRMS.Models;
using Vnc.HRMS.Persistence;
using Vnc.HRMS.Security;
using Vnc.HRMS.Services.Interfaces;
using Vnc.HRMS.Services.Rules;

namespace Vnc.HRMS.Services;

public sealed class LeaveApprovalService(
    AppDbContext db,
    IAuditLogHelper auditHelper) : ILeaveApprovalService
{
    private static readonly Dictionary<string, string> LeaveTypeDisplayNames = new(StringComparer.OrdinalIgnoreCase)
    {
        { "annual", "Nghỉ phép năm" },
        { "personal_paid", "Nghỉ việc riêng (hưởng lương)" },
        { "sick", "Nghỉ ốm đau" },
        { "maternity", "Nghỉ thai sản" },
        { "unpaid", "Nghỉ không lương" },
        { "other", "Nghỉ chế độ khác" }
    };

    public async Task<IReadOnlyList<LeaveApprovalSummaryDto>> GetQueueAsync(
        Guid currentUserId,
        string currentUserRole,
        LeaveApprovalFilter filter,
        CancellationToken ct)
    {
        var managerDeptId = await ResolveManagerDepartmentIdAsync(currentUserId, currentUserRole, ct);

        // Department Head is restricted strictly to their own department (GB-41)
        if (string.Equals(currentUserRole, AccountRoles.DepartmentManager, StringComparison.OrdinalIgnoreCase))
        {
            if (!managerDeptId.HasValue)
            {
                return Array.Empty<LeaveApprovalSummaryDto>();
            }
        }

        var query = db.LeaveRequests.AsNoTracking();

        // 1. Department Scope Filter
        if (string.Equals(currentUserRole, AccountRoles.DepartmentManager, StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(l => l.DepartmentId == managerDeptId.Value);
        }
        else if (filter.DepartmentId.HasValue)
        {
            query = query.Where(l => l.DepartmentId == filter.DepartmentId.Value);
        }

        // 2. Status Filter (default "pending" for queue, or "all", "approved", "rejected")
        var statusFilter = filter.Status?.Trim().ToLowerInvariant();
        if (!string.IsNullOrWhiteSpace(statusFilter) && statusFilter != "all")
        {
            query = query.Where(l => l.Status == statusFilter);
        }

        // 3. Leave Type Filter
        if (!string.IsNullOrWhiteSpace(filter.LeaveType) && filter.LeaveType != "all")
        {
            var lt = filter.LeaveType.Trim().ToLowerInvariant();
            query = query.Where(l => l.LeaveType == lt);
        }

        // 4. Date Range Filter
        if (filter.FromDate.HasValue)
        {
            query = query.Where(l => l.EndDate >= filter.FromDate.Value);
        }
        if (filter.ToDate.HasValue)
        {
            query = query.Where(l => l.StartDate <= filter.ToDate.Value);
        }

        var rawList = await (
            from lr in query
            join s in db.Staff.AsNoTracking() on lr.StaffId equals s.StaffId
            join d in db.Departments.AsNoTracking() on lr.DepartmentId equals d.DepartmentId
            join p in db.Positions.AsNoTracking() on s.PositionId equals p.PositionId into posGroup
            from pos in posGroup.DefaultIfEmpty()
            join appStaff in db.Staff.AsNoTracking() on lr.ApprovedBy equals appStaff.StaffId into appGroup
            from approver in appGroup.DefaultIfEmpty()
            orderby lr.CreatedAt descending
            select new
            {
                lr.RequestId,
                lr.StaffId,
                s.StaffCode,
                s.FullName,
                lr.DepartmentId,
                DepartmentName = d.Name,
                PositionName = pos != null ? pos.Name : null,
                lr.LeaveType,
                lr.StartDate,
                lr.EndDate,
                TotalDays = lr.TotalDays ?? 0m,
                lr.Reason,
                lr.AttachmentUrl,
                Status = lr.Status ?? "pending",
                lr.CreatedAt,
                ApprovedByName = approver != null ? approver.FullName : null,
                lr.ApprovedAt,
                lr.RejectedReason
            }
        ).ToListAsync(ct);

        // In-memory text search for staff name / staff code
        if (!string.IsNullOrWhiteSpace(filter.Search))
        {
            var search = filter.Search.Trim().ToLowerInvariant();
            rawList = rawList.Where(x =>
                x.StaffCode.ToLowerInvariant().Contains(search) ||
                x.FullName.ToLowerInvariant().Contains(search)
            ).ToList();
        }

        if (rawList.Count == 0)
        {
            return Array.Empty<LeaveApprovalSummaryDto>();
        }

        var staffIds = rawList.Select(x => x.StaffId).Distinct().ToList();
        var minDate = rawList.Min(x => x.StartDate);
        var maxDate = rawList.Max(x => x.EndDate);

        // Pre-fetch shifts in the date window to detect shift conflicts (GB-46)
        var shifts = await db.OnCallShifts.AsNoTracking()
            .Where(s => staffIds.Contains(s.StaffId) &&
                        s.ShiftDate >= minDate &&
                        s.ShiftDate <= maxDate &&
                        s.Status != "rejected")
            .Select(s => new { s.StaffId, s.ShiftDate, s.ShiftCategory })
            .ToListAsync(ct);

        // Pre-fetch other approved leaves to detect overlap (GB-46)
        var approvedLeaves = await db.LeaveRequests.AsNoTracking()
            .Where(l => staffIds.Contains(l.StaffId) &&
                        l.Status == "approved" &&
                        l.StartDate <= maxDate &&
                        l.EndDate >= minDate)
            .Select(l => new { l.RequestId, l.StaffId, l.StartDate, l.EndDate })
            .ToListAsync(ct);

        // Pre-fetch used annual leave for these staff in the current year (GB-17)
        var currentYear = DateTime.UtcNow.Year;
        var annualUsed = await db.LeaveRequests.AsNoTracking()
            .Where(l => staffIds.Contains(l.StaffId) &&
                        l.Status == "approved" &&
                        l.LeaveType == "annual" &&
                        l.StartDate.Year == currentYear)
            .GroupBy(l => l.StaffId)
            .Select(g => new { StaffId = g.Key, Used = g.Sum(x => x.TotalDays ?? 0m) })
            .ToDictionaryAsync(x => x.StaffId, x => x.Used, ct);

        var result = new List<LeaveApprovalSummaryDto>(rawList.Count);
        foreach (var item in rawList)
        {
            var conflictShifts = shifts.Where(s =>
                s.StaffId == item.StaffId &&
                s.ShiftDate >= item.StartDate &&
                s.ShiftDate <= item.EndDate).ToList();

            var conflictLeaves = approvedLeaves.Where(l =>
                l.StaffId == item.StaffId &&
                l.RequestId != item.RequestId &&
                l.StartDate <= item.EndDate &&
                l.EndDate >= item.StartDate).ToList();

            decimal? annualBalance = null;
            if (string.Equals(item.LeaveType, "annual", StringComparison.OrdinalIgnoreCase))
            {
                annualUsed.TryGetValue(item.StaffId, out var used);
                var (_, _, rem) = LeaveApprovalRules.ComputeAnnualLeave(used);
                annualBalance = rem;
            }

            LeaveTypeDisplayNames.TryGetValue(item.LeaveType, out var typeDisplayName);
            typeDisplayName ??= item.LeaveType;

            result.Add(new LeaveApprovalSummaryDto(
                item.RequestId,
                item.StaffId,
                item.StaffCode,
                item.FullName,
                item.DepartmentId,
                item.DepartmentName,
                item.PositionName,
                item.LeaveType,
                typeDisplayName,
                item.StartDate,
                item.EndDate,
                item.TotalDays,
                item.Reason,
                item.AttachmentUrl,
                item.Status,
                item.CreatedAt,
                item.ApprovedByName,
                item.ApprovedAt,
                item.RejectedReason,
                annualBalance,
                conflictShifts.Count > 0,
                conflictShifts.Count,
                conflictLeaves.Count > 0
            ));
        }

        return result;
    }

    public async Task<LeaveApprovalDetailDto> GetDetailAsync(
        Guid currentUserId,
        string currentUserRole,
        Guid requestId,
        CancellationToken ct)
    {
        var managerDeptId = await ResolveManagerDepartmentIdAsync(currentUserId, currentUserRole, ct);

        var lr = await db.LeaveRequests.AsNoTracking().FirstOrDefaultAsync(x => x.RequestId == requestId, ct)
            ?? throw new AppException(404, "Không tìm thấy đơn nghỉ phép.");

        LeaveApprovalRules.EnsureDepartmentAuthority(currentUserRole, managerDeptId, lr.DepartmentId);

        var staff = await db.Staff.AsNoTracking().FirstOrDefaultAsync(s => s.StaffId == lr.StaffId, ct)
            ?? throw new AppException(404, "Không tìm thấy thông tin nhân viên xin nghỉ.");

        var dept = await db.Departments.AsNoTracking().FirstOrDefaultAsync(d => d.DepartmentId == lr.DepartmentId, ct);
        var position = staff.PositionId.HasValue
            ? await db.Positions.AsNoTracking().FirstOrDefaultAsync(p => p.PositionId == staff.PositionId.Value, ct)
            : null;

        string? approverName = null;
        if (lr.ApprovedBy.HasValue)
        {
            var appStaff = await db.Staff.AsNoTracking().FirstOrDefaultAsync(s => s.StaffId == lr.ApprovedBy.Value || s.UserId == lr.ApprovedBy.Value, ct);
            approverName = appStaff?.FullName;
        }

        // Shifts conflict
        var conflictingShifts = await db.OnCallShifts.AsNoTracking()
            .Where(s => s.StaffId == lr.StaffId &&
                        s.ShiftDate >= lr.StartDate &&
                        s.ShiftDate <= lr.EndDate &&
                        s.Status != "rejected")
            .OrderBy(s => s.ShiftDate)
            .Select(s => $"Ca {s.ShiftCategory} - {s.ShiftDate:dd/MM/yyyy}")
            .ToListAsync(ct);

        // Leave conflict
        var conflictingLeaves = await db.LeaveRequests.AsNoTracking()
            .Where(l => l.StaffId == lr.StaffId &&
                        l.RequestId != lr.RequestId &&
                        l.Status == "approved" &&
                        l.StartDate <= lr.EndDate &&
                        l.EndDate >= lr.StartDate)
            .OrderBy(l => l.StartDate)
            .Select(l => $"Đơn {l.LeaveType} ({l.StartDate:dd/MM/yyyy} - {l.EndDate:dd/MM/yyyy})")
            .ToListAsync(ct);

        // Annual leave balance
        var currentYear = DateTime.UtcNow.Year;
        var usedDays = await db.LeaveRequests.AsNoTracking()
            .Where(l => l.StaffId == lr.StaffId &&
                        l.Status == "approved" &&
                        l.LeaveType == "annual" &&
                        l.StartDate.Year == currentYear)
            .SumAsync(l => l.TotalDays ?? 0m, ct);

        var (entitlement, used, remaining) = LeaveApprovalRules.ComputeAnnualLeave(usedDays);

        LeaveTypeDisplayNames.TryGetValue(lr.LeaveType, out var typeDisplayName);
        typeDisplayName ??= lr.LeaveType;

        return new LeaveApprovalDetailDto(
            lr.RequestId,
            lr.StaffId,
            staff.StaffCode,
            staff.FullName,
            staff.Email,
            staff.Phone,
            lr.DepartmentId,
            dept?.Name ?? "Khoa phòng",
            position?.Name,
            lr.LeaveType,
            typeDisplayName,
            lr.StartDate,
            lr.EndDate,
            lr.TotalDays ?? 0m,
            lr.Reason,
            lr.AttachmentUrl,
            lr.Status ?? "pending",
            lr.CreatedAt,
            approverName,
            lr.ApprovedAt,
            lr.RejectedReason,
            entitlement,
            used,
            remaining,
            conflictingShifts.Count > 0,
            conflictingShifts,
            conflictingLeaves.Count > 0,
            conflictingLeaves
        );
    }

    public async Task<LeaveApprovalDetailDto> ApproveAsync(
        Guid currentUserId,
        string currentUserRole,
        Guid requestId,
        CancellationToken ct)
    {
        var managerDeptId = await ResolveManagerDepartmentIdAsync(currentUserId, currentUserRole, ct);

        var lr = await db.LeaveRequests.FirstOrDefaultAsync(x => x.RequestId == requestId, ct)
            ?? throw new AppException(404, "Không tìm thấy đơn nghỉ phép.");

        LeaveApprovalRules.EnsureApprovalAuthority(currentUserRole, managerDeptId, lr.DepartmentId);
        LeaveApprovalRules.EnsurePendingStatus(lr.Status);

        var approverStaff = await db.Staff.AsNoTracking().FirstOrDefaultAsync(s => s.UserId == currentUserId, ct);
        var approverStaffId = approverStaff?.StaffId ?? currentUserId;

        lr.Status = "approved";
        lr.ApprovedBy = approverStaffId;
        lr.ApprovedAt = DateTime.UtcNow;
        lr.RejectedReason = null;
        lr.UpdatedAt = DateTime.UtcNow;

        var oldSnapshot = new { Status = "pending" };
        var newSnapshot = new
        {
            Status = "approved",
            ApprovedBy = approverStaffId,
            ApprovedAt = lr.ApprovedAt
        };

        auditHelper.Log("approve", "LeaveRequest", lr.RequestId, oldSnapshot, newSnapshot);

        // Notify HR Manager and Employee
        var requesterStaff = await db.Staff.AsNoTracking().FirstOrDefaultAsync(s => s.StaffId == lr.StaffId, ct);
        var hrUsers = await db.Users.AsNoTracking()
            .Where(u => u.Role == AccountRoles.HrManager && u.AccountStatus == "active")
            .ToListAsync(ct);

        foreach (var hr in hrUsers)
        {
            db.Notifications.Add(new Notification
            {
                NotificationId = Guid.NewGuid(),
                RecipientId = hr.UserId,
                SenderService = "LeaveApproval",
                Type = "leave_approved",
                Title = "Đơn nghỉ phép đã được phê duyệt",
                Body = $"Trưởng khoa {approverStaff?.FullName ?? "quản lý"} đã duyệt đơn nghỉ phép của {requesterStaff?.FullName ?? "nhân viên"} ({lr.StartDate:dd/MM/yyyy} - {lr.EndDate:dd/MM/yyyy}).",
                ActionUrl = "/leave-approvals",
                EntityType = "LeaveRequest",
                EntityId = lr.RequestId,
                Channel = "in_app",
                IsRead = false,
                CreatedAt = DateTime.UtcNow
            });
        }

        if (requesterStaff != null && requesterStaff.UserId != Guid.Empty)
        {
            db.Notifications.Add(new Notification
            {
                NotificationId = Guid.NewGuid(),
                RecipientId = requesterStaff.UserId,
                SenderService = "LeaveApproval",
                Type = "leave_approved",
                Title = "Đơn xin nghỉ phép đã được phê duyệt",
                Body = $"Đơn xin nghỉ phép từ ngày {lr.StartDate:dd/MM/yyyy} đến {lr.EndDate:dd/MM/yyyy} đã được Trưởng khoa {approverStaff?.FullName ?? ""} phê duyệt.",
                ActionUrl = "/me/leave-requests",
                EntityType = "LeaveRequest",
                EntityId = lr.RequestId,
                Channel = "in_app",
                IsRead = false,
                CreatedAt = DateTime.UtcNow
            });
        }

        await db.SaveChangesAsync(ct);

        return await GetDetailAsync(currentUserId, currentUserRole, requestId, ct);
    }

    public async Task<LeaveApprovalDetailDto> RejectAsync(
        Guid currentUserId,
        string currentUserRole,
        Guid requestId,
        RejectLeaveRequestDto input,
        CancellationToken ct)
    {
        var managerDeptId = await ResolveManagerDepartmentIdAsync(currentUserId, currentUserRole, ct);

        var lr = await db.LeaveRequests.FirstOrDefaultAsync(x => x.RequestId == requestId, ct)
            ?? throw new AppException(404, "Không tìm thấy đơn nghỉ phép.");

        LeaveApprovalRules.EnsureApprovalAuthority(currentUserRole, managerDeptId, lr.DepartmentId);
        LeaveApprovalRules.EnsurePendingStatus(lr.Status);

        var reason = LeaveApprovalRules.ValidateAndNormalizeRejectReason(input.RejectedReason);

        var approverStaff = await db.Staff.AsNoTracking().FirstOrDefaultAsync(s => s.UserId == currentUserId, ct);
        var approverStaffId = approverStaff?.StaffId ?? currentUserId;

        lr.Status = "rejected";
        lr.ApprovedBy = approverStaffId;
        lr.ApprovedAt = DateTime.UtcNow;
        lr.RejectedReason = reason;
        lr.UpdatedAt = DateTime.UtcNow;

        var oldSnapshot = new { Status = "pending" };
        var newSnapshot = new
        {
            Status = "rejected",
            ApprovedBy = approverStaffId,
            ApprovedAt = lr.ApprovedAt,
            RejectedReason = reason
        };

        auditHelper.Log("reject", "LeaveRequest", lr.RequestId, oldSnapshot, newSnapshot);

        // Notify HR Manager and Employee
        var requesterStaff = await db.Staff.AsNoTracking().FirstOrDefaultAsync(s => s.StaffId == lr.StaffId, ct);
        var hrUsers = await db.Users.AsNoTracking()
            .Where(u => u.Role == AccountRoles.HrManager && u.AccountStatus == "active")
            .ToListAsync(ct);

        foreach (var hr in hrUsers)
        {
            db.Notifications.Add(new Notification
            {
                NotificationId = Guid.NewGuid(),
                RecipientId = hr.UserId,
                SenderService = "LeaveApproval",
                Type = "leave_rejected",
                Title = "Đơn nghỉ phép đã bị từ chối",
                Body = $"Trưởng khoa {approverStaff?.FullName ?? "quản lý"} đã từ chối đơn nghỉ phép của {requesterStaff?.FullName ?? "nhân viên"}. Lý do: {reason}",
                ActionUrl = "/leave-approvals",
                EntityType = "LeaveRequest",
                EntityId = lr.RequestId,
                Channel = "in_app",
                IsRead = false,
                CreatedAt = DateTime.UtcNow
            });
        }

        if (requesterStaff != null && requesterStaff.UserId != Guid.Empty)
        {
            db.Notifications.Add(new Notification
            {
                NotificationId = Guid.NewGuid(),
                RecipientId = requesterStaff.UserId,
                SenderService = "LeaveApproval",
                Type = "leave_rejected",
                Title = "Đơn xin nghỉ phép của bạn đã bị từ chối",
                Body = $"Đơn xin nghỉ phép từ ngày {lr.StartDate:dd/MM/yyyy} đến {lr.EndDate:dd/MM/yyyy} đã bị từ chối. Lý do: {reason}",
                ActionUrl = "/me/leave-requests",
                EntityType = "LeaveRequest",
                EntityId = lr.RequestId,
                Channel = "in_app",
                IsRead = false,
                CreatedAt = DateTime.UtcNow
            });
        }

        await db.SaveChangesAsync(ct);

        return await GetDetailAsync(currentUserId, currentUserRole, requestId, ct);
    }

    private async Task<Guid?> ResolveManagerDepartmentIdAsync(Guid currentUserId, string currentUserRole, CancellationToken ct)
    {
        if (!string.Equals(currentUserRole, AccountRoles.DepartmentManager, StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        var staff = await db.Staff.AsNoTracking().FirstOrDefaultAsync(s => s.UserId == currentUserId, ct);
        if (staff == null)
        {
            return null;
        }

        var managedDept = await db.Departments.AsNoTracking()
            .FirstOrDefaultAsync(d => d.ManagerId == staff.StaffId && d.Status == "active", ct);

        return managedDept?.DepartmentId ?? staff.DepartmentId;
    }
}
