using Microsoft.EntityFrameworkCore;
using Vnc.HRMS.DTOs.Payroll;
using Vnc.HRMS.Models;
using Vnc.HRMS.Models.Employees;
using Vnc.HRMS.Models.Organization;
using Vnc.HRMS.Models.Users;
using Vnc.HRMS.Persistence;
using Vnc.HRMS.Repositories.Interfaces;

namespace Vnc.HRMS.Repositories;

public sealed class PayrollInquiryRepository(AppDbContext db) : IPayrollInquiryRepository
{
    private static readonly string[] FinalizedPeriodStatuses = ["finalized", "locked", "paid"];
    private static readonly TimeSpan VietnamOffset = TimeSpan.FromHours(7);

    public Task<Staff?> FindStaffByUserIdAsync(Guid userId, CancellationToken ct)
        => db.Staff.AsNoTracking().SingleOrDefaultAsync(x => x.UserId == userId, ct);

    public Task<Payslip?> FindPayslipByIdAsync(Guid payslipId, CancellationToken ct)
        => db.Payslips.AsNoTracking().SingleOrDefaultAsync(x => x.PayslipId == payslipId, ct);

    public Task<Payslip?> FindPayslipByStaffAndMonthAsync(Guid staffId, string payMonth, CancellationToken ct)
        => db.Payslips.AsNoTracking().SingleOrDefaultAsync(x => x.StaffId == staffId && x.PayMonth == payMonth, ct);

    public Task<PayrollLock?> FindPeriodByMonthAsync(string payMonth, CancellationToken ct)
        => db.PayrollLocks.AsNoTracking().SingleOrDefaultAsync(x => x.PayMonth == payMonth, ct);

    public Task<Complaint?> FindByIdAsync(Guid complaintId, CancellationToken ct)
        => db.Complaints.AsNoTracking().SingleOrDefaultAsync(x => x.ComplaintId == complaintId, ct);

    public Task<Complaint?> FindByIdTrackedAsync(Guid complaintId, CancellationToken ct)
        => db.Complaints.SingleOrDefaultAsync(x => x.ComplaintId == complaintId, ct);

    public Task<List<ComplaintAttachment>> GetAttachmentsByComplaintIdAsync(Guid complaintId, CancellationToken ct)
        => db.ComplaintAttachments.AsNoTracking()
            .Where(x => x.ComplaintId == complaintId)
            .OrderBy(x => x.UploadedAt)
            .ToListAsync(ct);

    public Task<Staff?> FindStaffByIdAsync(Guid staffId, CancellationToken ct)
        => db.Staff.AsNoTracking().SingleOrDefaultAsync(x => x.StaffId == staffId, ct);

    public async Task<Department?> FindDepartmentByIdAsync(Guid? departmentId, CancellationToken ct)
    {
        if (!departmentId.HasValue) return null;
        return await db.Departments.AsNoTracking().SingleOrDefaultAsync(x => x.DepartmentId == departmentId.Value, ct);
    }

    public async Task<Dictionary<Guid, string>> GetUserNamesByIdsAsync(IEnumerable<Guid> userIds, CancellationToken ct)
    {
        var ids = userIds.Where(x => x != Guid.Empty).Distinct().ToList();
        if (ids.Count == 0) return [];
        return await db.Users.AsNoTracking()
            .Where(u => ids.Contains(u.UserId))
            .ToDictionaryAsync(u => u.UserId, u => u.FullName ?? u.Username, ct);
    }

    public Task<List<User>> GetActiveAccountantsAsync(CancellationToken ct)
        => db.Users.AsNoTracking()
            .Where(u => u.Role == "accountant" && u.AccountStatus == "active")
            .ToListAsync(ct);

