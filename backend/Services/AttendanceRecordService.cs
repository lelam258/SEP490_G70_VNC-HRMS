using System.Security.Claims;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Vnc.HRMS.Common.Exceptions;
using Vnc.HRMS.DTOs.Attendance;
using Vnc.HRMS.Models;
using Vnc.HRMS.Persistence;
using Vnc.HRMS.Services.Rules;

namespace Vnc.HRMS.Services;

public sealed class AttendanceRecordService(AppDbContext db, AttendanceAccess access, AttendanceImportService imports)
{
    public async Task<object> Options(ClaimsPrincipal user, CancellationToken ct)
    {
        var scope = await access.StaffScope(user, ct, user.IsInRole("accountant"));
        var staff = await scope.OrderBy(x => x.FullName).Select(x => new { id = x.StaffId, code = x.StaffCode, name = x.FullName,
            x.DepartmentId, x.Status, x.DateJoined, x.DateLeft, x.DeviceEnrollId }).ToArrayAsync(ct);
        var departmentIds = staff.Where(x => x.DepartmentId.HasValue).Select(x => x.DepartmentId!.Value).Distinct().ToArray();
        return new {
            staff,
            departments = await db.Departments.AsNoTracking().Where(x => departmentIds.Contains(x.DepartmentId)).Select(x => new { id = x.DepartmentId, x.Name, x.Status }).ToArrayAsync(ct),
            facilities = await db.ScheduleFacilities.AsNoTracking().OrderBy(x => x.Name).ToArrayAsync(ct),
            serverNow = access.Now
        };
    }

    private async Task<IQueryable<AttendanceRecord>> Scope(ClaimsPrincipal user, CancellationToken ct)
    {
        var staff = await access.StaffScope(user, ct);
        if (user.IsInRole("department_head")) {
            var department = await access.Department(user, ct);
            return db.AttendanceRecords.AsNoTracking().Where(x => department.HasValue && (x.DepartmentId == department
                || (x.DepartmentId == null && staff.Any(s => s.StaffId == x.StaffId))));
        }
        return db.AttendanceRecords.AsNoTracking().Where(x => staff.Any(s => s.StaffId == x.StaffId));
    }
    private IQueryable<AttendanceItem> Items(IQueryable<AttendanceRecord> records)
        => from record in records join staff in db.Staff on record.StaffId equals staff.StaffId
           join department in db.Departments on record.DepartmentId equals department.DepartmentId into departments
           from department in departments.DefaultIfEmpty()
           join facility in db.ScheduleFacilities on record.FacilityId equals facility.Id into facilities
           from facility in facilities.DefaultIfEmpty()
           select new AttendanceItem(record.AttendanceId, record.StaffId, staff.StaffCode, staff.FullName,
               record.DepartmentId, department == null ? null : department.Name, record.FacilityId, facility == null ? null : facility.Name,
               record.WorkDate, record.ShiftType, record.CheckIn, record.CheckOut, record.ActualHours,
               record.Source, record.ValidationStatus, record.ImportId, record.OnCallShiftId);

    public async Task<object> List(ClaimsPrincipal user, AttendanceFilter filter, CancellationToken ct)
    {
        var month = string.IsNullOrWhiteSpace(filter.Month) ? access.Today.ToString("yyyy-MM") : filter.Month;
        var (start, end) = AttendanceRules.Month(month);
        var query = (await Scope(user, ct)).Where(x => x.WorkDate >= start && x.WorkDate <= end);
        if (filter.StaffId.HasValue) query = query.Where(x => x.StaffId == filter.StaffId);
        if (filter.DepartmentId.HasValue) query = query.Where(x => x.DepartmentId == filter.DepartmentId);
        if (filter.FacilityId.HasValue) query = query.Where(x => x.FacilityId == filter.FacilityId);
        if (!string.IsNullOrWhiteSpace(filter.Search)) {
            var search = AttendanceRules.Text(filter.Search, "Từ khóa", maximum: 100);
            query = query.Where(x => db.Staff.Any(s => s.StaffId == x.StaffId && (s.StaffCode.Contains(search) || s.FullName.Contains(search))));
        }
        if (!string.IsNullOrWhiteSpace(filter.Status)) query = query.Where(x => x.ValidationStatus == filter.Status);
        if (!string.IsNullOrWhiteSpace(filter.Source)) query = query.Where(x => x.Source == filter.Source);
        var total = await query.CountAsync(ct);
        var pageSize = Math.Clamp(filter.PageSize, 1, 100);
        var page = Math.Clamp(filter.Page, 1, Math.Max(1, (total + pageSize - 1) / pageSize));
        return new { total, page, pageSize, month, lockedReason = await access.LockReason(month!, ct),
            counts = new { confirmed = await query.CountAsync(x => x.ValidationStatus == "confirmed", ct),
                flagged = await query.CountAsync(x => x.ValidationStatus == "flagged", ct),
                unconfirmed = await query.CountAsync(x => x.ValidationStatus != "confirmed", ct) },
            items = await Items(query.OrderByDescending(x => x.WorkDate).ThenBy(x => x.AttendanceId).Skip((page - 1) * pageSize).Take(pageSize)).ToArrayAsync(ct) };
    }

    public async Task<object> Detail(ClaimsPrincipal user, Guid id, CancellationToken ct)
    {
        var scoped = (await Scope(user, ct)).Where(x => x.AttendanceId == id);
        var record = await scoped.SingleOrDefaultAsync(ct);
        if (record is null) {
            if (await db.AttendanceRecords.AnyAsync(x => x.AttendanceId == id, ct)) throw new AppException(403, "Bạn không có quyền xem bản ghi này.");
            throw new AppException(404, "Không tìm thấy bản ghi chấm công.");
        }
        var item = await Items(scoped).SingleAsync(ct);
        var batch = record.ImportId.HasValue ? await db.AttendanceImports.AsNoTracking().Where(x => x.ImportId == record.ImportId)
            .Select(x => new { id = x.ImportId, x.FileName, x.ImportDate, x.DeviceSource }).SingleOrDefaultAsync(ct) : null;
        var actorIds = new[] { record.ConfirmedBy, record.ReconciledBy }.Where(x => x.HasValue).Select(x => x!.Value).ToArray();
        var actors = await db.Users.AsNoTracking().Where(x => actorIds.Contains(x.UserId)).Select(x => new { id = x.UserId, name = x.FullName ?? x.Username }).ToArrayAsync(ct);
        var plans = await imports.PublishedPlans(record.WorkDate, record.WorkDate, ct);
        var pairs = record.TimePairsJson is null ? new[] { new AttendanceTimePair(record.CheckIn, record.CheckOut) }
            : JsonSerializer.Deserialize<AttendanceTimePair[]>(record.TimePairsJson) ?? [];
        var events = await db.AuditLogs.AsNoTracking().Where(x => x.EntityId == id).OrderByDescending(x => x.CreatedAt)
            .Select(x => new { x.LogId, x.Action, x.Username, x.CreatedAt, x.Result }).ToArrayAsync(ct);
        return new { item, pairs, record.DeviceEnrollId, batch, record.Note, record.ReconcileNote,
            record.ReconciledAt, record.ReconciledBy, record.ConfirmedAt, record.ConfirmedBy, actors,
            record.CreatedAt, record.PayslipId, lockedReason = await access.LockReason(record.WorkDate.ToString("yyyy-MM"), ct),
            schedules = plans.Where(x => x.StaffId == record.StaffId).Select(x => new { x.Id, x.FacilityId, x.Date, x.Shift }), events };
    }
}
