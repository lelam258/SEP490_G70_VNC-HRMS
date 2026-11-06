using System.Globalization;
using Microsoft.EntityFrameworkCore;
using Vnc.HRMS.DTOs.Compliance;
using Vnc.HRMS.Models;
using Vnc.HRMS.Models.Employees;
using Vnc.HRMS.Persistence;
using Vnc.HRMS.Repositories;
using Vnc.HRMS.Repositories.Interfaces;
using Vnc.HRMS.Security;

namespace Vnc.HRMS.Services;

public sealed class ComplianceService(
    ComplianceRepository repository,
    AppDbContext db,
    IUnitOfWork unitOfWork)
{
    private const int DefaultCertExpiringThresholdDays = 90;
    private const int DefaultCmeAlertThresholdDays = 180;

    public Task<object> CertificatesAsync(int page, int pageSize, CancellationToken ct) =>
        repository.CertificatesAsync(Math.Clamp(page, 1, 100000), Math.Clamp(pageSize, 1, 100), ct);

    public Task<object> CmeCyclesAsync(int page, int pageSize, CancellationToken ct) =>
        repository.CmeCyclesAsync(Math.Clamp(page, 1, 100000), Math.Clamp(pageSize, 1, 100), ct);

    public Task<object> CmeRecordsAsync(int page, int pageSize, CancellationToken ct) =>
        repository.CmeRecordsAsync(Math.Clamp(page, 1, 100000), Math.Clamp(pageSize, 1, 100), ct);

    public Task<object> ComplianceScansAsync(int page, int pageSize, CancellationToken ct) =>
        repository.ComplianceScansAsync(Math.Clamp(page, 1, 100000), Math.Clamp(pageSize, 1, 100), ct);

    public async Task<ReportFilterOptionsDto> GetFilterOptionsAsync(
        Guid? currentUserId,
        string? currentUserRole,
        CancellationToken ct = default)
    {
        var lockedDepartmentId = await ResolveLockedDepartmentIdAsync(currentUserId, currentUserRole, ct);

        var departments = await db.Departments.AsNoTracking()
            .Where(d => d.Status == "active")
            .OrderBy(d => d.Name)
            .Select(d => new ComplianceDepartmentOptionDto(d.DepartmentId, d.Name))
            .ToArrayAsync(ct);

        var dbPositions = await db.Positions.AsNoTracking()
            .Where(p => p.Status == "active")
            .ToDictionaryAsync(p => p.PositionId, p => p.Name, ct);

        var positionSet = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "Doctor",
            "Nurse",
            "Technician"
        };
        foreach (var pName in dbPositions.Values)
        {
            if (!string.IsNullOrWhiteSpace(pName))
                positionSet.Add(NormalizePositionLabel(pName.Trim()));
        }

        var positionOptions = positionSet
            .OrderBy(p => p)
            .Select(p => new CompliancePositionOptionDto(p, FormatPositionLabelVi(p)))
            .ToArray();

        var contractTypes = GetContractTypeOptions();
        var staffStatuses = GetStaffStatusOptions();
        var availablePayMonths = await LoadAvailablePayMonthsAsync(ct);

        return new ReportFilterOptionsDto(
            Departments: departments,
            Positions: positionOptions,
            ContractTypes: contractTypes,
            StaffStatuses: staffStatuses,
            AvailablePayMonths: availablePayMonths,
            LockedDepartmentId: lockedDepartmentId
        );
    }

    public async Task<ComplianceDashboardResponseDto> GetDashboardAsync(
        Guid? currentUserId,
        string? currentUserRole,
        OperationalComplianceFilterRequestDto? filter = null,
        CancellationToken ct = default)
    {
        filter ??= new OperationalComplianceFilterRequestDto();
        var (certThresholdDays, cmeThresholdDays) = await LoadThresholdsAsync(ct);

        // Department Manager scope is fixed to their own department
        Guid? lockedDepartmentId = await ResolveLockedDepartmentIdAsync(currentUserId, currentUserRole, ct);
        Guid? departmentId = lockedDepartmentId ?? filter.DepartmentId;

        var departments = await db.Departments.AsNoTracking()
            .Where(d => d.Status == "active")
            .OrderBy(d => d.Name)
            .Select(d => new ComplianceDepartmentOptionDto(d.DepartmentId, d.Name))
            .ToArrayAsync(ct);

        var dbPositions = await db.Positions.AsNoTracking()
            .Where(p => p.Status == "active")
            .ToDictionaryAsync(p => p.PositionId, p => p.Name, ct);

        var staffStatusFilter = string.IsNullOrWhiteSpace(filter.StaffStatus)
            ? "active"
            : filter.StaffStatus.Trim().ToLowerInvariant();

        var allStaffQuery =
            from s in db.Staff.AsNoTracking()
            join d in db.Departments.AsNoTracking() on s.DepartmentId equals d.DepartmentId into depts
            from d in depts.DefaultIfEmpty()
            orderby s.StaffCode
            select new
            {
                s.StaffId,
                s.UserId,
                s.StaffCode,
                s.FullName,
                s.DepartmentId,
                DepartmentName = d != null ? d.Name : "Unassigned",
                s.PositionId,
                s.ScopeOfPractice,
                s.Status
            };

        var allStaffList = await allStaffQuery.ToArrayAsync(ct);

        var allContracts = await db.Contracts.AsNoTracking()
            .OrderByDescending(c => c.EffectiveFrom)
            .ToArrayAsync(ct);
        var contractsByStaff = allContracts.ToLookup(c => c.StaffId);

        var allCerts = await db.Certificates.AsNoTracking()
            .OrderBy(c => c.ExpiryDate)
            .ThenByDescending(c => c.IssueDate)
            .ToArrayAsync(ct);

        var allCycles = await db.CmeCycles.AsNoTracking()
            .OrderByDescending(c => c.CycleNumber)
            .ToArrayAsync(ct);

        var allRecords = await db.CmeRecords.AsNoTracking()
            .ToArrayAsync(ct);

        var certsByStaff = allCerts.ToLookup(c => c.StaffId);
        var cyclesByCert = allCycles.ToLookup(c => c.CertificateId);
        var recordsByCert = allRecords.ToLookup(r => r.CertificateId);

        // Resolve position and contract type for every staff member
        var staffPositionMap = new Dictionary<Guid, string>();
        var staffContractTypeMap = new Dictionary<Guid, string?>();
        var positionSet = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "Doctor",
            "Nurse",
            "Technician"
        };

        foreach (var pName in dbPositions.Values)
        {
            if (!string.IsNullOrWhiteSpace(pName))
                positionSet.Add(NormalizePositionLabel(pName.Trim()));
        }

        foreach (var s in allStaffList)
        {
            var resolvedPos = ResolveStaffPosition(
                s.PositionId,
                s.ScopeOfPractice,
                dbPositions,
                certsByStaff[s.StaffId]);
            staffPositionMap[s.StaffId] = resolvedPos;
            if (!string.IsNullOrWhiteSpace(resolvedPos))
                positionSet.Add(resolvedPos);

            var latestContract = contractsByStaff[s.StaffId]
                .FirstOrDefault(c => string.Equals(c.Status, "active", StringComparison.OrdinalIgnoreCase))
                ?? contractsByStaff[s.StaffId].FirstOrDefault();
            staffContractTypeMap[s.StaffId] = latestContract?.ContractType;
        }

        var positionOptions = positionSet
            .OrderBy(p => p)
            .Select(p => new CompliancePositionOptionDto(p, FormatPositionLabelVi(p)))
            .ToArray();

        var keyword = filter.Keyword?.Trim();
        var positionFilter = filter.Position?.Trim();
        var contractTypeFilter = filter.ContractType?.Trim();

        // Filter staff by Department, Position, StaffStatus, ContractType, and Keyword
        var filteredStaff = allStaffList.Where(s =>
        {
            if (departmentId.HasValue && s.DepartmentId != departmentId.Value)
                return false;

            if (!string.Equals(staffStatusFilter, "all", StringComparison.OrdinalIgnoreCase))
            {
                if (!string.Equals(s.Status, staffStatusFilter, StringComparison.OrdinalIgnoreCase))
                    return false;
            }

            if (!string.IsNullOrWhiteSpace(positionFilter) &&
                !string.Equals(positionFilter, "all", StringComparison.OrdinalIgnoreCase))
            {
                var staffPos = staffPositionMap.GetValueOrDefault(s.StaffId, "");
                if (!string.Equals(staffPos, positionFilter, StringComparison.OrdinalIgnoreCase))
                    return false;
            }

            if (!string.IsNullOrWhiteSpace(contractTypeFilter) &&
                !string.Equals(contractTypeFilter, "all", StringComparison.OrdinalIgnoreCase))
            {
                var cType = staffContractTypeMap.GetValueOrDefault(s.StaffId);
                if (!string.Equals(cType, contractTypeFilter, StringComparison.OrdinalIgnoreCase))
                    return false;
            }

            if (!string.IsNullOrWhiteSpace(keyword))
            {
                bool matchesStaff =
                    s.StaffCode.Contains(keyword, StringComparison.OrdinalIgnoreCase) ||
                    s.FullName.Contains(keyword, StringComparison.OrdinalIgnoreCase) ||
                    s.DepartmentName.Contains(keyword, StringComparison.OrdinalIgnoreCase);

                bool matchesCert = certsByStaff[s.StaffId].Any(c =>
                    (!string.IsNullOrWhiteSpace(c.CertificateNumber) &&
                     c.CertificateNumber.Contains(keyword, StringComparison.OrdinalIgnoreCase)) ||
                    (!string.IsNullOrWhiteSpace(c.CertificateType) &&
                     c.CertificateType.Contains(keyword, StringComparison.OrdinalIgnoreCase)));

                if (!matchesStaff && !matchesCert)
                    return false;
            }

            return true;
        }).ToArray();

        var today = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7));
        int effectiveCertThreshold = filter.MaxDaysLeft is > 0 ? filter.MaxDaysLeft.Value : certThresholdDays;
        int effectiveCmeThreshold = filter.MaxDaysLeft is > 0 ? filter.MaxDaysLeft.Value : cmeThresholdDays;

        var allCertificateRows = new List<ComplianceAttentionRowDto>();
        var allCmeRows = new List<ComplianceAttentionRowDto>();
        var staffSummaryForChart = new List<(Guid? DepartmentId, string DepartmentName, string CertWorstStatus, bool IsCmeAtRisk)>();

        int validCount = 0;
        int expiringCount = 0;
        int expiredCount = 0;
        int legacyCount = 0;
        int cmeAtRiskCount = 0;

        foreach (var s in filteredStaff)
        {
            var staffCerts = certsByStaff[s.StaffId]
                .Where(c => CertificateCategoryHelper.Parse(c.CertificateType).Category == "certificate")
                .Where(c => !string.Equals(c.Status, "revoked", StringComparison.OrdinalIgnoreCase) &&
                            !string.Equals(c.Status, "suspended", StringComparison.OrdinalIgnoreCase))
                .ToArray();

            var (certRows, cmeRows, staffWorstCertStatus, staffIsCmeAtRisk) = EvaluateAllStaffCertificatesAndCme(
                s.StaffId,
                s.StaffCode,
                s.FullName,
                s.DepartmentId,
                s.DepartmentName,
                staffPositionMap[s.StaffId],
                s.Status,
                staffContractTypeMap.GetValueOrDefault(s.StaffId),
                staffCerts,
                cyclesByCert,
                recordsByCert,
                today,
                effectiveCertThreshold,
                effectiveCmeThreshold);

            allCertificateRows.AddRange(certRows);
            allCmeRows.AddRange(cmeRows);
            staffSummaryForChart.Add((s.DepartmentId, s.DepartmentName, staffWorstCertStatus, staffIsCmeAtRisk));

            switch (staffWorstCertStatus)
            {
                case "Expired":
                    expiredCount++;
                    break;
                case "Expiring":
                    expiringCount++;
                    break;
                case "Legacy":
                    legacyCount++;
                    break;
                default:
                    validCount++;
                    break;
            }

            if (staffIsCmeAtRisk)
            {
                cmeAtRiskCount++;
            }
        }

        // Apply row-level filters (FromDate, ToDate, MaxDaysLeft, ComplianceStatus, ItemType, Keyword on item)
        var filteredCertRows = FilterRows(
            allCertificateRows,
            filter,
            isCmeSection: false);

        var filteredCmeRows = FilterRows(
            allCmeRows,
            filter,
            isCmeSection: true);

        // Sort Certificate and CME rows
        var sortedCertRows = SortRows(filteredCertRows, filter.SortBy, filter.SortDir, isCme: false);
        var sortedCmeRows = SortRows(filteredCmeRows, filter.SortBy, filter.SortDir, isCme: true);

        // Build department breakdown chart data (per staff member count)
        var chartItems = staffSummaryForChart
            .GroupBy(r => new { r.DepartmentId, r.DepartmentName })
            .OrderBy(g => g.Key.DepartmentName)
            .Select(g => new ComplianceChartItemDto(
                g.Key.DepartmentName,
                g.Count(x => x.CertWorstStatus == "Valid"),
                g.Count(x => x.CertWorstStatus == "Expiring"),
                g.Count(x => x.CertWorstStatus == "Expired"),
                g.Count(x => x.CertWorstStatus == "Legacy"),
                g.Count(x => x.IsCmeAtRisk)
            ))
            .ToArray();

        var kpis = new ComplianceKpiSummaryDto(
            TotalStaff: filteredStaff.Length,
            ValidCount: validCount,
            ExpiringCount: expiringCount,
            ExpiredCount: expiredCount,
            LegacyCount: legacyCount,
            CmeAtRiskCount: cmeAtRiskCount,
            CertExpiringThresholdDays: effectiveCertThreshold,
            CmeAlertThresholdDays: effectiveCmeThreshold
        );

        var filteredStaffIds = filteredStaff.Select(s => s.StaffId).ToHashSet();
        var operationalKpis = await CalculateOperationalKpisAsync(
            filteredStaffIds,
            filteredStaff.Count(s => string.Equals(s.Status, "active", StringComparison.OrdinalIgnoreCase)),
            allContracts,
            today,
            filter.FromDate,
            filter.ToDate,
            filter.PayMonth,
            ct);

        var availablePayMonths = await LoadAvailablePayMonthsAsync(ct);

        return new ComplianceDashboardResponseDto(
            Kpis: kpis,
            OperationalKpis: operationalKpis,
            StaffItems: sortedCertRows,
            CmeItems: sortedCmeRows,
            DepartmentChart: chartItems,
            Departments: departments,
            Positions: positionOptions,
            ContractTypes: GetContractTypeOptions(),
            StaffStatuses: GetStaffStatusOptions(),
            AvailablePayMonths: availablePayMonths,
            LockedDepartmentId: lockedDepartmentId
        );
    }

    public async Task<SendComplianceReminderResponseDto> SendRemindersAsync(
        SendComplianceReminderRequest request,
        Guid? currentUserId,
        string? currentUserRole,
        CancellationToken ct = default)
    {
        var dashboard = await GetDashboardAsync(
            currentUserId,
            currentUserRole,
            new OperationalComplianceFilterRequestDto
            {
                DepartmentId = request.DepartmentId,
                Position = request.Position,
                ComplianceStatus = request.StatusFilter
            },
            ct);

        List<ComplianceAttentionRowDto> targetItems;
        var filter = request.StatusFilter?.Trim() ?? "attention";

        if (string.Equals(filter, "cme_at_risk", StringComparison.OrdinalIgnoreCase))
        {
            targetItems = dashboard.CmeItems.Where(item => item.IsCmeAtRisk).ToList();
        }
        else if (!string.IsNullOrWhiteSpace(filter) &&
                 !string.Equals(filter, "all", StringComparison.OrdinalIgnoreCase) &&
                 !string.Equals(filter, "attention", StringComparison.OrdinalIgnoreCase))
        {
            targetItems = dashboard.StaffItems
                .Where(item =>
                    string.Equals(item.Status, filter, StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(item.CertWorstStatus, filter, StringComparison.OrdinalIgnoreCase))
                .ToList();
        }
        else
        {
            targetItems = dashboard.StaffItems.Where(item => item.RequiresAttention)
                .Concat(dashboard.CmeItems.Where(item => item.RequiresAttention))
                .ToList();
        }

        if (request.StaffIds is { Length: > 0 })
        {
            var idSet = request.StaffIds.ToHashSet();
            targetItems = targetItems.Where(x => idSet.Contains(x.StaffId)).ToList();
        }

        if (targetItems.Count == 0)
        {
            return new SendComplianceReminderResponseDto(
                0,
                DateTime.UtcNow,
                "Không có chứng chỉ hoặc chu kỳ CME nào cần nhắc nhở trong bộ lọc đã chọn.");
        }

        var targetStaffIds = targetItems.Select(x => x.StaffId).Distinct().ToArray();
        var staffUsers = await db.Staff.AsNoTracking()
            .Where(s => targetStaffIds.Contains(s.StaffId))
            .Select(s => new { s.StaffId, s.UserId })
            .ToDictionaryAsync(x => x.StaffId, x => x.UserId, ct);

        var now = DateTime.UtcNow;
        int sentCount = 0;

        foreach (var item in targetItems)
        {
            var statusVi = FormatStatusLabelVi(item.Status);
            if (staffUsers.TryGetValue(item.StaffId, out var recipientUserId))
            {
                var notification = new Notification
                {
                    NotificationId = Guid.NewGuid(),
                    RecipientId = recipientUserId,
                    SenderService = "compliance",
                    Type = "compliance_reminder",
                    Title = $"Nhắc nhở tuân thủ: {item.Item} ({statusVi})",
                    Body = $"Xin chào {item.StaffName}, mục '{item.Item}' của bạn đang ở trạng thái '{statusVi}'" +
                           (item.DeadlineDisplay != "-" ? $" (Thời hạn: {item.DeadlineDisplay})" : "") +
                           ". Vui lòng kiểm tra và cập nhật hồ sơ chứng chỉ / CME.",
                    ActionUrl = item.ActionUrl,
                    EntityType = item.ItemType,
                    EntityId = item.CertificateId ?? item.StaffId,
                    Channel = "in_app",
                    IsRead = false,
                    CreatedAt = now
                };
                db.Notifications.Add(notification);
            }

            var scan = new ComplianceScan
            {
                ScanId = Guid.NewGuid(),
                StaffId = item.StaffId,
                DepartmentId = item.DepartmentId,
                CertificateId = item.CertificateId,
                ScanDate = now,
                ExpiryDate = item.Deadline,
                DaysRemaining = item.DaysLeft,
                CmeCreditsEarned = item.CmeEarned,
                CmeCreditsNeeded = item.CmeRequired.HasValue && item.CmeEarned.HasValue
                    ? Math.Max(0m, item.CmeRequired.Value - item.CmeEarned.Value)
                    : null,
                ComplianceStatus = item.Status,
                AlertSent = true,
                AlertSentAt = now
            };
            db.ComplianceScans.Add(scan);
            sentCount++;
        }

        await unitOfWork.SaveChangesAsync(ct);

        return new SendComplianceReminderResponseDto(
            sentCount,
            now,
            $"Đã gửi {sentCount} thông báo nhắc nhở cho {targetStaffIds.Length} nhân viên.");
    }

    private async Task<Guid?> ResolveLockedDepartmentIdAsync(
        Guid? currentUserId,
        string? currentUserRole,
        CancellationToken ct)
    {
        if (!string.Equals(currentUserRole, AccountRoles.DepartmentManager, StringComparison.OrdinalIgnoreCase) ||
            !currentUserId.HasValue)
        {
            return null;
        }

        var managerStaff = await db.Staff.AsNoTracking()
            .FirstOrDefaultAsync(s => s.UserId == currentUserId.Value, ct);

        if (managerStaff == null)
            return null;

        var managedDept = await db.Departments.AsNoTracking()
            .FirstOrDefaultAsync(d => d.ManagerId == managerStaff.StaffId && d.Status == "active", ct);

        return managedDept?.DepartmentId ?? managerStaff.DepartmentId;
    }

    private static List<ComplianceAttentionRowDto> FilterRows(
        List<ComplianceAttentionRowDto> sourceRows,
        OperationalComplianceFilterRequestDto filter,
        bool isCmeSection)
    {
        return sourceRows.Where(row =>
        {
            // ItemType filter ('all' | 'certificate' | 'cme_cycle')
            if (!string.IsNullOrWhiteSpace(filter.ItemType) &&
                !string.Equals(filter.ItemType.Trim(), "all", StringComparison.OrdinalIgnoreCase))
            {
                if (!string.Equals(row.ItemType, filter.ItemType.Trim(), StringComparison.OrdinalIgnoreCase))
                    return false;
            }

            // Date range filter on Deadline
            if (filter.FromDate.HasValue)
            {
                if (!row.Deadline.HasValue || row.Deadline.Value < filter.FromDate.Value)
                    return false;
            }

            if (filter.ToDate.HasValue)
            {
                if (!row.Deadline.HasValue || row.Deadline.Value > filter.ToDate.Value)
                    return false;
            }

            // MaxDaysLeft filter
            if (filter.MaxDaysLeft is > 0)
            {
                if (!row.DaysLeft.HasValue || row.DaysLeft.Value > filter.MaxDaysLeft.Value)
                    return false;
            }

            // ComplianceStatus server-side filter (when specified other than 'all' / 'total' / 'attention')
            if (!string.IsNullOrWhiteSpace(filter.ComplianceStatus))
            {
                var statusTarget = filter.ComplianceStatus.Trim().ToLowerInvariant();
                switch (statusTarget)
                {
                    case "valid":
                        if (isCmeSection)
                        {
                            if (row.IsCmeAtRisk) return false;
                        }
                        else
                        {
                            if (!string.Equals(row.Status, "Valid", StringComparison.OrdinalIgnoreCase))
                                return false;
                        }
                        break;
                    case "expiring":
                        if (!isCmeSection && !string.Equals(row.Status, "Expiring", StringComparison.OrdinalIgnoreCase))
                            return false;
                        break;
                    case "expired":
                        if (!isCmeSection && !string.Equals(row.Status, "Expired", StringComparison.OrdinalIgnoreCase))
                            return false;
                        break;
                    case "legacy":
                        if (!isCmeSection && !string.Equals(row.Status, "Legacy", StringComparison.OrdinalIgnoreCase))
                            return false;
                        break;
                    case "cme_at_risk":
                        if (!row.IsCmeAtRisk)
                            return false;
                        break;
                }
            }

            return true;
        }).ToList();
    }

    private static ComplianceAttentionRowDto[] SortRows(
        List<ComplianceAttentionRowDto> rows,
        string? sortBy,
        string? sortDir,
        bool isCme)
    {
        bool desc = string.Equals(sortDir?.Trim(), "desc", StringComparison.OrdinalIgnoreCase);
        var key = sortBy?.Trim().ToLowerInvariant() ?? "daysleft";

        IOrderedEnumerable<ComplianceAttentionRowDto> ordered = key switch
        {
            "staffname" => desc
                ? rows.OrderByDescending(r => r.StaffName)
                : rows.OrderBy(r => r.StaffName),
            "department" => desc
                ? rows.OrderByDescending(r => r.DepartmentName).ThenBy(r => r.StaffName)
                : rows.OrderBy(r => r.DepartmentName).ThenBy(r => r.StaffName),
            "deadline" or "expirydate" => desc
                ? rows.OrderBy(r => r.Deadline.HasValue ? 0 : 1)
                    .ThenByDescending(r => r.Deadline ?? DateOnly.MinValue)
                    .ThenBy(r => r.StaffName)
                : rows.OrderBy(r => r.Deadline.HasValue ? 0 : 1)
                    .ThenBy(r => r.Deadline ?? DateOnly.MaxValue)
                    .ThenBy(r => r.StaffName),
            _ => desc
                ? rows.OrderBy(r => r.RequiresAttention ? 0 : 1)
                    .ThenBy(r => r.DaysLeft.HasValue ? 0 : 1)
                    .ThenByDescending(r => r.DaysLeft ?? int.MinValue)
                    .ThenBy(r => r.StaffName)
                : rows.OrderBy(r => r.RequiresAttention ? 0 : 1)
                    .ThenBy(r => r.Deadline.HasValue ? 0 : 1)
                    .ThenBy(r => r.Deadline ?? DateOnly.MaxValue)
                    .ThenBy(r => r.DaysLeft ?? int.MaxValue)
                    .ThenBy(r => isCme ? 0 : GetStatusSeverityOrder(r.Status))
                    .ThenBy(r => r.StaffName)
        };

        return ordered.ToArray();
    }

    private async Task<OperationalKpiSummaryDto> CalculateOperationalKpisAsync(
        HashSet<Guid> filteredStaffIds,
        int totalActiveStaff,
        Contract[] allContracts,
        DateOnly today,
        DateOnly? fromDate,
        DateOnly? toDate,
        string? payMonth,
        CancellationToken ct)
    {
        if (filteredStaffIds.Count == 0)
        {
            return new OperationalKpiSummaryDto(0, 0, 0, 0, 0m);
        }

        // 1. Contracts expiring within 60 days or already expired among active contracts
        int expiringContractsCount = allContracts.Count(c =>
            filteredStaffIds.Contains(c.StaffId) &&
            string.Equals(c.Status, "active", StringComparison.OrdinalIgnoreCase) &&
            c.EffectiveTo.HasValue &&
            (c.EffectiveTo.Value.DayNumber - today.DayNumber) <= 60);

        // Determine effective date range from PayMonth or FromDate/ToDate
        DateOnly? rangeStart = fromDate;
        DateOnly? rangeEnd = toDate;
        if (!string.IsNullOrWhiteSpace(payMonth) &&
            !string.Equals(payMonth.Trim(), "all", StringComparison.OrdinalIgnoreCase) &&
            DateOnly.TryParseExact($"{payMonth.Trim()}-01", "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var monthFirstDay))
        {
            rangeStart ??= monthFirstDay;
            rangeEnd ??= monthFirstDay.AddMonths(1).AddDays(-1);
        }

        // 2. Leave Requests (Pending or in range)
        var leaveQuery = db.LeaveRequests.AsNoTracking()
            .Where(l => filteredStaffIds.Contains(l.StaffId));
        if (rangeStart.HasValue)
            leaveQuery = leaveQuery.Where(l => l.EndDate >= rangeStart.Value);
        if (rangeEnd.HasValue)
            leaveQuery = leaveQuery.Where(l => l.StartDate <= rangeEnd.Value);

        var leaveList = await leaveQuery
            .Select(l => new { l.Status })
            .ToArrayAsync(ct);

        int pendingLeaveCount = leaveList.Count(l =>
            string.Equals(l.Status, "pending", StringComparison.OrdinalIgnoreCase) ||
            string.IsNullOrWhiteSpace(l.Status));
        if (pendingLeaveCount == 0 && leaveList.Length > 0)
            pendingLeaveCount = leaveList.Length;

        // 3. On-Call Shifts in period
        var onCallQuery = db.OnCallShifts.AsNoTracking()
            .Where(o => filteredStaffIds.Contains(o.StaffId));
        if (rangeStart.HasValue)
            onCallQuery = onCallQuery.Where(o => o.ShiftDate >= rangeStart.Value);
        if (rangeEnd.HasValue)
            onCallQuery = onCallQuery.Where(o => o.ShiftDate <= rangeEnd.Value);

        int onCallShiftsCount = await onCallQuery.CountAsync(ct);

        // 4. WorkDays in period (from Payslips if PayMonth matches, else from AttendanceRecords)
        decimal totalWorkDays = 0m;
        if (!string.IsNullOrWhiteSpace(payMonth) &&
            !string.Equals(payMonth.Trim(), "all", StringComparison.OrdinalIgnoreCase))
        {
            var pm = payMonth.Trim();
            var payslipDays = await db.Payslips.AsNoTracking()
                .Where(p => filteredStaffIds.Contains(p.StaffId) && p.PayMonth == pm)
                .Select(p => p.WorkDays ?? 0m)
                .ToArrayAsync(ct);
            totalWorkDays = payslipDays.Sum();
        }

        if (totalWorkDays == 0m)
        {
            var attQuery = db.AttendanceRecords.AsNoTracking()
                .Where(a => filteredStaffIds.Contains(a.StaffId));
            if (rangeStart.HasValue)
                attQuery = attQuery.Where(a => a.WorkDate >= rangeStart.Value);
            if (rangeEnd.HasValue)
                attQuery = attQuery.Where(a => a.WorkDate <= rangeEnd.Value);

            totalWorkDays = await attQuery.CountAsync(ct);
        }

        return new OperationalKpiSummaryDto(
            TotalActiveStaff: totalActiveStaff,
            ExpiringContractsCount: expiringContractsCount,
            PendingLeaveRequestsCount: pendingLeaveCount,
            OnCallShiftsCount: onCallShiftsCount,
            TotalWorkDaysInPeriod: totalWorkDays
        );
    }

    private static ComplianceSelectOptionDto[] GetContractTypeOptions() =>
    [
        new("probation", "Hợp đồng thử việc"),
        new("fixed_term", "Hợp đồng xác định thời hạn"),
        new("indefinite", "Hợp đồng không xác định thời hạn"),
        new("part_time", "Hợp đồng bán thời gian / CTV")
    ];

    private static ComplianceSelectOptionDto[] GetStaffStatusOptions() =>
    [
        new("active", "Đang làm việc"),
        new("maternity_leave", "Nghỉ thai sản"),
        new("inactive", "Tạm ngưng / Nghỉ việc")
    ];

    private async Task<string[]> LoadAvailablePayMonthsAsync(CancellationToken ct)
    {
        var payslipMonths = await db.Payslips.AsNoTracking()
            .Where(p => !string.IsNullOrEmpty(p.PayMonth))
            .Select(p => p.PayMonth)
            .Distinct()
            .ToArrayAsync(ct);

        var timesheetMonths = await db.MonthlyTimesheets.AsNoTracking()
            .Where(t => !string.IsNullOrEmpty(t.PayMonth))
            .Select(t => t.PayMonth)
            .Distinct()
            .ToArrayAsync(ct);

        var currentMonth = DateTime.UtcNow.AddHours(7).ToString("yyyy-MM", CultureInfo.InvariantCulture);
        var prevMonth = DateTime.UtcNow.AddHours(7).AddMonths(-1).ToString("yyyy-MM", CultureInfo.InvariantCulture);

        return payslipMonths
            .Concat(timesheetMonths)
            .Concat(new[] { currentMonth, prevMonth })
            .Where(m => !string.IsNullOrWhiteSpace(m))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderByDescending(m => m)
            .ToArray();
    }

    private async Task<(int CertThresholdDays, int CmeThresholdDays)> LoadThresholdsAsync(CancellationToken ct)
    {
        int certDays = DefaultCertExpiringThresholdDays;
        int cmeDays = DefaultCmeAlertThresholdDays;

        try
        {
            var policies = await db.Set<SystemPolicy>().AsNoTracking()
                .Where(p => p.PolicyKey.Contains("threshold") || p.PolicyKey.Contains("cme") || p.PolicyKey.Contains("cert"))
                .ToArrayAsync(ct);

            foreach (var p in policies)
            {
                var key = p.PolicyKey.ToLowerInvariant();
                if ((key.Contains("cert") || key.Contains("expir")) &&
                    int.TryParse(p.PolicyValue, out var parsedCert) && parsedCert > 0)
                {
                    certDays = parsedCert;
                }
                else if (key.Contains("cme") &&
                         int.TryParse(p.PolicyValue, out var parsedCme) && parsedCme > 0)
                {
                    cmeDays = parsedCme;
                }
            }
        }
        catch
        {
            // Fallback to defaults if system_policies table has no matching entries
        }

        return (certDays, cmeDays);
    }

    private static string ResolveStaffPosition(
        Guid? positionId,
        string? staffScope,
        IReadOnlyDictionary<Guid, string> dbPositions,
        IEnumerable<Certificate> staffCertsAndDegrees)
    {
        if (positionId.HasValue &&
            dbPositions.TryGetValue(positionId.Value, out var posName) &&
            !string.IsNullOrWhiteSpace(posName))
        {
            return NormalizePositionLabel(posName.Trim());
        }

        var combinedText = string.Join(" ",
            new[] { staffScope ?? "" }
                .Concat(staffCertsAndDegrees.Select(c => $"{c.CertificateType} {c.ScopeOfPractice}")))
            .ToLowerInvariant();

        if (combinedText.Contains("bác sĩ") || combinedText.Contains("y khoa") || combinedText.Contains("doctor") || combinedText.Contains("đa khoa") || combinedText.Contains("chuyên khoa"))
            return "Doctor";
        if (combinedText.Contains("điều dưỡng") || combinedText.Contains("hộ sinh") || combinedText.Contains("y tá") || combinedText.Contains("nurse"))
            return "Nurse";
        if (combinedText.Contains("kỹ thuật") || combinedText.Contains("xét nghiệm") || combinedText.Contains("technician") || combinedText.Contains("hình ảnh"))
            return "Technician";

        return "Doctor";
    }

    private static string NormalizePositionLabel(string raw)
    {
        var lower = raw.ToLowerInvariant();
        if (lower.Contains("bác sĩ") || lower == "doctor" || lower == "bs")
            return "Doctor";
        if (lower.Contains("điều dưỡng") || lower == "nurse" || lower == "y tá")
            return "Nurse";
        if (lower.Contains("kỹ thuật") || lower == "technician" || lower == "ktv")
            return "Technician";
        return raw;
    }

    private sealed record CertCmeEvaluation(
        Certificate Certificate,
        string CleanName,
        Guid? CycleId,
        DateOnly? CycleEnd,
        int? CycleDaysLeft,
        string CycleStatus,
        decimal EarnedCredits,
        decimal RequiredCredits,
        bool HasCmeCreditsRequirement,
        bool IsCmeAtRisk
    );

    private static (
        List<ComplianceAttentionRowDto> CertRows,
        List<ComplianceAttentionRowDto> CmeRows,
        string CertWorstStatus,
        bool IsStaffCmeAtRisk
    ) EvaluateAllStaffCertificatesAndCme(
        Guid staffId,
        string staffCode,
        string staffName,
        Guid? departmentId,
        string departmentName,
        string position,
        string staffStatus,
        string? contractType,
        Certificate[] certs,
        ILookup<Guid, CmeCycle> cyclesByCert,
        ILookup<Guid, CmeRecord> recordsByCert,
        DateOnly today,
        int certThresholdDays,
        int cmeThresholdDays)
    {
        var certRows = new List<ComplianceAttentionRowDto>();
        var cmeRows = new List<ComplianceAttentionRowDto>();

        if (certs.Length == 0)
        {
            certRows.Add(new ComplianceAttentionRowDto(
                StaffId: staffId,
                StaffCode: staffCode,
                StaffName: staffName,
                DepartmentId: departmentId,
                DepartmentName: departmentName,
                Position: position,
                CertificateId: null,
                CmeCycleId: null,
                Item: "Chưa có chứng chỉ",
                ItemType: "certificate",
                Deadline: null,
                DeadlineDisplay: "-",
                DaysLeft: null,
                CmeEarned: null,
                CmeRequired: null,
                CmeDisplay: "-",
                Status: "Valid",
                CertWorstStatus: "Valid",
                IsCmeAtRisk: false,
                RequiresAttention: false,
                ActionUrl: $"/certificates?staffId={staffId}",
                CmeItem: null,
                CmeDeadline: null,
                CmeDeadlineDisplay: null,
                CmeDaysLeft: null,
                HasCmeCreditsRequirement: false,
                StaffStatus: staffStatus,
                ContractType: contractType,
                CertificateNumber: null
            ));
            return (certRows, cmeRows, "Valid", false);
        }

        // 1. Evaluate each certificate's CME cycle
        var certEvaluations = new List<CertCmeEvaluation>(certs.Length);
        foreach (var cert in certs)
        {
            var (_, _, cleanName) = CertificateCategoryHelper.Parse(cert.CertificateType);
            var displayCertName = string.IsNullOrWhiteSpace(cleanName) ? cert.CertificateType : cleanName;

            var certCycles = cyclesByCert[cert.CertificateId]
                .OrderByDescending(cy => cy.CycleNumber)
                .ToArray();
            var certRecords = recordsByCert[cert.CertificateId].ToArray();

            var hasCmeCreditsReq = cert.CmeRequiredCredits is > 0;
            Guid? activeCycleId = null;
            DateOnly? cycleEnd = null;
            string cycleStatus = "active";
            decimal required = hasCmeCreditsReq ? cert.CmeRequiredCredits!.Value : 1m;
            decimal earned;

            if (certCycles.Length > 0)
            {
                var currentCycle = certCycles[0];
                var oldestCycleId = certCycles[^1].CycleId;
                activeCycleId = currentCycle.CycleId;
                cycleEnd = currentCycle.CycleEnd;
                cycleStatus = currentCycle.Status ?? "active";
                if (hasCmeCreditsReq && currentCycle.RequiredCredits > 0)
                    required = currentCycle.RequiredCredits;

                var cycleRecs = certRecords
                    .Where(r => r.CmeCycleId == currentCycle.CycleId ||
                                (r.CmeCycleId == null && currentCycle.CycleId == oldestCycleId))
                    .ToArray();

                earned = hasCmeCreditsReq
                    ? cycleRecs.Sum(r => r.Credits)
                    : (cycleRecs.Length > 0 ? 1m : 0m);
            }
            else
            {
                earned = hasCmeCreditsReq
                    ? certRecords.Sum(r => r.Credits)
                    : (certRecords.Length > 0 ? 1m : 0m);
            }

            var remaining = Math.Max(0m, required - earned);
            int? cycleDaysLeft = cycleEnd.HasValue ? (cycleEnd.Value.DayNumber - today.DayNumber) : null;

            // Rule: Staff with remaining credit hours and days left in the cycle <= 180 (configurable).
            // Cycles without an end date are not counted.
            var isCmeAtRisk = !string.Equals(cycleStatus, "completed", StringComparison.OrdinalIgnoreCase) &&
                              cycleEnd.HasValue &&
                              cycleDaysLeft.HasValue &&
                              remaining > 0m &&
                              cycleDaysLeft.Value <= cmeThresholdDays;

            certEvaluations.Add(new CertCmeEvaluation(
                cert,
                displayCertName,
                activeCycleId,
                cycleEnd,
                cycleDaysLeft,
                cycleStatus,
                earned,
                required,
                hasCmeCreditsReq,
                isCmeAtRisk
            ));
        }

        // Active non-expired certificates with an expiry date
        var activeDatedCerts = certEvaluations
            .Where(e => !IsCertificateExpired(e.Certificate, today) && e.Certificate.ExpiryDate.HasValue)
            .ToList();

        bool hasAnyActiveDatedCert = activeDatedCerts.Count > 0;
        bool isStaffCmeAtRisk = certEvaluations.Any(e => e.IsCmeAtRisk);

        // Determine each certificate's individual status based on its expiry date
        var individualCertStatuses = new List<(CertCmeEvaluation Eval, string CertStatus, bool Replaced)>(certEvaluations.Count);
        foreach (var eval in certEvaluations)
        {
            if (IsCertificateExpired(eval.Certificate, today))
            {
                bool replaced = IsExpiredCertReplaced(eval, activeDatedCerts);
                individualCertStatuses.Add((eval, replaced ? "Replaced" : "Expired", replaced));
            }
            else if (eval.Certificate.ExpiryDate.HasValue)
            {
                int daysLeft = eval.Certificate.ExpiryDate.Value.DayNumber - today.DayNumber;
                string st = daysLeft <= certThresholdDays ? "Expiring" : "Valid";
                individualCertStatuses.Add((eval, st, false));
            }
            else
            {
                individualCertStatuses.Add((eval, "Legacy", false));
            }
        }

        // Determine staff member's worst certificate status (for the top KPI cards: 1 count per staff)
        string staffWorstCertStatus;
        if (individualCertStatuses.Any(x => x.CertStatus == "Expired"))
        {
            staffWorstCertStatus = "Expired";
        }
        else if (individualCertStatuses.Any(x => x.CertStatus == "Expiring"))
        {
            staffWorstCertStatus = "Expiring";
        }
        else if (!hasAnyActiveDatedCert && individualCertStatuses.Any(x => x.CertStatus == "Legacy"))
        {
            staffWorstCertStatus = "Legacy";
        }
        else
        {
            staffWorstCertStatus = "Valid";
        }

        // Build rows for Section 1 (Certificates by Expiry Date) and Section 2 (CME Cycles)
        foreach (var (eval, certStatus, replaced) in individualCertStatuses)
        {
            if (replaced)
                continue;

            var cmeProgressDisplay = FormatCmeProgress(
                eval.EarnedCredits,
                eval.RequiredCredits,
                eval.HasCmeCreditsRequirement);

            // 1. Certificate Row (evaluated by certificate ExpiryDate)
            var certExpiry = eval.Certificate.ExpiryDate;
            int? certDaysLeft = certExpiry.HasValue ? (certExpiry.Value.DayNumber - today.DayNumber) : null;
            string certDeadlineDisplay = certStatus == "Legacy" || !certExpiry.HasValue
                ? "Không thời hạn"
                : certExpiry.Value.ToString("dd/MM/yyyy", CultureInfo.InvariantCulture);

            string certItemLabel = FormatCertificateItemLabel(eval.CleanName, certStatus);
            bool certRequiresAttention = certStatus is "Expired" or "Expiring" or "Legacy";

            certRows.Add(new ComplianceAttentionRowDto(
                StaffId: staffId,
                StaffCode: staffCode,
                StaffName: staffName,
                DepartmentId: departmentId,
                DepartmentName: departmentName,
                Position: position,
                CertificateId: eval.Certificate.CertificateId,
                CmeCycleId: eval.CycleId,
                Item: certItemLabel,
                ItemType: "certificate",
                Deadline: certExpiry,
                DeadlineDisplay: certDeadlineDisplay,
                DaysLeft: certDaysLeft,
                CmeEarned: eval.EarnedCredits,
                CmeRequired: eval.RequiredCredits,
                CmeDisplay: cmeProgressDisplay,
                Status: certStatus,
                CertWorstStatus: staffWorstCertStatus,
                IsCmeAtRisk: eval.IsCmeAtRisk,
                RequiresAttention: certRequiresAttention,
                ActionUrl: $"/certificates?staffId={staffId}",
                CmeItem: eval.CleanName,
                CmeDeadline: eval.CycleEnd,
                CmeDeadlineDisplay: eval.CycleEnd?.ToString("dd/MM/yyyy", CultureInfo.InvariantCulture) ?? "Chưa đặt chu kỳ",
                CmeDaysLeft: eval.CycleDaysLeft,
                HasCmeCreditsRequirement: eval.HasCmeCreditsRequirement,
                StaffStatus: staffStatus,
                ContractType: contractType,
                CertificateNumber: eval.Certificate.CertificateNumber
            ));

            // 2. CME Row (evaluated by CME CycleEnd & progress)
            string cmeStatus = eval.IsCmeAtRisk
                ? "At risk"
                : string.Equals(eval.CycleStatus, "completed", StringComparison.OrdinalIgnoreCase) ||
                  eval.EarnedCredits >= eval.RequiredCredits
                ? "Completed"
                : "On track";

            string cmeDeadlineStr = eval.CycleEnd.HasValue
                ? eval.CycleEnd.Value.ToString("dd/MM/yyyy", CultureInfo.InvariantCulture)
                : "Chưa đặt chu kỳ";

            cmeRows.Add(new ComplianceAttentionRowDto(
                StaffId: staffId,
                StaffCode: staffCode,
                StaffName: staffName,
                DepartmentId: departmentId,
                DepartmentName: departmentName,
                Position: position,
                CertificateId: eval.Certificate.CertificateId,
                CmeCycleId: eval.CycleId,
                Item: eval.CleanName,
                ItemType: "cme_cycle",
                Deadline: eval.CycleEnd,
                DeadlineDisplay: cmeDeadlineStr,
                DaysLeft: eval.CycleDaysLeft,
                CmeEarned: eval.EarnedCredits,
                CmeRequired: eval.RequiredCredits,
                CmeDisplay: cmeProgressDisplay,
                Status: cmeStatus,
                CertWorstStatus: staffWorstCertStatus,
                IsCmeAtRisk: eval.IsCmeAtRisk,
                RequiresAttention: eval.IsCmeAtRisk,
                ActionUrl: $"/cme-records?staffId={staffId}",
                CmeItem: eval.CleanName,
                CmeDeadline: eval.CycleEnd,
                CmeDeadlineDisplay: cmeDeadlineStr,
                CmeDaysLeft: eval.CycleDaysLeft,
                HasCmeCreditsRequirement: eval.HasCmeCreditsRequirement,
                StaffStatus: staffStatus,
                ContractType: contractType,
                CertificateNumber: eval.Certificate.CertificateNumber
            ));
        }

        return (certRows, cmeRows, staffWorstCertStatus, isStaffCmeAtRisk);
    }

    private static bool IsCertificateExpired(Certificate cert, DateOnly today)
    {
        if (string.Equals(cert.Status, "expired", StringComparison.OrdinalIgnoreCase))
            return true;
        if (cert.ExpiryDate.HasValue && cert.ExpiryDate.Value < today)
            return true;
        return false;
    }

    private static bool IsExpiredCertReplaced(CertCmeEvaluation expiredEval, List<CertCmeEvaluation> activeDatedCerts)
    {
        if (activeDatedCerts.Count == 0)
            return false;

        foreach (var active in activeDatedCerts)
        {
            if (string.Equals(active.CleanName, expiredEval.CleanName, StringComparison.OrdinalIgnoreCase))
                return true;
        }

        return false;
    }

    private static string FormatCertificateItemLabel(string cleanName, string certStatus)
    {
        if (certStatus == "Legacy")
        {
            if (string.IsNullOrWhiteSpace(cleanName) ||
                cleanName.Equals("CCHN", StringComparison.OrdinalIgnoreCase) ||
                cleanName.Equals("Chứng chỉ hành nghề", StringComparison.OrdinalIgnoreCase))
            {
                return "CCHN (cũ)";
            }

            return cleanName.Contains("legacy", StringComparison.OrdinalIgnoreCase) ||
                   cleanName.Contains("cũ", StringComparison.OrdinalIgnoreCase)
                ? cleanName
                : $"{cleanName} (cũ)";
        }

        if (string.IsNullOrWhiteSpace(cleanName))
        {
            return "Giấy phép hành nghề";
        }

        return cleanName;
    }

    private static string FormatPositionLabelVi(string raw)
    {
        var lower = raw.Trim().ToLowerInvariant();
        if (lower == "doctor" || lower == "bs")
            return "Bác sĩ";
        if (lower == "nurse")
            return "Điều dưỡng";
        if (lower == "technician" || lower == "ktv")
            return "Kỹ thuật viên";
        return raw;
    }

    private static string FormatStatusLabelVi(string status) => status switch
    {
        "Expired" => "Đã hết hạn",
        "Expiring" => "Sắp hết hạn",
        "Valid" => "Còn hiệu lực",
        "Legacy" => "CCHN cũ",
        "At risk" => "Có nguy cơ",
        "On track" => "Đúng tiến độ",
        "Completed" => "Đã hoàn thành",
        _ => status
    };

    private static string FormatCmeProgress(decimal earned, decimal required, bool hasCmeCreditsRequirement)
    {
        if (!hasCmeCreditsRequirement)
        {
            // When certificate does not specify CME credits: show "0 / 1" or "1 / 1" without "h" / "credit hours"
            var count = earned >= 1m ? 1 : 0;
            return $"{count} / 1";
        }

        return $"{FormatCreditNumber(earned)} / {FormatCreditNumber(required)} h";
    }

    private static string FormatCreditNumber(decimal value)
    {
        return value == Math.Floor(value)
            ? ((int)value).ToString(CultureInfo.InvariantCulture)
            : value.ToString("0.#", CultureInfo.InvariantCulture);
    }

    private static int GetStatusSeverityOrder(string status) => status switch
    {
        "Expired" => 1,
        "Expiring" => 2,
        "At risk" => 3,
        "Legacy" => 4,
        _ => 5
    };
}
