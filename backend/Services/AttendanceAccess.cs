using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using Vnc.HRMS.Common.Exceptions;
using Vnc.HRMS.Models.Employees;
using Vnc.HRMS.Persistence;
using Vnc.HRMS.Services.Rules;

namespace Vnc.HRMS.Services;

public sealed class AttendanceAccess(AppDbContext db, TimeProvider? timeProvider = null)
{
    public DateTimeOffset Now => (timeProvider ?? TimeProvider.System).GetUtcNow();
    public DateOnly Today => DateOnly.FromDateTime(Now.ToOffset(TimeSpan.FromHours(7)).DateTime);
    public static Guid Actor(ClaimsPrincipal user) => Guid.TryParse(user.FindFirstValue("sub"), out var id)
        ? id : throw new AppException(401, "Phiên không hợp lệ.");
    public static void RequireHrStaff(ClaimsPrincipal user)
    {
        if (!user.IsInRole("hr_staff")) throw new AppException(403, "Chỉ HR Staff được thực hiện nghiệp vụ chấm công này.");
    }
    public Task<Guid?> Department(ClaimsPrincipal user, CancellationToken ct)
    {
        var actor = Actor(user);
        return db.Staff.AsNoTracking().Where(x => x.UserId == actor).Select(x => x.DepartmentId).SingleOrDefaultAsync(ct);
    }
    public async Task<IQueryable<Staff>> StaffScope(ClaimsPrincipal user, CancellationToken ct, bool history = false)
    {
        var actor = Actor(user);
        var staff = db.Staff.AsNoTracking();
        if (user.IsInRole("admin") || user.IsInRole("hr_manager") || user.IsInRole("hr_staff") || (history && user.IsInRole("accountant"))) return staff;
        if (user.IsInRole("department_head")) {
            var department = await Department(user, ct);
            return staff.Where(x => department.HasValue && x.DepartmentId == department);
        }
        if (user.IsInRole("employee")) return staff.Where(x => x.UserId == actor);
        throw new AppException(403, "Bạn không có quyền xem dữ liệu chấm công.");
    }

    public async Task RequireOpenMonth(string month, CancellationToken ct)
    {
        var (start, _) = AttendanceRules.Month(month);
        var next = start.AddMonths(1);
        var period = await db.PayrollLocks.AsNoTracking().SingleOrDefaultAsync(x => x.PayMonth == month, ct);
        var timesheet = await db.MonthlyTimesheets.AsNoTracking().SingleOrDefaultAsync(x => x.PayMonth == month, ct);
        var timesheetLocked = timesheet?.Status is "locked" or "confirmed" or "paid";
        if (timesheetLocked && timesheet?.Status != "paid" && period?.Status?.Trim().ToLowerInvariant() is "reopened" or "late" or "draft") {
            var lockedAt = timesheet?.LockedAt ?? DateTime.MinValue;
            timesheetLocked = !await (from audit in db.AuditLogs join actor in db.Users on audit.UserId equals actor.UserId
                where audit.EntityId == period!.LockId && audit.EntityType == "PayrollLock" && audit.Action == "reopen"
                    && audit.Result == "success" && actor.Role == "accountant" && audit.CreatedAt > lockedAt
                select audit.LogId).AnyAsync(ct);
        }
        if (period?.Status is "locked" or "paid" or "exported"
            || timesheetLocked
            || await db.Payslips.AnyAsync(x => x.PayMonth == month && (x.Status == "paid" || x.IsLocked == true), ct))
            throw new AppException(400, "MSG11: Tháng đã khóa hoặc đã thanh toán. Không thể thay đổi dữ liệu chấm công.");
        var deadline = new DateTimeOffset(next.AddDays(5).ToDateTime(TimeOnly.MinValue), TimeSpan.FromHours(7));
        if (Now < deadline) return;
        var correctionEnd = new DateTimeOffset(next.AddDays(12).ToDateTime(TimeOnly.MinValue), TimeSpan.FromHours(7));
        // Payroll reopens an unpaid period as draft and records the Late flag in its audit.
        // A draft alone never authorizes late attendance changes: an Accountant reopen is required.
        var reopened = period?.Status?.Trim().ToLowerInvariant() is "reopened" or "late" or "draft" && Now < correctionEnd;
        if (reopened && await (from audit in db.AuditLogs join actor in db.Users on audit.UserId equals actor.UserId
            where audit.EntityId == period!.LockId && audit.EntityType == "PayrollLock" && audit.Action == "reopen"
                && audit.Result == "success" && actor.Role == "accountant"
                && audit.CreatedAt >= deadline.UtcDateTime && audit.CreatedAt < correctionEnd.UtcDateTime
            select audit.LogId).AnyAsync(ct)) return;
        throw new AppException(400, "Đã hết ngày 5 của tháng kế tiếp. Cần kỳ điều chỉnh được Accountant mở lại theo GB-59.");
    }
    public async Task<string?> LockReason(string month, CancellationToken ct)
    {
        try { await RequireOpenMonth(month, ct); return null; }
        catch (AppException error) when (error.StatusCode == 400) { return error.Message; }
    }

    // Import validates exported/finalized evidence in addition to the shared month lock.
    public async Task RequireOpenImportMonth(string month, CancellationToken ct)
    {
        AttendanceRules.Month(month);
        var period = await db.PayrollLocks.AsNoTracking().SingleOrDefaultAsync(x => x.PayMonth == month, ct);
        if (period is not null && (new[] { "paid", "exported", "finalized" }.Contains(period.Status?.Trim().ToLowerInvariant())
            || period.ExportedAt is not null || period.ExportedBy is not null || !string.IsNullOrWhiteSpace(period.ExportFileUrl)))
            throw new AppException(400, "Kỳ đã chốt, xuất dữ liệu hoặc thanh toán. Không thể thay đổi dữ liệu chấm công trực tiếp.");
        await RequireOpenMonth(month, ct);
    }

    public async Task<string?> ImportLockReason(string month, CancellationToken ct)
    {
        try { await RequireOpenImportMonth(month, ct); return null; }
        catch (AppException error) when (error.StatusCode == 400) { return error.Message; }
    }

    // GB-52 & GB-26: Monthly timesheet consolidation opens 2 calendar days before month-end
    // and remains available through day 5 of the following month (or day 6–12 when reopened by Accountant).
    public async Task RequireConsolidationWindow(string month, CancellationToken ct)
    {
        var (start, _) = AttendanceRules.Month(month);
        var openDate = PayrollPeriodRules.GetConsolidationOpenDate(start.Year, start.Month);
        if (Today < openDate)
            throw new AppException(400, $"Chưa đến thời điểm tổng hợp công tháng {month} (mở từ ngày {openDate:dd/MM/yyyy} theo GB-52).");
        await RequireOpenImportMonth(month, ct);
    }

    public async Task<string?> ConsolidationLockReason(string month, CancellationToken ct)
    {
        try { await RequireConsolidationWindow(month, ct); return null; }
        catch (AppException error) when (error.StatusCode == 400) { return error.Message; }
    }
}