    public async Task<List<PayrollInquiryListItemDto>> ListMyInquiriesAsync(
        Guid staffId, MyPayrollInquiryFilter filter, CancellationToken ct)
    {
        var raw = await (
            from c in db.Complaints.AsNoTracking()
            join s in db.Staff.AsNoTracking() on c.StaffId equals s.StaffId
            join d in db.Departments.AsNoTracking() on c.DepartmentId equals d.DepartmentId into deptGroup
            from dept in deptGroup.DefaultIfEmpty()
            join ps in db.Payslips.AsNoTracking() on c.PayslipId equals ps.PayslipId into psGroup
            from payslip in psGroup.DefaultIfEmpty()
            join u in db.Users.AsNoTracking() on c.RepliedBy equals u.UserId into userGroup
            from replier in userGroup.DefaultIfEmpty()
            where c.StaffId == staffId
            orderby c.SubmittedAt descending, c.ComplaintId descending
            select new
            {
                c.ComplaintId,
                c.StaffId,
                s.StaffCode,
                StaffName = s.FullName,
                c.DepartmentId,
                DepartmentName = dept != null ? dept.Name : null,
                PayMonth = c.PayMonth ?? (payslip != null ? payslip.PayMonth : null),
                c.PayslipId,
                c.InquiryType,
                c.Subject,
                c.Description,
                c.Status,
                c.Response,
                RepliedByName = replier != null ? (replier.FullName ?? replier.Username) : null,
                c.SubmittedAt,
                c.RepliedAt,
                c.ResolvedAt,
                AttachmentCount = db.ComplaintAttachments.Count(a => a.ComplaintId == c.ComplaintId)
            }
        ).ToListAsync(ct);

        var periods = await db.PayrollLocks.AsNoTracking()
            .ToDictionaryAsync(p => p.PayMonth, p => p.Status, ct);

        var normalizedStatusFilter = NormalizeStatusFilter(filter.Status);
        var typeFilter = filter.InquiryType?.Trim().ToLowerInvariant();
        var search = filter.Search?.Trim().ToLowerInvariant();
        var todayUtc = DateTime.UtcNow;

        var items = new List<PayrollInquiryListItemDto>();
        foreach (var r in raw)
        {
            var status = NormalizeStatus(r.Status);
            var code = BuildInquiryCode(r.ComplaintId, r.SubmittedAt);

            if (!string.IsNullOrEmpty(normalizedStatusFilter) && normalizedStatusFilter != "all" && status != normalizedStatusFilter)
                continue;
            if (!string.IsNullOrEmpty(typeFilter) && typeFilter != "all" && !string.Equals(r.InquiryType, typeFilter, StringComparison.OrdinalIgnoreCase))
                continue;

            if (filter.FromDate.HasValue || filter.ToDate.HasValue)
            {
                var submittedLocalDate = DateOnly.FromDateTime((r.SubmittedAt ?? todayUtc).Add(VietnamOffset));
                if (filter.FromDate.HasValue && submittedLocalDate < filter.FromDate.Value) continue;
                if (filter.ToDate.HasValue && submittedLocalDate > filter.ToDate.Value) continue;
            }

            if (!string.IsNullOrEmpty(search))
            {
                var matches = code.ToLowerInvariant().Contains(search)
                    || r.Subject.ToLowerInvariant().Contains(search)
                    || r.Description.ToLowerInvariant().Contains(search)
                    || (r.PayMonth != null && r.PayMonth.ToLowerInvariant().Contains(search));
                if (!matches) continue;
            }

            string? periodStatus = null;
            if (!string.IsNullOrWhiteSpace(r.PayMonth) && periods.TryGetValue(r.PayMonth, out var psStatus))
            {
                periodStatus = psStatus;
            }
            var isFinalized = IsFinalizedStatus(periodStatus);

            items.Add(new PayrollInquiryListItemDto(
                ComplaintId: r.ComplaintId,
                InquiryCode: code,
                StaffId: r.StaffId,
                StaffCode: r.StaffCode,
                StaffName: r.StaffName,
                DepartmentId: r.DepartmentId,
                DepartmentName: r.DepartmentName,
                PayMonth: r.PayMonth,
                PayslipId: r.PayslipId,
                IsPeriodFinalized: isFinalized,
                PeriodStatus: periodStatus,
                InquiryType: r.InquiryType,
                Subject: r.Subject,
                Status: status,
                ResponsePreview: BuildPreview(r.Response),
                RepliedByName: r.RepliedByName,
                AttachmentCount: r.AttachmentCount,
                MissingEvidence: r.AttachmentCount == 0,
                AgeDays: ComputeAgeDays(r.SubmittedAt, todayUtc),
                SubmittedAt: r.SubmittedAt,
                RepliedAt: r.RepliedAt,
                ResolvedAt: r.ResolvedAt
            ));
        }

        return items;
    }

