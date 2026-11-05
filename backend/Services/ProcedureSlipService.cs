using System.Data;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Vnc.HRMS.Common.Exceptions;
using Vnc.HRMS.DTOs.Payroll;
using Vnc.HRMS.Models;
using Vnc.HRMS.Persistence;
using Vnc.HRMS.Repositories.Interfaces;
using Vnc.HRMS.Security;
using Vnc.HRMS.Services.Interfaces;
using Vnc.HRMS.Services.Rules;

namespace Vnc.HRMS.Services;

public sealed partial class ProcedureSlipService(
    AppDbContext db,
    IUnitOfWork unitOfWork,
    IAuditLogHelper auditHelper) : IProcedureSlipService
{
    private static readonly Regex MonthRegex = MonthRegexPattern();

    [GeneratedRegex(@"^\d{4}-(0[1-9]|1[0-2])$")]
    private static partial Regex MonthRegexPattern();

    private static string NormalizeSlipStatus(string? status)
    {
        if (string.IsNullOrWhiteSpace(status)) return "pending";
        var s = status.Trim().ToLowerInvariant();
        return s switch
        {
            "approved" => "verified",
            "hr_approved" => "hr_checked",
            _ => s
        };
    }

    private static readonly (string Code, string Name, string Category, decimal BasePrice)[] SampleProcedures =
    [
        ("TT-MAU-01", "Nội soi dạ dày - tá tràng có gây mê", "Thủ thuật Nội soi", 1_500_000m),
        ("TT-MAU-02", "Tiểu phẫu cắt u phần mềm dưới da", "Tiểu phẫu Ngoại khoa", 2_200_000m),
        ("TT-MAU-03", "Siêu âm Doppler tim mạch chuyên sâu", "Chẩn đoán hình ảnh", 850_000m)
    ];

    private async Task EnsureSampleProcedureServicesAsync(Guid currentUserId, CancellationToken ct)
    {
        var sampleCodes = SampleProcedures.Select(x => x.Code).ToList();
        var existingServices = await db.ProcedureServices
            .Where(s => sampleCodes.Contains(s.ServiceCode))
            .ToListAsync(ct);

        bool changed = false;
        foreach (var sample in SampleProcedures)
        {
            var svc = existingServices.FirstOrDefault(s =>
                string.Equals(s.ServiceCode, sample.Code, StringComparison.OrdinalIgnoreCase));

            if (svc == null)
            {
                svc = new ProcedureService
                {
                    ServiceId = Guid.NewGuid(),
                    ServiceCode = sample.Code,
                    ServiceName = sample.Name,
                    Category = sample.Category,
                    BasePrice = sample.BasePrice,
                    Status = "active"
                };
                db.ProcedureServices.Add(svc);
                existingServices.Add(svc);
                changed = true;
            }
            else if (svc.Status != "active")
            {
                svc.Status = "active";
                changed = true;
            }
        }

        if (changed)
        {
            await unitOfWork.SaveChangesAsync(ct);
        }

        var serviceIds = existingServices.Select(x => x.ServiceId).ToList();
        var existingRuleServiceIds = await db.CommissionRules.AsNoTracking()
            .Where(r => r.ServiceId.HasValue && serviceIds.Contains(r.ServiceId.Value) && r.Status == "active")
            .Select(r => r.ServiceId!.Value)
            .Distinct()
            .ToListAsync(ct);

        var defaultRolePercents = new (string Role, decimal Percent)[]
        {
            ("performing", 15m),
            ("assisting", 7m),
            ("indicating", 5m),
            ("lab", 4m),
            ("typist", 2m)
        };

        bool rulesAdded = false;
        foreach (var svc in existingServices)
        {
            if (existingRuleServiceIds.Contains(svc.ServiceId)) continue;

            foreach (var rp in defaultRolePercents)
            {
                db.CommissionRules.Add(new CommissionRule
                {
                    RuleId = Guid.NewGuid(),
                    ServiceId = svc.ServiceId,
                    ServiceCategory = svc.Category,
                    Role = rp.Role,
                    TimeCondition = "all",
                    ValueType = "percent_service",
                    CommissionValue = rp.Percent,
                    EffectiveFrom = new DateOnly(2020, 1, 1),
                    Status = "active",
                    CreatedBy = currentUserId,
                    CreatedAt = DateTime.UtcNow
                });
            }
            rulesAdded = true;
        }

        if (rulesAdded)
        {
            await unitOfWork.SaveChangesAsync(ct);
        }
    }

    public async Task<ProcedureLookupsDto> GetLookupsAsync(Guid currentUserId, CancellationToken ct)
    {
        await EnsureSampleProcedureServicesAsync(currentUserId, ct);

        var sampleCodes = SampleProcedures.Select(x => x.Code).ToList();
        var services = await db.ProcedureServices.AsNoTracking()
            .Where(s => sampleCodes.Contains(s.ServiceCode) && (s.Status == "active" || s.Status == null))
            .OrderBy(s => s.ServiceCode)
            .Select(s => new ProcedureServiceOptionDto(
                s.ServiceId,
                s.ServiceCode,
                s.ServiceName,
                s.Category,
                s.BasePrice))
            .ToListAsync(ct);

        var departments = await db.Departments.AsNoTracking()
            .Where(d => d.Status == "active")
            .OrderBy(d => d.DeptCode)
            .Select(d => new ProcedureLookupDepartmentDto(
                d.DepartmentId,
                d.DeptCode,
                d.Name))
            .ToListAsync(ct);

        var staff = await (
            from s in db.Staff.AsNoTracking()
            where s.Status == "active"
            join d in db.Departments.AsNoTracking() on s.DepartmentId equals d.DepartmentId into deptJoin
            from d in deptJoin.DefaultIfEmpty()
            join p in db.Positions.AsNoTracking() on s.PositionId equals p.PositionId into posJoin
            from p in posJoin.DefaultIfEmpty()
            orderby s.StaffCode
            select new ProcedureLookupStaffDto(
                s.StaffId,
                s.StaffCode,
                s.FullName,
                s.DepartmentId,
                d != null ? d.Name : null,
                s.PositionId,
                p != null ? p.Name : null)
        ).ToListAsync(ct);

        var currentUser = await db.Users.AsNoTracking()
            .FirstOrDefaultAsync(u => u.UserId == currentUserId, ct);
        var currentStaff = await db.Staff.AsNoTracking()
            .FirstOrDefaultAsync(s => s.UserId == currentUserId, ct);

        var creatorName = currentStaff?.FullName
            ?? currentUser?.FullName
            ?? currentUser?.Username
            ?? "Người tạo phiếu";

        return new ProcedureLookupsDto(
            services,
            departments,
            staff,
            currentStaff?.StaffId,
            currentStaff?.StaffCode,
            creatorName,
            currentStaff?.DepartmentId);
    }

    private static (DateOnly? From, DateOnly? To) ResolvePeriodDates(ProcedureSlipListFilter filter)
    {
        if (filter.FromDate.HasValue || filter.ToDate.HasValue)
        {
            return (filter.FromDate, filter.ToDate);
        }

        var periodType = filter.PeriodType?.Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(periodType) || periodType == "all")
        {
            return (null, null);
        }

        var year = filter.Year ?? PayrollParameterRules.TodayVn().Year;
        if (year < 2000 || year > 2100) year = PayrollParameterRules.TodayVn().Year;

        if (periodType == "month")
        {
            var month = filter.Month ?? PayrollParameterRules.TodayVn().Month;
            month = Math.Clamp(month, 1, 12);
            var start = new DateOnly(year, month, 1);
            var end = start.AddMonths(1).AddDays(-1);
            return (start, end);
        }

        if (periodType == "quarter")
        {
            var quarter = filter.Quarter ?? ((PayrollParameterRules.TodayVn().Month - 1) / 3 + 1);
            quarter = Math.Clamp(quarter, 1, 4);
            var startMonth = (quarter - 1) * 3 + 1;
            var start = new DateOnly(year, startMonth, 1);
            var end = start.AddMonths(3).AddDays(-1);
            return (start, end);
        }

        if (periodType == "year")
        {
            return (new DateOnly(year, 1, 1), new DateOnly(year, 12, 31));
        }

        return (null, null);
    }

    public async Task<ProcedureSlipListResponseDto> ListSlipsAsync(
        Guid currentUserId, string currentUserRole, ProcedureSlipListFilter filter, CancellationToken ct)
    {
        if (currentUserRole == AccountRoles.Administrator)
        {
            throw new AppException(403, "Tài khoản Quản trị viên (Admin) không truy cập chức năng quản lý phiếu thủ thuật.");
        }

        var (fromDate, toDate) = ResolvePeriodDates(filter);

        var currentStaff = await db.Staff.AsNoTracking()
            .FirstOrDefaultAsync(s => s.UserId == currentUserId, ct);
        var currentStaffId = currentStaff?.StaffId;
        var currentDeptId = currentStaff?.DepartmentId;

        var lockedMonths = await db.PayrollLocks.AsNoTracking()
            .Where(l => l.Status == "locked" || l.Status == "finalized" || l.Status == "exported")
            .Select(l => l.PayMonth)
            .ToListAsync(ct);
        var lockedMonthSet = new HashSet<string>(lockedMonths, StringComparer.OrdinalIgnoreCase);

        var query = from slip in db.ProcedureSlips.AsNoTracking()
                    join svc in db.ProcedureServices.AsNoTracking() on slip.ServiceId equals svc.ServiceId into svcJoin
                    from svc in svcJoin.DefaultIfEmpty()
                    join dept in db.Departments.AsNoTracking() on slip.DepartmentId equals dept.DepartmentId into deptJoin
                    from dept in deptJoin.DefaultIfEmpty()
                    join indStaff in db.Staff.AsNoTracking() on slip.IndicatingStaffId equals indStaff.StaffId into indJoin
                    from indStaff in indJoin.DefaultIfEmpty()
                    join recUser in db.Users.AsNoTracking() on slip.RecordedBy equals recUser.UserId into recJoin
                    from recUser in recJoin.DefaultIfEmpty()
                    join verUser in db.Users.AsNoTracking() on slip.VerifiedBy equals verUser.UserId into verJoin
                    from verUser in verJoin.DefaultIfEmpty()
                    select new
                    {
                        Slip = slip,
                        ServiceCode = svc != null ? svc.ServiceCode : "N/A",
                        ServiceName = svc != null ? svc.ServiceName : "Dịch vụ không xác định",
                        ServiceCategory = svc != null ? svc.Category : null,
                        DepartmentCode = dept != null ? dept.DeptCode : "UNASSIGNED",
                        DepartmentName = dept != null ? dept.Name : "Chưa phân khoa",
                        IndicatingStaffCode = indStaff != null ? indStaff.StaffCode : null,
                        IndicatingStaffName = indStaff != null
                            ? indStaff.FullName
                            : (recUser != null ? (recUser.FullName ?? recUser.Username) : null),
                        RecordedByName = recUser != null ? (recUser.FullName ?? recUser.Username) : null,
                        VerifiedByName = verUser != null ? (verUser.FullName ?? verUser.Username) : null
                    };

        // Role-based visibility scoping:
        // - hr_staff & accountant: can view all procedure slips
        // - department_head: can view own slips or slips of their own department (unless scope == "mine")
        // - employee (Medical Staff) & hr_manager: can ONLY view their own slips
        bool isFullViewer = currentUserRole == AccountRoles.HrStaff || currentUserRole == AccountRoles.Accountant;
        if (!isFullViewer)
        {
            var mySlipIds = currentStaffId.HasValue
                ? db.ProcedureAssignments.AsNoTracking()
                    .Where(a => a.StaffId == currentStaffId.Value)
                    .Select(a => a.SlipId)
                : Enumerable.Empty<Guid>().AsQueryable();

            bool viewDept = currentUserRole == AccountRoles.DepartmentManager &&
                            currentDeptId.HasValue &&
                            !string.Equals(filter.Scope, "mine", StringComparison.OrdinalIgnoreCase);

            if (viewDept)
            {
                var deptId = currentDeptId!.Value;
                query = query.Where(x =>
                    x.Slip.DepartmentId == deptId ||
                    x.Slip.RecordedBy == currentUserId ||
                    (currentStaffId.HasValue && (x.Slip.IndicatingStaffId == currentStaffId.Value || mySlipIds.Contains(x.Slip.SlipId))));
            }
            else
            {
                query = query.Where(x =>
                    x.Slip.RecordedBy == currentUserId ||
                    (currentStaffId.HasValue && (x.Slip.IndicatingStaffId == currentStaffId.Value || mySlipIds.Contains(x.Slip.SlipId))));
            }
        }

        if (fromDate.HasValue)
        {
            query = query.Where(x => x.Slip.ProcedureDate >= fromDate.Value);
        }

        if (toDate.HasValue)
        {
            query = query.Where(x => x.Slip.ProcedureDate <= toDate.Value);
        }

        if (filter.DepartmentId.HasValue)
        {
            query = query.Where(x => x.Slip.DepartmentId == filter.DepartmentId.Value);
        }

        if (filter.ServiceId.HasValue)
        {
            query = query.Where(x => x.Slip.ServiceId == filter.ServiceId.Value);
        }

        if (filter.IsAfterHours.HasValue)
        {
            query = query.Where(x => x.Slip.IsAfterHours == filter.IsAfterHours.Value);
        }

        if (filter.StaffId.HasValue)
        {
            var staffId = filter.StaffId.Value;
            var slipIdsWithStaff = db.ProcedureAssignments.AsNoTracking()
                .Where(a => a.StaffId == staffId)
                .Select(a => a.SlipId);
            query = query.Where(x => x.Slip.IndicatingStaffId == staffId || slipIdsWithStaff.Contains(x.Slip.SlipId));
        }

        if (!string.IsNullOrWhiteSpace(filter.Q))
        {
            var q = filter.Q.Trim();
            query = query.Where(x =>
                x.Slip.SlipNumber.Contains(q) ||
                (x.Slip.PatientCode != null && x.Slip.PatientCode.Contains(q)) ||
                x.ServiceName.Contains(q) ||
                x.ServiceCode.Contains(q) ||
                (x.IndicatingStaffName != null && x.IndicatingStaffName.Contains(q)));
        }

        var rawRows = await query
            .OrderByDescending(x => x.Slip.ProcedureDate)
            .ThenByDescending(x => x.Slip.CreatedAt)
            .ToListAsync(ct);

        var slipIds = rawRows.Select(r => r.Slip.SlipId).ToList();

        var assignmentStats = slipIds.Count == 0
            ? new Dictionary<Guid, (int Count, decimal TotalCommission)>()
            : (await db.ProcedureAssignments.AsNoTracking()
                .Where(a => slipIds.Contains(a.SlipId))
                .GroupBy(a => a.SlipId)
                .Select(g => new
                {
                    SlipId = g.Key,
                    Count = g.Count(),
                    TotalCommission = g.Sum(a => a.CommissionAmount ?? 0m)
                })
                .ToListAsync(ct))
                .ToDictionary(x => x.SlipId, x => (x.Count, x.TotalCommission));

        var performingStaffBySlip = slipIds.Count == 0
            ? new Dictionary<Guid, (Guid? StaffId, string? StaffCode, string? StaffName)>()
            : (await (
                from a in db.ProcedureAssignments.AsNoTracking()
                where slipIds.Contains(a.SlipId)
                join s in db.Staff.AsNoTracking() on a.StaffId equals s.StaffId into staffJoin
                from s in staffJoin.DefaultIfEmpty()
                select new
                {
                    a.SlipId,
                    a.StaffId,
                    a.Role,
                    StaffCode = s != null ? s.StaffCode : null,
                    StaffName = s != null ? s.FullName : null
                })
                .ToListAsync(ct))
                .GroupBy(x => x.SlipId)
                .ToDictionary(g => g.Key, g =>
                {
                    var perf = g.FirstOrDefault(x => string.Equals(x.Role, "performing", StringComparison.OrdinalIgnoreCase))
                        ?? g.First();
                    return (StaffId: (Guid?)perf.StaffId, StaffCode: (string?)perf.StaffCode, StaffName: (string?)perf.StaffName);
                });

        // Load latest HR check audit logs for these slips (both approve and reject)
        var hrLogs = slipIds.Count == 0
            ? new Dictionary<Guid, (Guid? UserId, string? ActorName, DateTime? CreatedAt)>()
            : (await (
                from l in db.AuditLogs.AsNoTracking()
                where l.EntityType == "ProcedureSlip" && l.EntityId.HasValue && slipIds.Contains(l.EntityId.Value) &&
                      (l.Action == "hr_check_approve" || l.Action == "hr_check_reject")
                join u in db.Users.AsNoTracking() on l.UserId equals u.UserId into userJoin
                from u in userJoin.DefaultIfEmpty()
                orderby l.CreatedAt descending
                select new
                {
                    SlipId = l.EntityId!.Value,
                    l.UserId,
                    ActorName = u != null ? (u.FullName ?? u.Username) : l.Username,
                    l.CreatedAt
                })
                .ToListAsync(ct))
                .GroupBy(x => x.SlipId)
                .ToDictionary(g => g.Key, g =>
                {
                    var latest = g.First();
                    return (UserId: latest.UserId, ActorName: (string?)latest.ActorName, CreatedAt: latest.CreatedAt);
                });

        var allMapped = rawRows.Select(r =>
        {
            assignmentStats.TryGetValue(r.Slip.SlipId, out var stat);
            performingStaffBySlip.TryGetValue(r.Slip.SlipId, out var perfStaff);
            hrLogs.TryGetValue(r.Slip.SlipId, out var hrLog);
            var charged = r.Slip.ChargedAmount ?? 0m;
            var directCost = r.Slip.DirectCost ?? 0m;
            var normStatus = NormalizeSlipStatus(r.Slip.Status);
            var payMonth = r.Slip.ProcedureDate.ToString("yyyy-MM");

            return new ProcedureSlipListItemDto(
                r.Slip.SlipId,
                r.Slip.SlipNumber,
                r.Slip.ProcedureDate,
                r.Slip.PatientCode,
                r.Slip.ServiceId,
                r.ServiceCode,
                r.ServiceName,
                r.ServiceCategory,
                r.Slip.DepartmentId,
                r.DepartmentCode,
                r.DepartmentName,
                charged,
                directCost,
                charged - directCost,
                r.Slip.IsAfterHours,
                r.Slip.DurationHours,
                r.Slip.IndicatingStaffId,
                r.IndicatingStaffCode,
                r.IndicatingStaffName,
                perfStaff.StaffId,
                perfStaff.StaffCode,
                perfStaff.StaffName,
                stat.Count,
                stat.TotalCommission,
                normStatus,
                r.Slip.RecordedBy,
                r.RecordedByName,
                hrLog.UserId,
                hrLog.ActorName,
                hrLog.CreatedAt,
                r.Slip.VerifiedBy,
                r.VerifiedByName,
                r.Slip.VerifiedAt,
                r.Slip.RejectedReason,
                r.Slip.CreatedAt,
                lockedMonthSet.Contains(payMonth));
        }).ToList();

        // Counts across all statuses (matching other filters)
        var allCount = allMapped.Count;
        var pendingCount = allMapped.Count(x => x.Status == "pending");
        var hrCheckedCount = allMapped.Count(x => x.Status == "hr_checked");
        var verifiedCount = allMapped.Count(x => x.Status == "verified");
        var rejectedCount = allMapped.Count(x => x.Status == "rejected");

        // Department aggregation
        var byDepartment = allMapped
            .GroupBy(x => new { x.DepartmentId, Code = x.DepartmentCode ?? "UNASSIGNED", Name = x.DepartmentName ?? "Chưa phân khoa" })
            .Select(g => new ProcedureDepartmentSummaryDto(
                g.Key.DepartmentId,
                g.Key.Code,
                g.Key.Name,
                g.Count(),
                g.Count(x => x.Status == "pending"),
                g.Count(x => x.Status == "hr_checked"),
                g.Count(x => x.Status == "verified"),
                g.Count(x => x.Status == "rejected"),
                g.Sum(x => x.ChargedAmount),
                g.Sum(x => x.DirectCost),
                g.Sum(x => x.NetRevenue),
                g.Sum(x => x.TotalCommissionAmount),
                g.Where(x => x.Status == "verified").Sum(x => x.TotalCommissionAmount)))
            .OrderByDescending(x => x.TotalChargedAmount)
            .ThenBy(x => x.DepartmentName)
            .ToList();

        // Period breakdown (by Month or Quarter depending on filter)
        var groupQuarterly = string.Equals(filter.PeriodType, "year", StringComparison.OrdinalIgnoreCase);
        var byPeriod = allMapped
            .GroupBy(x =>
            {
                if (groupQuarterly)
                {
                    var q = (x.ProcedureDate.Month - 1) / 3 + 1;
                    return (Key: $"{x.ProcedureDate.Year}-Q{q}", Label: $"Quý {q}/{x.ProcedureDate.Year}");
                }
                var key = x.ProcedureDate.ToString("yyyy-MM");
                return (Key: key, Label: $"Tháng {x.ProcedureDate.Month:00}/{x.ProcedureDate.Year}");
            })
            .Select(g => new ProcedurePeriodBreakdownDto(
                g.Key.Key,
                g.Key.Label,
                g.Count(),
                g.Count(x => x.Status == "pending"),
                g.Count(x => x.Status == "hr_checked"),
                g.Count(x => x.Status == "verified"),
                g.Count(x => x.Status == "rejected"),
                g.Sum(x => x.ChargedAmount),
                g.Sum(x => x.DirectCost),
                g.Sum(x => x.TotalCommissionAmount),
                g.Where(x => x.Status == "verified").Sum(x => x.TotalCommissionAmount)))
            .OrderByDescending(x => x.PeriodKey)
            .ToList();

        // Apply status filter for the returned table items & totals
        var statusFilter = filter.Status?.Trim().ToLowerInvariant();
        var filteredItems = (!string.IsNullOrWhiteSpace(statusFilter) && statusFilter != "all")
            ? allMapped.Where(x => x.Status == statusFilter).ToList()
            : allMapped;

        var totalCharged = filteredItems.Sum(x => x.ChargedAmount);
        var totalDirectCost = filteredItems.Sum(x => x.DirectCost);
        var totalNetRevenue = filteredItems.Sum(x => x.NetRevenue);
        var totalCommission = filteredItems.Sum(x => x.TotalCommissionAmount);
        var verifiedCommission = filteredItems.Where(x => x.Status == "verified").Sum(x => x.TotalCommissionAmount);

        var page = Math.Clamp(filter.Page, 1, 10000);
        var pageSize = Math.Clamp(filter.PageSize, 1, 200);
        var pagedItems = filteredItems
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToList();

        return new ProcedureSlipListResponseDto(
            filteredItems.Count,
            page,
            pageSize,
            pagedItems,
            allCount,
            pendingCount,
            hrCheckedCount,
            verifiedCount,
            rejectedCount,
            totalCharged,
            totalDirectCost,
            totalNetRevenue,
            totalCommission,
            verifiedCommission,
            byDepartment,
            byPeriod);
    }

    public async Task<ProcedureSlipDetailDto> GetSlipDetailAsync(
        Guid currentUserId, string currentUserRole, Guid slipId, CancellationToken ct)
    {
        var row = await (
            from slip in db.ProcedureSlips.AsNoTracking()
            where slip.SlipId == slipId
            join svc in db.ProcedureServices.AsNoTracking() on slip.ServiceId equals svc.ServiceId into svcJoin
            from svc in svcJoin.DefaultIfEmpty()
            join dept in db.Departments.AsNoTracking() on slip.DepartmentId equals dept.DepartmentId into deptJoin
            from dept in deptJoin.DefaultIfEmpty()
            join indStaff in db.Staff.AsNoTracking() on slip.IndicatingStaffId equals indStaff.StaffId into indJoin
            from indStaff in indJoin.DefaultIfEmpty()
            join recUser in db.Users.AsNoTracking() on slip.RecordedBy equals recUser.UserId into recJoin
            from recUser in recJoin.DefaultIfEmpty()
            join verUser in db.Users.AsNoTracking() on slip.VerifiedBy equals verUser.UserId into verJoin
            from verUser in verJoin.DefaultIfEmpty()
            select new
            {
                Slip = slip,
                ServiceCode = svc != null ? svc.ServiceCode : "N/A",
                ServiceName = svc != null ? svc.ServiceName : "Dịch vụ không xác định",
                ServiceCategory = svc != null ? svc.Category : null,
                ServiceBasePrice = svc != null ? svc.BasePrice : null,
                DepartmentCode = dept != null ? dept.DeptCode : null,
                DepartmentName = dept != null ? dept.Name : null,
                IndicatingStaffCode = indStaff != null ? indStaff.StaffCode : null,
                IndicatingStaffName = indStaff != null
                    ? indStaff.FullName
                    : (recUser != null ? (recUser.FullName ?? recUser.Username) : null),
                RecordedByName = recUser != null ? (recUser.FullName ?? recUser.Username) : null,
                VerifiedByName = verUser != null ? (verUser.FullName ?? verUser.Username) : null
            }
        ).FirstOrDefaultAsync(ct) ?? throw new AppException(404, "Không tìm thấy phiếu thủ thuật y tế.");

        var payMonth = row.Slip.ProcedureDate.ToString("yyyy-MM");
        var isLocked = await db.PayrollLocks.AsNoTracking()
            .AnyAsync(l => l.PayMonth == payMonth && (l.Status == "locked" || l.Status == "finalized" || l.Status == "exported"), ct);

        var rawAssignments = await (
            from a in db.ProcedureAssignments.AsNoTracking()
            where a.SlipId == slipId
            join s in db.Staff.AsNoTracking() on a.StaffId equals s.StaffId into staffJoin
            from s in staffJoin.DefaultIfEmpty()
            join d in db.Departments.AsNoTracking() on s.DepartmentId equals d.DepartmentId into deptJoin
            from d in deptJoin.DefaultIfEmpty()
            join p in db.Positions.AsNoTracking() on s.PositionId equals p.PositionId into posJoin
            from p in posJoin.DefaultIfEmpty()
            join r in db.CommissionRules.AsNoTracking() on a.RuleId equals r.RuleId into ruleJoin
            from r in ruleJoin.DefaultIfEmpty()
            join o in db.StaffCommissionOverrides.AsNoTracking() on a.RuleId equals o.OverrideId into ovJoin
            from o in ovJoin.DefaultIfEmpty()
            select new
            {
                Assignment = a,
                StaffCode = s != null ? s.StaffCode : "N/A",
                StaffName = s != null ? s.FullName : "Nhân sự không xác định",
                DepartmentName = d != null ? d.Name : null,
                PositionName = p != null ? p.Name : null,
                Rule = r,
                Override = o
            }
        ).ToListAsync(ct);

        var assignments = rawAssignments.Select(x =>
        {
            string ruleSource = "manual";
            string? valueType = null;
            decimal? ruleValue = null;

            if (x.Override != null)
            {
                ruleSource = "staff_override";
                valueType = x.Override.ValueType;
                ruleValue = x.Override.CommissionValue;
            }
            else if (x.Rule != null)
            {
                ruleSource = x.Rule.ServiceId.HasValue ? "service_rule" : "category_rule";
                valueType = x.Rule.ValueType;
                ruleValue = x.Rule.CommissionValue;
            }

            return new ProcedureAssignmentDto(
                x.Assignment.AssignmentId,
                x.Assignment.SlipId,
                x.Assignment.StaffId,
                x.StaffCode,
                x.StaffName,
                x.DepartmentName,
                x.PositionName,
                x.Assignment.Role,
                x.Assignment.RuleId,
                ruleSource,
                valueType,
                ruleValue,
                x.Assignment.CommissionAmount ?? 0m,
                x.Assignment.PayslipId,
                NormalizeSlipStatus(x.Assignment.Status));
        }).ToList();

        var rawLogs = await (
            from l in db.AuditLogs.AsNoTracking()
            where l.EntityType == "ProcedureSlip" && l.EntityId == slipId
            join u in db.Users.AsNoTracking() on l.UserId equals u.UserId into userJoin
            from u in userJoin.DefaultIfEmpty()
            orderby l.CreatedAt descending
            select new
            {
                Log = l,
                ActorFullName = u != null ? (u.FullName ?? u.Username) : l.Username
            }
        ).ToListAsync(ct);

        Guid? hrCheckedBy = null;
        string? hrCheckedByName = null;
        DateTime? hrCheckedAt = null;
        string? hrCheckNote = null;
        string? verifyNote = null;

        var latestHrLog = rawLogs.FirstOrDefault(x => x.Log.Action == "hr_check_approve" || x.Log.Action == "hr_check_reject");
        if (latestHrLog != null)
        {
            hrCheckedBy = latestHrLog.Log.UserId;
            hrCheckedByName = latestHrLog.ActorFullName;
            hrCheckedAt = latestHrLog.Log.CreatedAt;
            hrCheckNote = ExtractNoteFromJson(latestHrLog.Log.NewValue);
        }

        var latestAccVerify = rawLogs.FirstOrDefault(x => x.Log.Action == "accountant_verify_approve");
        if (latestAccVerify != null)
        {
            verifyNote = ExtractNoteFromJson(latestAccVerify.Log.NewValue);
        }

        var auditHistory = rawLogs.Select(x => new ProcedureSlipAuditItemDto(
            x.Log.LogId,
            x.Log.Action,
            x.Log.Username,
            x.ActorFullName,
            ExtractNoteFromJson(x.Log.NewValue),
            x.Log.CreatedAt)).ToList();

        var normStatus = NormalizeSlipStatus(row.Slip.Status);
        var charged = row.Slip.ChargedAmount ?? 0m;
        var directCost = row.Slip.DirectCost ?? 0m;

        if (currentUserRole == AccountRoles.Administrator)
        {
            throw new AppException(403, "Tài khoản Quản trị viên (Admin) không truy cập chức năng quản lý phiếu thủ thuật.");
        }

        bool isFullViewer = currentUserRole == AccountRoles.HrStaff || currentUserRole == AccountRoles.Accountant;
        if (!isFullViewer)
        {
            var currentStaff = await db.Staff.AsNoTracking()
                .FirstOrDefaultAsync(s => s.UserId == currentUserId, ct);
            var currentStaffId = currentStaff?.StaffId;
            var currentDeptId = currentStaff?.DepartmentId;

            bool isOwnSlip = row.Slip.RecordedBy == currentUserId ||
                             (currentStaffId.HasValue && (row.Slip.IndicatingStaffId == currentStaffId.Value ||
                                                          assignments.Any(a => a.StaffId == currentStaffId.Value)));
            bool isDeptSlip = currentUserRole == AccountRoles.DepartmentManager &&
                              currentDeptId.HasValue &&
                              row.Slip.DepartmentId == currentDeptId.Value;

            if (!isOwnSlip && !isDeptSlip)
            {
                throw new AppException(403, "Bạn chỉ có quyền xem phiếu thủ thuật của cá nhân hoặc thuộc khoa/phòng quản lý.");
            }
        }

        bool canEdit = !isLocked &&
                       (normStatus == "pending" || normStatus == "rejected") &&
                       currentUserRole != AccountRoles.HrStaff &&
                       currentUserRole != AccountRoles.Accountant &&
                       row.Slip.RecordedBy == currentUserId;
        bool canHrCheck = !isLocked && normStatus == "pending" &&
                          currentUserRole == AccountRoles.HrStaff;
        bool canAccountantVerify = !isLocked && normStatus == "hr_checked" &&
                                   currentUserRole == AccountRoles.Accountant;

        var primaryPerforming = assignments.FirstOrDefault(x => string.Equals(x.Role, "performing", StringComparison.OrdinalIgnoreCase))
            ?? assignments.FirstOrDefault();

        return new ProcedureSlipDetailDto(
            row.Slip.SlipId,
            row.Slip.SlipNumber,
            row.Slip.ProcedureDate,
            row.Slip.PatientCode,
            row.Slip.ServiceId,
            row.ServiceCode,
            row.ServiceName,
            row.ServiceCategory,
            row.ServiceBasePrice,
            row.Slip.DepartmentId,
            row.DepartmentCode,
            row.DepartmentName,
            charged,
            directCost,
            charged - directCost,
            row.Slip.IsAfterHours,
            row.Slip.DurationHours,
            row.Slip.IndicatingStaffId,
            row.IndicatingStaffCode,
            row.IndicatingStaffName,
            primaryPerforming?.StaffId,
            primaryPerforming?.StaffCode,
            primaryPerforming?.StaffName,
            assignments.Count,
            assignments.Sum(x => x.CommissionAmount),
            normStatus,
            row.Slip.RecordedBy,
            row.RecordedByName,
            hrCheckedBy,
            hrCheckedByName,
            hrCheckedAt,
            hrCheckNote,
            row.Slip.VerifiedBy,
            row.VerifiedByName,
            row.Slip.VerifiedAt,
            verifyNote,
            row.Slip.RejectedReason,
            row.Slip.CreatedAt,
            isLocked,
            canEdit,
            canHrCheck,
            canAccountantVerify,
            assignments,
            auditHistory);
    }

    private static string? ExtractNoteFromJson(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        try
        {
            using var doc = JsonDocument.Parse(json);
            if (doc.RootElement.TryGetProperty("note", out var noteProp) && noteProp.ValueKind == JsonValueKind.String)
                return noteProp.GetString();
            if (doc.RootElement.TryGetProperty("reason", out var reasonProp) && reasonProp.ValueKind == JsonValueKind.String)
                return reasonProp.GetString();
            if (doc.RootElement.TryGetProperty("rejectedReason", out var rejProp) && rejProp.ValueKind == JsonValueKind.String)
                return rejProp.GetString();
        }
        catch
        {
            // Ignore malformed JSON
        }
        return null;
    }

    public async Task<IReadOnlyList<PreviewAssignmentCommissionDto>> PreviewCommissionAsync(
        PreviewProcedureCommissionRequest request, CancellationToken ct)
    {
        var service = await db.ProcedureServices.AsNoTracking()
            .FirstOrDefaultAsync(s => s.ServiceId == request.ServiceId, ct)
            ?? throw new AppException(404, "Không tìm thấy dịch vụ thủ thuật.");

        return await CalculateAssignmentsCommissionAsync(
            service,
            request.ProcedureDate,
            request.ChargedAmount,
            request.DirectCost,
            request.IsAfterHours,
            request.DurationHours,
            request.Assignments,
            ct);
    }

    private async Task<IReadOnlyList<PreviewAssignmentCommissionDto>> CalculateAssignmentsCommissionAsync(
        ProcedureService service,
        DateOnly procedureDate,
        decimal chargedAmount,
        decimal directCost,
        bool isAfterHours,
        decimal? durationHours,
        IReadOnlyList<SaveProcedureAssignmentInput> inputs,
        CancellationToken ct)
    {
        if (inputs.Count == 0) return [];

        var staffIds = inputs.Select(x => x.StaffId).Distinct().ToList();
        var staffMap = await (
            from s in db.Staff.AsNoTracking()
            where staffIds.Contains(s.StaffId)
            join p in db.Positions.AsNoTracking() on s.PositionId equals p.PositionId into posJoin
            from p in posJoin.DefaultIfEmpty()
            select new
            {
                s.StaffId,
                s.StaffCode,
                s.FullName,
                s.PositionId,
                PositionName = p != null ? p.Name : null,
                s.Status
            }
        ).ToDictionaryAsync(x => x.StaffId, ct);

        // Fetch active overrides on procedureDate
        var overrides = await db.StaffCommissionOverrides.AsNoTracking()
            .Where(o => staffIds.Contains(o.StaffId) &&
                        o.Status == "active" &&
                        o.EffectiveFrom <= procedureDate &&
                        (o.EffectiveTo == null || o.EffectiveTo >= procedureDate) &&
                        (o.ServiceId == service.ServiceId || (o.ServiceId == null && o.ServiceCategory == service.Category)))
            .ToListAsync(ct);

        // Fetch active commission rules on procedureDate
        var rules = await db.CommissionRules.AsNoTracking()
            .Where(r => r.Status == "active" &&
                        r.EffectiveFrom <= procedureDate &&
                        (r.EffectiveTo == null || r.EffectiveTo >= procedureDate) &&
                        (r.ServiceId == service.ServiceId || (r.ServiceId == null && r.ServiceCategory == service.Category)))
            .ToListAsync(ct);

        var timeSlug = isAfterHours ? "after_hours" : "in_hours";
        var results = new List<PreviewAssignmentCommissionDto>(inputs.Count);

        foreach (var item in inputs)
        {
            if (!staffMap.TryGetValue(item.StaffId, out var staff))
            {
                throw new AppException(404, "Một hoặc nhiều nhân sự trong kíp thực hiện không tồn tại.");
            }

            var role = PayrollParameterRules.RequireOption(item.Role, PayrollParameterRules.CommissionRoles, "Vai trò thực hiện");

            if (item.CustomCommissionAmount.HasValue)
            {
                PayrollParameterRules.EnsureMoney(item.CustomCommissionAmount.Value, "Hoa hồng nhân sự");
                results.Add(new PreviewAssignmentCommissionDto(
                    staff.StaffId,
                    staff.StaffCode,
                    staff.FullName,
                    staff.PositionName,
                    role,
                    null,
                    "manual",
                    "fixed",
                    item.CustomCommissionAmount.Value,
                    Math.Round(item.CustomCommissionAmount.Value, 0, MidpointRounding.AwayFromZero)));
                continue;
            }

            // 1. Check StaffCommissionOverride (Priority: exact ServiceId -> Category; exact timeCondition -> 'all')
            var matchedOverride = overrides
                .Where(o => o.StaffId == staff.StaffId &&
                            string.Equals(o.Role, role, StringComparison.OrdinalIgnoreCase) &&
                            (o.TimeCondition == timeSlug || o.TimeCondition == "all"))
                .OrderByDescending(o => o.ServiceId.HasValue)
                .ThenByDescending(o => o.TimeCondition == timeSlug)
                .FirstOrDefault();

            if (matchedOverride != null)
            {
                var amt = ComputeCommissionMoney(matchedOverride.ValueType, matchedOverride.CommissionValue, chargedAmount, directCost, durationHours);
                results.Add(new PreviewAssignmentCommissionDto(
                    staff.StaffId,
                    staff.StaffCode,
                    staff.FullName,
                    staff.PositionName,
                    role,
                    matchedOverride.OverrideId,
                    "staff_override",
                    matchedOverride.ValueType,
                    matchedOverride.CommissionValue,
                    amt));
                continue;
            }

            // 2. Check CommissionRule (Priority: exact ServiceId -> Category; matching PositionId -> null; exact timeCondition -> 'all')
            var matchedRule = rules
                .Where(r => string.Equals(r.Role, role, StringComparison.OrdinalIgnoreCase) &&
                            (r.PositionId == null || r.PositionId == staff.PositionId) &&
                            (r.TimeCondition == timeSlug || r.TimeCondition == "all"))
                .OrderByDescending(r => r.ServiceId.HasValue)
                .ThenByDescending(r => r.PositionId.HasValue && r.PositionId == staff.PositionId)
                .ThenByDescending(r => r.TimeCondition == timeSlug)
                .FirstOrDefault();

            if (matchedRule != null)
            {
                var amt = ComputeCommissionMoney(matchedRule.ValueType, matchedRule.CommissionValue, chargedAmount, directCost, durationHours);
                results.Add(new PreviewAssignmentCommissionDto(
                    staff.StaffId,
                    staff.StaffCode,
                    staff.FullName,
                    staff.PositionName,
                    role,
                    matchedRule.RuleId,
                    matchedRule.ServiceId.HasValue ? "service_rule" : "category_rule",
                    matchedRule.ValueType,
                    matchedRule.CommissionValue,
                    amt));
                continue;
            }

            // Default 0 if no rule configured and no manual override
            results.Add(new PreviewAssignmentCommissionDto(
                staff.StaffId,
                staff.StaffCode,
                staff.FullName,
                staff.PositionName,
                role,
                null,
                "no_rule",
                "fixed",
                0m,
                0m));
        }

        return results;
    }

    private static decimal ComputeCommissionMoney(
        string valueType, decimal commissionValue, decimal chargedAmount, decimal directCost, decimal? durationHours)
    {
        var vt = valueType.Trim().ToLowerInvariant();
        decimal raw = vt switch
        {
            "fixed" => commissionValue,
            "percent_service" => chargedAmount * (commissionValue / 100m),
            "percent_profit" => Math.Max(0m, chargedAmount - directCost) * (commissionValue / 100m),
            "per_hour" => (durationHours ?? 1m) * commissionValue,
            _ => 0m
        };
        return Math.Round(Math.Max(0m, raw), 0, MidpointRounding.AwayFromZero);
    }

    private async Task ValidateAndEnsureUnlockedMonthAsync(DateOnly procedureDate, CancellationToken ct)
    {
        if (procedureDate < new DateOnly(2020, 1, 1) || procedureDate > PayrollParameterRules.TodayVn().AddDays(7))
        {
            throw new AppException(400, "Ngày thực hiện thủ thuật không hợp lệ.");
        }

        var payMonth = procedureDate.ToString("yyyy-MM");
        var isLocked = await db.PayrollLocks.AsNoTracking()
            .AnyAsync(l => l.PayMonth == payMonth && (l.Status == "locked" || l.Status == "finalized" || l.Status == "exported"), ct);

        if (isLocked)
        {
            throw new AppException(409, $"Kỳ tính lương tháng {payMonth} đã khóa, không thể thêm hoặc chỉnh sửa phiếu thủ thuật trong kỳ này.");
        }
    }

    public async Task<ProcedureSlipDetailDto> CreateSlipAsync(
        Guid currentUserId, string currentUserRole, SaveProcedureSlipRequest request, CancellationToken ct)
    {
        if (currentUserRole == AccountRoles.HrStaff || currentUserRole == AccountRoles.Accountant)
        {
            throw new AppException(403, "Nhân sự và Kế toán chỉ thực hiện kiểm duyệt phiếu thủ thuật, không lập phiếu mới.");
        }

        await ValidateAndEnsureUnlockedMonthAsync(request.ProcedureDate, ct);

        PayrollParameterRules.EnsureMoney(request.ChargedAmount, "Số tiền thu viện phí");
        PayrollParameterRules.EnsureMoney(request.DirectCost, "Chi phí trực tiếp");

        if (request.ChargedAmount <= 0)
        {
            throw new AppException(400, "Số tiền thu viện phí phải lớn hơn 0.");
        }

        if (request.DurationHours.HasValue && (request.DurationHours.Value <= 0 || request.DurationHours.Value > 48))
        {
            throw new AppException(400, "Thời lượng thực hiện phải nằm trong khoảng 0.1 đến 48 giờ.");
        }

        if (request.Assignments is null || request.Assignments.Count == 0)
        {
            throw new AppException(400, "Phiếu thủ thuật phải có ít nhất 1 nhân sự tham gia trong kíp thực hiện.");
        }

        var service = await db.ProcedureServices.AsNoTracking()
            .FirstOrDefaultAsync(s => s.ServiceId == request.ServiceId && (s.Status == "active" || s.Status == null), ct)
            ?? throw new AppException(404, "Dịch vụ thủ thuật không tồn tại hoặc đã ngừng hoạt động.");

        if (request.DepartmentId.HasValue)
        {
            var deptExists = await db.Departments.AsNoTracking()
                .AnyAsync(d => d.DepartmentId == request.DepartmentId.Value && d.Status == "active", ct);
            if (!deptExists)
            {
                throw new AppException(404, "Khoa/phòng không tồn tại hoặc đã ngừng hoạt động.");
            }
        }

        var patientCode = string.IsNullOrWhiteSpace(request.PatientCode)
            ? null
            : PayrollParameterRules.RequireText(request.PatientCode, "Mã bệnh nhân", 50).ToUpperInvariant();

        var calculatedAssignments = await CalculateAssignmentsCommissionAsync(
            service,
            request.ProcedureDate,
            request.ChargedAmount,
            request.DirectCost,
            request.IsAfterHours,
            request.DurationHours,
            request.Assignments,
            ct);

        await using var tx = await unitOfWork.BeginTransactionAsync(ct, IsolationLevel.Serializable);

        string slipNumber;
        if (!string.IsNullOrWhiteSpace(request.SlipNumber))
        {
            slipNumber = PayrollParameterRules.NormalizeCode(request.SlipNumber, 50);
            var exists = await db.ProcedureSlips.AnyAsync(s => s.SlipNumber == slipNumber, ct);
            if (exists)
            {
                throw new AppException(409, $"Số phiếu thủ thuật '{slipNumber}' đã tồn tại.");
            }
        }
        else
        {
            var prefix = $"TT-{request.ProcedureDate:yyyyMMdd}-";
            var countToday = await db.ProcedureSlips.CountAsync(s => s.SlipNumber.StartsWith(prefix), ct);
            slipNumber = $"{prefix}{(countToday + 1):000}";
            while (await db.ProcedureSlips.AnyAsync(s => s.SlipNumber == slipNumber, ct))
            {
                countToday++;
                slipNumber = $"{prefix}{(countToday + 1):000}";
            }
        }

        var creatorStaff = await db.Staff.AsNoTracking()
            .FirstOrDefaultAsync(s => s.UserId == currentUserId, ct);

        var indicatingStaffId = creatorStaff?.StaffId
            ?? request.IndicatingStaffId
            ?? calculatedAssignments.FirstOrDefault(x => x.Role == "indicating")?.StaffId;

        var slip = new ProcedureSlip
        {
            SlipId = Guid.NewGuid(),
            ServiceId = service.ServiceId,
            DepartmentId = request.DepartmentId ?? creatorStaff?.DepartmentId,
            SlipNumber = slipNumber,
            ProcedureDate = request.ProcedureDate,
            PatientCode = patientCode,
            ChargedAmount = request.ChargedAmount,
            DirectCost = request.DirectCost,
            IsAfterHours = request.IsAfterHours,
            DurationHours = request.DurationHours,
            IndicatingStaffId = indicatingStaffId,
            Status = "pending",
            RecordedBy = currentUserId,
            CreatedAt = DateTime.UtcNow
        };

        db.ProcedureSlips.Add(slip);

        foreach (var a in calculatedAssignments)
        {
            db.ProcedureAssignments.Add(new ProcedureAssignment
            {
                AssignmentId = Guid.NewGuid(),
                SlipId = slip.SlipId,
                StaffId = a.StaffId,
                Role = a.Role,
                RuleId = a.RuleId,
                CommissionAmount = a.CommissionAmount,
                Status = "pending"
            });
        }

        auditHelper.Log("create", "ProcedureSlip", slip.SlipId, null, new
        {
            slip.SlipNumber,
            slip.ProcedureDate,
            slip.PatientCode,
            slip.ServiceId,
            slip.DepartmentId,
            slip.ChargedAmount,
            slip.DirectCost,
            slip.Status,
            note = "Tạo mới phiếu thủ thuật và gửi HR kiểm tra."
        });

        await unitOfWork.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        return await GetSlipDetailAsync(currentUserId, currentUserRole, slip.SlipId, ct);
    }

    public async Task<ProcedureSlipDetailDto> UpdateSlipAsync(
        Guid currentUserId, string currentUserRole, Guid slipId, SaveProcedureSlipRequest request, CancellationToken ct)
    {
        if (currentUserRole == AccountRoles.HrStaff || currentUserRole == AccountRoles.Accountant)
        {
            throw new AppException(403, "Nhân sự và Kế toán chỉ thực hiện xem và kiểm duyệt phiếu thủ thuật, không có quyền chỉnh sửa phiếu.");
        }

        var slip = await db.ProcedureSlips.FirstOrDefaultAsync(s => s.SlipId == slipId, ct)
            ?? throw new AppException(404, "Không tìm thấy phiếu thủ thuật y tế.");

        if (slip.RecordedBy != currentUserId)
        {
            throw new AppException(403, "Chỉ người tạo phiếu mới có quyền chỉnh sửa phiếu thủ thuật.");
        }

        var currentStatus = NormalizeSlipStatus(slip.Status);
        if (currentStatus == "verified" || currentStatus == "hr_checked")
        {
            throw new AppException(409, "Phiếu thủ thuật đã qua kiểm duyệt nên không thể chỉnh sửa.");
        }

        await ValidateAndEnsureUnlockedMonthAsync(slip.ProcedureDate, ct);
        await ValidateAndEnsureUnlockedMonthAsync(request.ProcedureDate, ct);

        PayrollParameterRules.EnsureMoney(request.ChargedAmount, "Số tiền thu viện phí");
        PayrollParameterRules.EnsureMoney(request.DirectCost, "Chi phí trực tiếp");

        if (request.ChargedAmount <= 0)
        {
            throw new AppException(400, "Số tiền thu viện phí phải lớn hơn 0.");
        }

        if (request.DurationHours.HasValue && (request.DurationHours.Value <= 0 || request.DurationHours.Value > 48))
        {
            throw new AppException(400, "Thời lượng thực hiện phải nằm trong khoảng 0.1 đến 48 giờ.");
        }

        if (request.Assignments is null || request.Assignments.Count == 0)
        {
            throw new AppException(400, "Phiếu thủ thuật phải có ít nhất 1 nhân sự tham gia trong kíp thực hiện.");
        }

        var service = await db.ProcedureServices.AsNoTracking()
            .FirstOrDefaultAsync(s => s.ServiceId == request.ServiceId && (s.Status == "active" || s.Status == null), ct)
            ?? throw new AppException(404, "Dịch vụ thủ thuật không tồn tại hoặc đã ngừng hoạt động.");

        if (request.DepartmentId.HasValue)
        {
            var deptExists = await db.Departments.AsNoTracking()
                .AnyAsync(d => d.DepartmentId == request.DepartmentId.Value && d.Status == "active", ct);
            if (!deptExists)
            {
                throw new AppException(404, "Khoa/phòng không tồn tại hoặc đã ngừng hoạt động.");
            }
        }

        var patientCode = string.IsNullOrWhiteSpace(request.PatientCode)
            ? null
            : PayrollParameterRules.RequireText(request.PatientCode, "Mã bệnh nhân", 50).ToUpperInvariant();

        var calculatedAssignments = await CalculateAssignmentsCommissionAsync(
            service,
            request.ProcedureDate,
            request.ChargedAmount,
            request.DirectCost,
            request.IsAfterHours,
            request.DurationHours,
            request.Assignments,
            ct);

        await using var tx = await unitOfWork.BeginTransactionAsync(ct, IsolationLevel.Serializable);

        var oldSnapshot = new
        {
            slip.SlipNumber,
            slip.ProcedureDate,
            slip.PatientCode,
            slip.ServiceId,
            slip.DepartmentId,
            slip.ChargedAmount,
            slip.DirectCost,
            slip.IsAfterHours,
            slip.DurationHours,
            slip.Status,
            slip.RejectedReason
        };

        var wasRejected = currentStatus == "rejected";

        slip.ServiceId = service.ServiceId;
        slip.DepartmentId = request.DepartmentId;
        slip.ProcedureDate = request.ProcedureDate;
        slip.PatientCode = patientCode;
        slip.ChargedAmount = request.ChargedAmount;
        slip.DirectCost = request.DirectCost;
        slip.IsAfterHours = request.IsAfterHours;
        slip.DurationHours = request.DurationHours;
        slip.IndicatingStaffId = request.IndicatingStaffId
            ?? calculatedAssignments.FirstOrDefault(x => x.Role == "indicating")?.StaffId;

        // Reset to pending so HR checks the updated slip
        slip.Status = "pending";
        slip.RejectedReason = null;
        slip.VerifiedBy = null;
        slip.VerifiedAt = null;

        var existingAssignments = await db.ProcedureAssignments
            .Where(a => a.SlipId == slip.SlipId)
            .ToListAsync(ct);
        db.ProcedureAssignments.RemoveRange(existingAssignments);

        foreach (var a in calculatedAssignments)
        {
            db.ProcedureAssignments.Add(new ProcedureAssignment
            {
                AssignmentId = Guid.NewGuid(),
                SlipId = slip.SlipId,
                StaffId = a.StaffId,
                Role = a.Role,
                RuleId = a.RuleId,
                CommissionAmount = a.CommissionAmount,
                Status = "pending"
            });
        }

        auditHelper.Log(wasRejected ? "resubmit" : "update", "ProcedureSlip", slip.SlipId, oldSnapshot, new
        {
            slip.SlipNumber,
            slip.ProcedureDate,
            slip.PatientCode,
            slip.ServiceId,
            slip.DepartmentId,
            slip.ChargedAmount,
            slip.DirectCost,
            slip.IsAfterHours,
            slip.DurationHours,
            slip.Status,
            note = wasRejected
                ? "Chỉnh sửa phiếu bị từ chối và gửi duyệt lại (Pending)."
                : "Cập nhật thông tin phiếu thủ thuật."
        });

        await unitOfWork.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        return await GetSlipDetailAsync(currentUserId, currentUserRole, slip.SlipId, ct);
    }

    public async Task<ProcedureSlipDetailDto> HrCheckSlipAsync(
        Guid currentUserId, string currentUserRole, Guid slipId, ReviewProcedureSlipRequest request, CancellationToken ct)
    {
        if (currentUserRole != AccountRoles.HrStaff)
        {
            throw new AppException(403, "Chỉ Nhân viên Nhân sự (HR Staff) mới có quyền kiểm tra phiếu thủ thuật đợt 1.");
        }

        var slip = await db.ProcedureSlips.FirstOrDefaultAsync(s => s.SlipId == slipId, ct)
            ?? throw new AppException(404, "Không tìm thấy phiếu thủ thuật y tế.");

        await ValidateAndEnsureUnlockedMonthAsync(slip.ProcedureDate, ct);

        var currentStatus = NormalizeSlipStatus(slip.Status);
        if (currentStatus != "pending")
        {
            throw new AppException(409, $"Phiếu thủ thuật đang ở trạng thái '{currentStatus}', không thể thực hiện bước HR kiểm tra.");
        }

        var decision = request.Decision?.Trim().ToLowerInvariant();
        if (decision != "approve" && decision != "reject")
        {
            throw new AppException(400, "Quyết định kiểm tra chỉ được là 'approve' (Đạt) hoặc 'reject' (Từ chối).");
        }

        await using var tx = await unitOfWork.BeginTransactionAsync(ct, IsolationLevel.Serializable);

        var assignments = await db.ProcedureAssignments.Where(a => a.SlipId == slipId).ToListAsync(ct);
        var oldStatus = slip.Status;

        if (decision == "approve")
        {
            var note = string.IsNullOrWhiteSpace(request.Note)
                ? "HR đã kiểm tra kíp thực hiện và quy tắc hoa hồng đạt yêu cầu."
                : request.Note.Trim();

            slip.Status = "hr_checked";
            slip.RejectedReason = null;
            foreach (var a in assignments)
            {
                a.Status = "hr_checked";
            }

            auditHelper.Log("hr_check_approve", "ProcedureSlip", slip.SlipId, new { status = oldStatus }, new
            {
                status = slip.Status,
                note
            });
        }
        else
        {
            var reason = string.IsNullOrWhiteSpace(request.Reason) ? request.Note : request.Reason;
            if (string.IsNullOrWhiteSpace(reason) || reason.Trim().Length < 5)
            {
                throw new AppException(400, "Vui lòng nhập lý do từ chối tối thiểu 5 ký tự để thông báo cho nhân viên y tế.");
            }

            var formattedReason = $"[HR từ chối] {reason.Trim()}";
            slip.Status = "rejected";
            slip.RejectedReason = formattedReason;
            foreach (var a in assignments)
            {
                a.Status = "rejected";
            }

            auditHelper.Log("hr_check_reject", "ProcedureSlip", slip.SlipId, new { status = oldStatus }, new
            {
                status = slip.Status,
                rejectedReason = formattedReason,
                note = formattedReason
            });

            await NotifyMedicalStaffOnRejectionAsync(slip, assignments, formattedReason, "HR", ct);
        }

        await unitOfWork.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        return await GetSlipDetailAsync(currentUserId, currentUserRole, slip.SlipId, ct);
    }

    public async Task<ProcedureSlipDetailDto> VerifySlipAsync(
        Guid currentUserId, string currentUserRole, Guid slipId, ReviewProcedureSlipRequest request, CancellationToken ct)
    {
        if (currentUserRole != AccountRoles.Accountant)
        {
            throw new AppException(403, "Chỉ Kế toán (Accountant) mới có quyền xác minh tài chính phiếu thủ thuật.");
        }

        var slip = await db.ProcedureSlips.FirstOrDefaultAsync(s => s.SlipId == slipId, ct)
            ?? throw new AppException(404, "Không tìm thấy phiếu thủ thuật y tế.");

        await ValidateAndEnsureUnlockedMonthAsync(slip.ProcedureDate, ct);

        var currentStatus = NormalizeSlipStatus(slip.Status);
        if (currentStatus == "verified")
        {
            throw new AppException(409, "Phiếu thủ thuật này đã được xác minh (Verified) trước đó.");
        }

        if (currentStatus == "rejected")
        {
            throw new AppException(409, "Phiếu thủ thuật đang bị từ chối. Nhân viên y tế cần chỉnh sửa và gửi lại trước khi xác minh.");
        }

        var decision = request.Decision?.Trim().ToLowerInvariant();
        if (decision != "approve" && decision != "reject")
        {
            throw new AppException(400, "Quyết định xác minh chỉ được là 'approve' (Xác minh hợp lệ) hoặc 'reject' (Từ chối).");
        }

        await using var tx = await unitOfWork.BeginTransactionAsync(ct, IsolationLevel.Serializable);

        var assignments = await db.ProcedureAssignments.Where(a => a.SlipId == slipId).ToListAsync(ct);
        var oldStatus = slip.Status;

        if (decision == "approve")
        {
            var note = string.IsNullOrWhiteSpace(request.Note)
                ? "Kế toán đã đối soát viện phí và xác minh hoa hồng hợp lệ."
                : request.Note.Trim();

            slip.Status = "verified";
            slip.VerifiedBy = currentUserId;
            slip.VerifiedAt = DateTime.UtcNow;
            slip.RejectedReason = null;

            foreach (var a in assignments)
            {
                a.Status = "verified";
            }

            auditHelper.Log("accountant_verify_approve", "ProcedureSlip", slip.SlipId, new { status = oldStatus }, new
            {
                status = slip.Status,
                verifiedBy = currentUserId,
                verifiedAt = slip.VerifiedAt,
                note
            });

            if (slip.RecordedBy.HasValue)
            {
                db.Notifications.Add(new Notification
                {
                    NotificationId = Guid.NewGuid(),
                    RecipientId = slip.RecordedBy.Value,
                    SenderService = "payroll",
                    Type = "procedure_verified",
                    Title = $"Phiếu thủ thuật {slip.SlipNumber} đã được xác minh",
                    Body = $"Phiếu thủ thuật {slip.SlipNumber} (ngày {slip.ProcedureDate:dd/MM/yyyy}) đã được Kế toán xác minh và đưa vào kỳ tính hoa hồng tháng {slip.ProcedureDate:MM/yyyy}.",
                    ActionUrl = $"/procedures/{slip.SlipId}",
                    EntityType = "ProcedureSlip",
                    EntityId = slip.SlipId,
                    Channel = "in_app",
                    IsRead = false,
                    CreatedAt = DateTime.UtcNow
                });
            }
        }
        else
        {
            var reason = string.IsNullOrWhiteSpace(request.Reason) ? request.Note : request.Reason;
            if (string.IsNullOrWhiteSpace(reason) || reason.Trim().Length < 5)
            {
                throw new AppException(400, "Vui lòng nhập lý do từ chối tối thiểu 5 ký tự để thông báo cho nhân viên y tế.");
            }

            var formattedReason = $"[Kế toán từ chối] {reason.Trim()}";
            slip.Status = "rejected";
            slip.VerifiedBy = currentUserId;
            slip.VerifiedAt = DateTime.UtcNow;
            slip.RejectedReason = formattedReason;

            foreach (var a in assignments)
            {
                a.Status = "rejected";
            }

            auditHelper.Log("accountant_verify_reject", "ProcedureSlip", slip.SlipId, new { status = oldStatus }, new
            {
                status = slip.Status,
                rejectedReason = formattedReason,
                note = formattedReason
            });

            await NotifyMedicalStaffOnRejectionAsync(slip, assignments, formattedReason, "Kế toán", ct);
        }

        await unitOfWork.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        return await GetSlipDetailAsync(currentUserId, currentUserRole, slip.SlipId, ct);
    }

    private async Task NotifyMedicalStaffOnRejectionAsync(
        ProcedureSlip slip, IReadOnlyList<ProcedureAssignment> assignments, string reason, string stageName, CancellationToken ct)
    {
        var recipientUserIds = new HashSet<Guid>();
        if (slip.RecordedBy.HasValue)
        {
            recipientUserIds.Add(slip.RecordedBy.Value);
        }

        var staffIds = assignments.Select(a => a.StaffId).Distinct().ToList();
        if (staffIds.Count > 0)
        {
            var staffUserIds = await db.Staff.AsNoTracking()
                .Where(s => staffIds.Contains(s.StaffId))
                .Select(s => s.UserId)
                .ToListAsync(ct);
            foreach (var uid in staffUserIds)
            {
                if (uid != Guid.Empty) recipientUserIds.Add(uid);
            }
        }

        foreach (var recipientId in recipientUserIds)
        {
            db.Notifications.Add(new Notification
            {
                NotificationId = Guid.NewGuid(),
                RecipientId = recipientId,
                SenderService = "payroll",
                Type = "procedure_rejected",
                Title = $"Phiếu thủ thuật {slip.SlipNumber} bị từ chối ({stageName})",
                Body = $"Phiếu thủ thuật {slip.SlipNumber} (ngày {slip.ProcedureDate:dd/MM/yyyy}) đã bị từ chối. Lý do: {reason}",
                ActionUrl = $"/procedures/{slip.SlipId}",
                EntityType = "ProcedureSlip",
                EntityId = slip.SlipId,
                Channel = "in_app",
                IsRead = false,
                CreatedAt = DateTime.UtcNow
            });
        }
    }

    public async Task<CalculateMonthlyCommissionResultDto> CalculateMonthlyCommissionAsync(
        Guid currentUserId, CalculateMonthlyCommissionRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.PayMonth) || !MonthRegex.IsMatch(request.PayMonth.Trim()))
        {
            throw new AppException(400, "Định dạng tháng tính hoa hồng không hợp lệ (định dạng đúng: YYYY-MM).");
        }

        var payMonth = request.PayMonth.Trim();
        var monthStart = DateOnly.ParseExact(payMonth + "-01", "yyyy-MM-dd");
        var monthEnd = monthStart.AddMonths(1).AddDays(-1);

        var isLocked = await db.PayrollLocks.AsNoTracking()
            .AnyAsync(l => l.PayMonth == payMonth && (l.Status == "locked" || l.Status == "finalized" || l.Status == "exported"), ct);
        if (isLocked)
        {
            throw new AppException(409, $"Kỳ tính lương tháng {payMonth} đã khóa, không thể chạy lại tổng hợp hoa hồng.");
        }

        await using var tx = await unitOfWork.BeginTransactionAsync(ct, IsolationLevel.Serializable);

        var slipsQuery = db.ProcedureSlips.AsNoTracking()
            .Where(s => s.ProcedureDate >= monthStart && s.ProcedureDate <= monthEnd &&
                        (s.Status == "verified" || s.Status == "approved"));

        if (request.DepartmentId.HasValue)
        {
            slipsQuery = slipsQuery.Where(s => s.DepartmentId == request.DepartmentId.Value);
        }

        var verifiedSlips = await slipsQuery.ToListAsync(ct);
        var verifiedSlipIds = verifiedSlips.Select(s => s.SlipId).ToList();

        var assignments = verifiedSlipIds.Count == 0
            ? []
            : await db.ProcedureAssignments
                .Where(a => verifiedSlipIds.Contains(a.SlipId))
                .ToListAsync(ct);

        var staffIds = assignments.Select(a => a.StaffId).Distinct().ToList();
        var staffInfoMap = await (
            from s in db.Staff.AsNoTracking()
            where staffIds.Contains(s.StaffId)
            join d in db.Departments.AsNoTracking() on s.DepartmentId equals d.DepartmentId into deptJoin
            from d in deptJoin.DefaultIfEmpty()
            select new
            {
                s.StaffId,
                s.StaffCode,
                s.FullName,
                s.DepartmentId,
                DepartmentName = d != null ? d.Name : null
            }
        ).ToDictionaryAsync(x => x.StaffId, ct);

        var payslipsInMonth = await db.Payslips
            .Where(p => p.PayMonth == payMonth && staffIds.Contains(p.StaffId) && p.IsLocked != true)
            .ToDictionaryAsync(p => p.StaffId, ct);

        int updatedPayslipCount = 0;
        var staffSummaries = new List<StaffMonthlyCommissionItemDto>();

        foreach (var group in assignments.GroupBy(a => a.StaffId))
        {
            var staffId = group.Key;
            var totalComm = group.Sum(a => a.CommissionAmount ?? 0m);
            var distinctSlips = group.Select(a => a.SlipId).Distinct().Count();
            var assignCount = group.Count();

            Guid? linkedPayslipId = null;
            bool linked = false;

            if (payslipsInMonth.TryGetValue(staffId, out var payslip))
            {
                payslip.CommissionTotal = totalComm;
                var basePay = payslip.BasePay ?? 0m;
                var allowance = payslip.AllowanceTotal ?? 0m;
                var maternity = payslip.MaternityAllowance ?? 0m;
                payslip.GrossPay = basePay + allowance + totalComm + maternity;
                var deductions = (payslip.InsuranceDeduction ?? 0m) + (payslip.TaxDeduction ?? 0m) + (payslip.OtherDeduction ?? 0m);
                payslip.NetPay = Math.Max(0m, (payslip.GrossPay ?? 0m) - deductions);
                payslip.UpdatedAt = DateTime.UtcNow;

                linkedPayslipId = payslip.PayslipId;
                linked = true;
                updatedPayslipCount++;

                foreach (var a in group)
                {
                    a.PayslipId = payslip.PayslipId;
                    a.Status = "verified";
                }
            }

            staffInfoMap.TryGetValue(staffId, out var sInfo);
            staffSummaries.Add(new StaffMonthlyCommissionItemDto(
                staffId,
                sInfo?.StaffCode ?? "N/A",
                sInfo?.FullName ?? "Nhân sự",
                sInfo?.DepartmentId,
                sInfo?.DepartmentName,
                distinctSlips,
                assignCount,
                totalComm,
                linkedPayslipId,
                linked));
        }

        auditHelper.Log("calculate_monthly_commission", "PayrollLock", null, null, new
        {
            payMonth,
            departmentId = request.DepartmentId,
            verifiedSlipCount = verifiedSlips.Count,
            staffCount = staffSummaries.Count,
            totalCommission = staffSummaries.Sum(x => x.TotalCommissionAmount),
            updatedPayslipCount
        });

        await unitOfWork.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        return new CalculateMonthlyCommissionResultDto(
            payMonth,
            verifiedSlips.Count,
            assignments.Count,
            staffSummaries.Count,
            verifiedSlips.Sum(s => s.ChargedAmount ?? 0m),
            staffSummaries.Sum(x => x.TotalCommissionAmount),
            updatedPayslipCount,
            staffSummaries.OrderByDescending(x => x.TotalCommissionAmount).ToList());
    }
}