    public async Task<PayrollInquiryQueueResponseDto> ListQueueAsync(
        PayrollInquiryQueueFilter filter, CancellationToken ct)
    {
        var raw = await (
            from c in db.Complaints.AsNoTracking()
            join s in db.Staff.AsNoTracking() on c.StaffId equals s.StaffId
            join d in db.Departments.AsNoTracking() on c.DepartmentId equals d.DepartmentId into deptGroup
            from dept in deptGroup.DefaultIfEmpty()
            join ps in db.Payslips.AsNoTracking() on c.PayslipId equals ps.PayslipId into psGroup
            from payslip in psGroup.DefaultIfEmpty()
            join u in db.Users.AsNoTracking() on c.RepliedBy equals u.UserId into userGroup
            from replier in userGroup.DefaultIfEmpty()
            orderby c.SubmittedAt descending, c.ComplaintId descending
            select new
            {
                c.ComplaintId,
                c.StaffId,
                s.StaffCode,
                StaffName = s.FullName,
                DepartmentId = c.DepartmentId ?? s.DepartmentId,
                DepartmentName = dept != null ? dept.Name : null,
                PayMonth = c.PayMonth ?? (payslip != null ? payslip.PayMonth : null),
                c.PayslipId,
                c.InquiryType,
                c.Subject,
                c.Description,
                c.Status,
                c.Response,
                RepliedByName = replier != null ? (replier.FullName ?? replier.Username) : null,
                c.SubmittedAt,
                c.RepliedAt,
                c.ResolvedAt,
                AttachmentCount = db.ComplaintAttachments.Count(a => a.ComplaintId == c.ComplaintId)
            }
        ).ToListAsync(ct);

        var periods = await db.PayrollLocks.AsNoTracking()
            .ToDictionaryAsync(p => p.PayMonth, p => p.Status, ct);

        var counts = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase)
        {
            ["all"] = 0,
            ["submitted"] = 0,
            ["in_review"] = 0,
            ["resolved"] = 0,
            ["rejected"] = 0
        };

        var typeFilter = filter.InquiryType?.Trim().ToLowerInvariant();
        var monthFilter = filter.PayMonth?.Trim();
        var search = filter.Search?.Trim().ToLowerInvariant();
        var statusFilter = NormalizeStatusFilter(filter.Status);
        var todayUtc = DateTime.UtcNow;

        var filtered = new List<PayrollInquiryListItemDto>();

        foreach (var r in raw)
        {
            // Lọc trước theo khoa, loại, tháng, từ khóa để StatusCounts khớp với ngữ cảnh tìm kiếm hiện tại
            if (filter.DepartmentId.HasValue && r.DepartmentId != filter.DepartmentId.Value) continue;
            if (!string.IsNullOrEmpty(typeFilter) && typeFilter != "all" && !string.Equals(r.InquiryType, typeFilter, StringComparison.OrdinalIgnoreCase))
                continue;
            if (!string.IsNullOrEmpty(monthFilter) && !string.Equals(r.PayMonth, monthFilter, StringComparison.OrdinalIgnoreCase))
                continue;

            var code = BuildInquiryCode(r.ComplaintId, r.SubmittedAt);
            if (!string.IsNullOrEmpty(search))
            {
                var matches = code.ToLowerInvariant().Contains(search)
                    || r.StaffCode.ToLowerInvariant().Contains(search)
                    || r.StaffName.ToLowerInvariant().Contains(search)
                    || r.Subject.ToLowerInvariant().Contains(search)
                    || r.Description.ToLowerInvariant().Contains(search);
                if (!matches) continue;
            }

            var status = NormalizeStatus(r.Status);
            counts["all"]++;
            if (counts.ContainsKey(status)) counts[status]++;

            if (!string.IsNullOrEmpty(statusFilter) && statusFilter != "all" && status != statusFilter)
                continue;

            string? periodStatus = null;
            if (!string.IsNullOrWhiteSpace(r.PayMonth) && periods.TryGetValue(r.PayMonth, out var psStatus))
            {
                periodStatus = psStatus;
            }
            var isFinalized = IsFinalizedStatus(periodStatus);

            filtered.Add(new PayrollInquiryListItemDto(
                ComplaintId: r.ComplaintId,
                InquiryCode: code,
                StaffId: r.StaffId,
                StaffCode: r.StaffCode,
                StaffName: r.StaffName,
                DepartmentId: r.DepartmentId,
                DepartmentName: r.DepartmentName,
                PayMonth: r.PayMonth,
                PayslipId: r.PayslipId,
                IsPeriodFinalized: isFinalized,
                PeriodStatus: periodStatus,
                InquiryType: r.InquiryType,
                Subject: r.Subject,
                Status: status,
                ResponsePreview: BuildPreview(r.Response),
                RepliedByName: r.RepliedByName,
                AttachmentCount: r.AttachmentCount,
                MissingEvidence: r.AttachmentCount == 0,
                AgeDays: ComputeAgeDays(r.SubmittedAt, todayUtc),
                SubmittedAt: r.SubmittedAt,
                RepliedAt: r.RepliedAt,
                ResolvedAt: r.ResolvedAt
            ));
        }

        // Ưu tiên hồ sơ đang mở (submitted / in_review) lên trước, tiếp theo mới đến các hồ sơ đã đóng
        var ordered = filtered
            .OrderBy(x => x.Status is "submitted" or "in_review" ? 0 : 1)
            .ThenByDescending(x => x.SubmittedAt)
            .ThenByDescending(x => x.ComplaintId)
            .ToList();

        var total = ordered.Count;
        var pageSize = Math.Clamp(filter.PageSize, 1, 100);
        var maxPage = Math.Max(1, (int)Math.Ceiling(total / (double)pageSize));
        var page = Math.Clamp(filter.Page, 1, maxPage);
        var pagedItems = ordered.Skip((page - 1) * pageSize).Take(pageSize).ToList();

        var departments = await db.Departments.AsNoTracking()
            .Where(d => d.Status == "active")
            .OrderBy(d => d.Name)
            .Select(d => new InquiryDepartmentOptionDto(d.DepartmentId, d.Name))
            .ToListAsync(ct);

        return new PayrollInquiryQueueResponseDto(total, page, pageSize, counts, departments, pagedItems);
    }

    public async Task<(string? AttendanceStatus, bool AttendanceConfirmed, int VerifiedProcedures, int UnverifiedProcedures)>
        GetSourceVerificationStateAsync(Guid staffId, string? payMonth, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(payMonth))
            return (null, false, 0, 0);

        var timesheet = await db.MonthlyTimesheets.AsNoTracking()
            .SingleOrDefaultAsync(x => x.PayMonth == payMonth, ct);
        var attendanceStatus = timesheet?.Status;
        var attendanceConfirmed = string.Equals(attendanceStatus, "locked", StringComparison.OrdinalIgnoreCase)
            || string.Equals(attendanceStatus, "finalized", StringComparison.OrdinalIgnoreCase);

        if (!DateOnly.TryParseExact(payMonth + "-01", "yyyy-MM-dd", out var monthStart))
            return (attendanceStatus, attendanceConfirmed, 0, 0);
        var monthEnd = monthStart.AddMonths(1).AddDays(-1);

        var procStatuses = await (
            from pa in db.ProcedureAssignments.AsNoTracking()
            join ps in db.ProcedureSlips.AsNoTracking() on pa.SlipId equals ps.SlipId
            where pa.StaffId == staffId && ps.ProcedureDate >= monthStart && ps.ProcedureDate <= monthEnd
            select ps.Status
        ).ToListAsync(ct);

        var verified = procStatuses.Count(s => string.Equals(s, "verified", StringComparison.OrdinalIgnoreCase));
        var unverified = procStatuses.Count(s => !string.Equals(s, "verified", StringComparison.OrdinalIgnoreCase)
            && !string.Equals(s, "rejected", StringComparison.OrdinalIgnoreCase)
            && !string.Equals(s, "cancelled", StringComparison.OrdinalIgnoreCase));

        return (attendanceStatus, attendanceConfirmed, verified, unverified);
    }

    public void AddComplaint(Complaint complaint) => db.Complaints.Add(complaint);
    public void AddAttachments(IEnumerable<ComplaintAttachment> attachments) => db.ComplaintAttachments.AddRange(attachments);
    public void AddNotifications(IEnumerable<Notification> notifications) => db.Notifications.AddRange(notifications);

    public static string NormalizeStatus(string? status)
    {
        var norm = status?.Trim().ToLowerInvariant();
        return norm switch
        {
            "in_review" => "in_review",
            "resolved" => "resolved",
            "rejected" => "rejected",
            _ => "submitted"
        };
    }

    private static string? NormalizeStatusFilter(string? status)
    {
        if (string.IsNullOrWhiteSpace(status)) return null;
        var norm = status.Trim().ToLowerInvariant();
        return norm == "open" ? "submitted" : norm;
    }

    public static bool IsFinalizedStatus(string? status)
        => !string.IsNullOrWhiteSpace(status) && FinalizedPeriodStatuses.Contains(status.Trim().ToLowerInvariant());

    public static string BuildInquiryCode(Guid complaintId, DateTime? submittedAt)
    {
        var ym = (submittedAt ?? DateTime.UtcNow).Add(VietnamOffset).ToString("yyyyMM");
        var suffix = complaintId.ToString("N")[..4].ToUpperInvariant();
        return $"KN-{ym}-{suffix}";
    }

    private static string? BuildPreview(string? response)
    {
        if (string.IsNullOrWhiteSpace(response)) return null;
        var clean = response.Trim();
        return clean.Length <= 140 ? clean : clean[..137] + "...";
    }

    private static int ComputeAgeDays(DateTime? submittedAt, DateTime nowUtc)
    {
        if (!submittedAt.HasValue) return 0;
        return Math.Max(0, (int)Math.Floor((nowUtc - submittedAt.Value).TotalDays));
    }
}
