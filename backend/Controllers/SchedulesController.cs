using System.Data;
using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Vnc.HRMS.Common.Exceptions;
using Vnc.HRMS.DTOs.Schedules;
using Vnc.HRMS.Models;
using Vnc.HRMS.Persistence;
using Vnc.HRMS.Services;

namespace Vnc.HRMS.Controllers;

[ApiController, Authorize, Route("api/schedules")]
public sealed class SchedulesController(AppDbContext db, TimeProvider? timeProvider = null) : ControllerBase
{
    private const string ManagerRole = "hr_staff";
    private DateTimeOffset Now => (timeProvider ?? TimeProvider.System).GetUtcNow();
    private Guid Actor => Guid.TryParse(User.FindFirstValue("sub"), out var id) ? id : throw new AppException(401, "Phiên không hợp lệ.");
    private bool Reader => User.IsInRole("admin") || User.IsInRole("hr_manager") || User.IsInRole(ManagerRole) || User.IsInRole("department_head");

    private Task<bool> IsCorrectionWeek(DateOnly monday, CancellationToken ct)
        => (from change in db.ScheduleChanges
            join week in db.ScheduleWeeks on change.WeekId equals week.Id
            where week.Monday == monday && change.Detail.StartsWith(ScheduleRules.ReopenAuditPrefix)
            select change.Id).AnyAsync(ct);

    private async Task<bool> RequireOpenWeek(DateOnly monday, CancellationToken ct)
    {
        if (await db.ScheduleWeeks.AnyAsync(x => x.Monday == monday && x.Published, ct))
            throw new AppException(400, "Tuần đã chốt. Không thể tạo, sửa hoặc hủy phân công.");
        var isCorrection = await IsCorrectionWeek(monday, ct);
        ScheduleRules.Editable(monday, Now, isCorrection);
        return isCorrection;
    }
    private async Task<ScheduleWeek> Week(Guid department, DateOnly monday, CancellationToken ct)
    {
        var week = await db.ScheduleWeeks.SingleOrDefaultAsync(x => x.DepartmentId == department && x.Monday == monday, ct);
        if (week != null) return week;
        week = new() { Id = Guid.NewGuid(), DepartmentId = department, Monday = monday };
        db.ScheduleWeeks.Add(week);
        return week;
    }
    private static object PlanSnapshot(ScheduleAssignment item, bool published = false) => new { item.Id, item.StaffId, item.Date, item.Shift,
        item.CoverageId, item.Reason, item.TransferConsent, status = item.Cancelled ? "cancelled" : published ? "published" : "draft", item.PatientConfirmed, item.ActualEndAt };

    private void Audit(ScheduleWeek week, string detail, ScheduleAssignment? assignment = null, object? previous = null, Guid? facilityId = null)
    {
        db.Entry(week).Property(x => x.Published).IsModified = true;
        var change = new ScheduleChange { Id = Guid.NewGuid(), WeekId = week.Id, ActorId = Actor, At = Now.UtcDateTime, Detail = detail };
        db.ScheduleChanges.Add(change);
        var action = detail.StartsWith("Tạo ", StringComparison.Ordinal) ? "assign" : detail.StartsWith("Sửa ", StringComparison.Ordinal) ? "edit_assignment"
            : detail.StartsWith("Hủy ", StringComparison.Ordinal) ? "cancel_assignment"
            : detail.StartsWith(ScheduleRules.ReopenAuditPrefix, StringComparison.Ordinal) ? "reopen_schedule"
            : detail.StartsWith("HR Staff chốt", StringComparison.Ordinal) ? "publish_schedule" : "record_duty";
        db.AuditLogs.Add(new AuditLog { LogId = change.Id, UserId = Actor, CreatedAt = change.At, Module = "schedules", Action = action,
            EntityType = assignment is null ? "ScheduleWeek" : "ScheduleAssignment", EntityId = assignment?.Id ?? week.Id,
            DepartmentId = week.DepartmentId, FacilityId = facilityId, StaffId = assignment?.StaffId, WorkDate = assignment?.Date ?? week.Monday,
            OldValue = previous is null ? action == "reopen_schedule" ? JsonSerializer.Serialize(new { status = "published" })
                : action == "publish_schedule" ? JsonSerializer.Serialize(new { status = "draft" }) : null : JsonSerializer.Serialize(previous),
            NewValue = assignment is null ? JsonSerializer.Serialize(new { status = week.Published ? "published" : "draft", reason = detail })
                : JsonSerializer.Serialize(PlanSnapshot(assignment, week.Published)) });
    }
    private static string Text(string? value) => !string.IsNullOrWhiteSpace(value) && value.Trim().Length <= 1000
        ? value.Trim() : throw new AppException(400, "Vui lòng nhập nội dung (tối đa 1000 ký tự).");

    private IQueryable<ScheduleRosterRow> Roster(DateOnly monday, bool personal = false)
        => from a in db.ScheduleAssignments.AsNoTracking()
           join w in db.ScheduleWeeks on a.WeekId equals w.Id
           join c in db.ScheduleCoverage on a.CoverageId equals c.Id
           join f in db.ScheduleFacilities on c.FacilityId equals f.Id
           join s in db.Staff on a.StaffId equals s.StaffId
           where w.Monday == monday && (!personal || (s.UserId == Actor && w.Published))
           select new ScheduleRosterRow(a, w.Published, s.FullName, f.Name, c.FacilityId, c.Name, w.DepartmentId);

    private static ScheduleRosterRow[] Snapshot(ScheduleWeek week)
        => week.PublishedSnapshot is null ? [] : JsonSerializer.Deserialize<ScheduleRosterRow[]>(week.PublishedSnapshot)!;

    private async Task<ScheduleRosterRow[]> ReadRoster(DateOnly monday, CancellationToken ct)
    {
        // Keep the live/published selection consistent if HR republishes during this read.
        await using var tx = !Reader ? await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct) : null;
        var rows = await Roster(monday, !Reader).ToListAsync(ct);
        if (!Reader) {
            var ownStaff = await db.Staff.Where(x => x.UserId == Actor).Select(x => x.StaffId).ToArrayAsync(ct);
            var reopened = await db.ScheduleWeeks.AsNoTracking()
                .Where(x => x.Monday == monday && !x.Published && x.PublishedSnapshot != null).ToArrayAsync(ct);
            var published = reopened.SelectMany(Snapshot).Where(x => ownStaff.Contains(x.Assignment.StaffId)).ToArray();
            var ids = published.Select(x => x.Assignment.Id).ToArray();
            var actual = await db.ScheduleAssignments.AsNoTracking().Where(x => ids.Contains(x.Id)).ToDictionaryAsync(x => x.Id, ct);
            foreach (var row in published) {
                // The plan stays frozen; actual duty evidence remains current.
                if (!actual.TryGetValue(row.Assignment.Id, out var live)) continue;
                row.Assignment.PatientConfirmed = live.PatientConfirmed;
                row.Assignment.PatientEvidence = live.PatientEvidence;
                row.Assignment.ConfirmedBy = live.ConfirmedBy;
                row.Assignment.ConfirmedAt = live.ConfirmedAt;
                row.Assignment.ActualEndAt = live.ActualEndAt;
                row.Assignment.EndNote = live.EndNote;
                row.Assignment.EndRecordedBy = live.EndRecordedBy;
                row.Assignment.EndRecordedAt = live.EndRecordedAt;
            }
            rows.AddRange(published);
        }
        if (tx != null) await tx.CommitAsync(ct);
        return rows.ToArray();
    }

    private static object Display(ScheduleRosterRow row) => new {
        assignment = row.Assignment, version = ScheduleRules.AssignmentVersion(row.Assignment), row.Published,
        row.FullName, facility = row.Facility, row.FacilityId, coverage = row.Coverage, row.DepartmentId,
        start = ScheduleRules.Hours(row.Assignment.Date, row.Assignment.Shift).Start.ToString("HH:mm"),
        end = ScheduleRules.Hours(row.Assignment.Date, row.Assignment.Shift).End.ToString("HH:mm"),
        dutyCredit = ScheduleRules.IsDuty(row.Assignment.Shift) && !row.Assignment.Cancelled && row.Assignment.PatientConfirmed
    };

    private void ValidateChanges(DateOnly monday, bool isCorrection, params (DateOnly Date, string Shift)[] affected)
    {
        var now = Now;
        ScheduleRules.Editable(monday, now, isCorrection);
        foreach (var entry in affected) ScheduleRules.ValidateAffectedShift(entry.Date, entry.Shift, now);
    }

    [HttpGet("availability"), Authorize(Roles = ManagerRole)]
    public async Task<object> Availability(Guid staffId, DateOnly date, Guid? excludeAssignmentId, CancellationToken ct)
    {
        var monday = ScheduleRules.Monday(date);
        var sunday = monday.AddDays(6);
        var assignments = await (from a in db.ScheduleAssignments.AsNoTracking()
                                 join c in db.ScheduleCoverage on a.CoverageId equals c.Id
                                 join f in db.ScheduleFacilities on c.FacilityId equals f.Id
                                 where a.StaffId == staffId && !a.Cancelled && a.Id != excludeAssignmentId
                                     && a.Date >= monday && a.Date <= sunday
                                 orderby a.Date, a.Shift
                                 select new { a.Id, a.Date, a.Shift, c.FacilityId, facility = f.Name }).ToArrayAsync(ct);
        var leave = await db.LeaveRequests.AsNoTracking().Where(x => x.StaffId == staffId && x.Status == "approved"
            && x.StartDate <= sunday && x.EndDate >= monday).Select(x => new { x.StartDate, x.EndDate }).ToArrayAsync(ct);
        return new { staffId, monday, assignments, leave };
    }

    [HttpGet("options")]
    public async Task<object> Options(CancellationToken ct) => new {
        facilities = await db.ScheduleFacilities.AsNoTracking().OrderBy(x => x.Name).ToArrayAsync(ct),
        coverage = await db.ScheduleCoverage.AsNoTracking().ToArrayAsync(ct),
        departments = await db.Departments.AsNoTracking().Select(x => new { id = x.DepartmentId, x.Name, x.Status }).ToArrayAsync(ct),
        staff = await db.Staff.AsNoTracking().Where(x => x.Status == "active" && (Reader || x.UserId == Actor))
            .OrderBy(x => x.FullName).Select(x => new { id = x.StaffId, x.FullName, x.DepartmentId, x.DateJoined, x.DateLeft }).ToArrayAsync(ct)
    };

    [HttpGet("week-status")]
    public async Task<object> Status(DateOnly date, CancellationToken ct)
    {
        var monday = ScheduleRules.Monday(date);
        var closed = await db.ScheduleWeeks.AnyAsync(x => x.Monday == monday && x.Published, ct);
        var rows = await ReadRoster(monday, ct);
        return new { monday, closed = Reader ? closed : rows.Any(x => x.Published), assignmentCount = rows.Count(x => !x.Assignment.Cancelled),
            isCorrection = await IsCorrectionWeek(monday, ct), serverNow = Now,
            planningStartsAt = ScheduleRules.PlanningStart(monday),
            publishDeadline = ScheduleRules.PublishDeadline(monday),
            correctionEndsAt = ScheduleRules.CorrectionEnd(monday) };
    }

    [HttpGet]
    public async Task<object> List(DateOnly date, Guid? staffId, Guid? departmentId, Guid? facilityId, CancellationToken ct)
    {
        var monday = ScheduleRules.Monday(date);
        var rows = await ReadRoster(monday, ct);
        return rows.Where(x => (!staffId.HasValue || x.Assignment.StaffId == staffId)
                && (!departmentId.HasValue || x.DepartmentId == departmentId) && (!facilityId.HasValue || x.FacilityId == facilityId))
            .OrderBy(x => x.Assignment.Date).ThenBy(x => x.Assignment.Shift).ThenBy(x => x.FullName).Select(Display).ToArray();
    }

    // Existing clients can still send CoverageId; the simple form sends FacilityId.
    public sealed record AssignmentRequest(Guid StaffId, Guid CoverageId, DateOnly Date, string Shift, string? Reason, string? TransferConsent, string? ExpectedVersion = null, Guid? FacilityId = null);
    public sealed record WeeklyAssignmentRequest(Guid StaffId, Guid CoverageId, DateOnly Monday, int[] Days, string[] Shifts, string? Reason, string? TransferConsent, Guid? FacilityId = null);

    [HttpPost("assign-week"), Authorize(Roles = ManagerRole)]
    public async Task<object> AssignWeek(WeeklyAssignmentRequest request, CancellationToken ct)
    {
        var entries = ScheduleRules.ExpandWeek(request.Monday, request.Days, request.Shifts);
        await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        foreach (var entry in entries) {
            try {
                await Save(null, new(request.StaffId, request.CoverageId, entry.Date, entry.Shift, request.Reason, request.TransferConsent, FacilityId: request.FacilityId), ct, false);
            } catch (AppException error) when (error.StatusCode == 400) {
                throw new AppException(400, $"Ngày {entry.Date:dd/MM/yyyy}, ca {ScheduleRules.ShiftName(entry.Shift)}: {error.Message} Chưa lưu phân công nào trong lần này.");
            }
        }
        ValidateChanges(request.Monday, await IsCorrectionWeek(request.Monday, ct), entries);
        await tx.CommitAsync(ct);
        return new { created = entries.Length };
    }
    [HttpPost("full-day"), Authorize(Roles = ManagerRole)]
    public async Task<object> FullDay(AssignmentRequest request, CancellationToken ct)
    {
        await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        var morning = await Save(null, request with { Shift = "morning" }, ct, false);
        var afternoon = await Save(null, request with { Shift = "afternoon" }, ct, false);
        var monday = ScheduleRules.Monday(request.Date);
        ValidateChanges(monday, await IsCorrectionWeek(monday, ct), (request.Date, "morning"), (request.Date, "afternoon"));
        await tx.CommitAsync(ct);
        return new { morning, afternoon };
    }
    [HttpPost("assignments"), Authorize(Roles = ManagerRole)]
    public Task<object> Create(AssignmentRequest request, CancellationToken ct) => Save(null, request, ct);
    [HttpPut("assignments/{id:guid}"), Authorize(Roles = ManagerRole)]
    public Task<object> Update(Guid id, AssignmentRequest request, CancellationToken ct) => Save(id, request, ct);

    private async Task<object> Save(Guid? id, AssignmentRequest request, CancellationToken ct, bool ownTransaction = true)
    {
        await using var tx = ownTransaction ? await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct) : null;
        var monday = ScheduleRules.Monday(request.Date);
        var isCorrection = await RequireOpenWeek(monday, ct);
        ScheduleRules.Hours(request.Date, request.Shift);
        ScheduleAssignment? item = null;
        object? previous = null;
        var affected = new List<(DateOnly Date, string Shift)> { (request.Date, request.Shift) };
        if (id.HasValue) {
            item = await db.ScheduleAssignments.SingleOrDefaultAsync(x => x.Id == id, ct) ?? throw new AppException(404, "Không tìm thấy phân công.");
            var originalWeek = await db.ScheduleWeeks.SingleAsync(x => x.Id == item.WeekId, ct);
            if (originalWeek.Monday != monday) throw new AppException(400, "Chỉ đổi ngày trong cùng tuần của phân công.");
            ScheduleRules.CheckAssignmentVersion(item, request.ExpectedVersion);
            if (item.Cancelled || item.PatientConfirmed || item.ActualEndAt.HasValue) throw new AppException(400, "Không sửa ca đã hủy hoặc đã ghi nhận trực.");
            affected.Add((item.Date, item.Shift));
            previous = PlanSnapshot(item);
        }
        ValidateChanges(monday, isCorrection, affected.ToArray());
        var staff = await db.Staff.SingleOrDefaultAsync(x => x.StaffId == request.StaffId && x.Status == "active", ct)
            ?? throw new AppException(400, "Nhân viên không tồn tại hoặc đã ngừng làm việc.");
        var department = staff.DepartmentId ?? throw new AppException(400, "Cần cập nhật khoa/phòng cho nhân viên trước khi xếp lịch.");
        if (staff.DateJoined > request.Date) throw new AppException(400, "Ngày phân công nằm trước ngày vào làm.");
        if (staff.DateLeft.HasValue && staff.DateLeft.Value < request.Date) throw new AppException(400, "Ngày phân công nằm sau ngày nghỉ việc.");
        if (!await db.Departments.AnyAsync(x => x.DepartmentId == department && x.Status == "active", ct))
            throw new AppException(400, "Khoa/phòng của nhân viên đã ngừng hoạt động.");
        if (await db.LeaveRequests.AnyAsync(x => x.StaffId == staff.StaffId && x.Status == "approved" && x.StartDate <= request.Date && x.EndDate >= request.Date, ct))
            throw new AppException(400, "Nhân viên đã có nghỉ phép được duyệt.");

        ScheduleCoverage coverage;
        if (request.FacilityId.HasValue) {
            if (!await db.ScheduleFacilities.AnyAsync(x => x.Id == request.FacilityId, ct)) throw new AppException(400, "Cơ sở không tồn tại.");
            var name = await db.Departments.Where(x => x.DepartmentId == department).Select(x => x.Name).SingleAsync(ct);
            coverage = await db.ScheduleCoverage.FirstOrDefaultAsync(x => x.DepartmentId == department && x.FacilityId == request.FacilityId && x.Name == name, ct)
                ?? new ScheduleCoverage { Id = Guid.NewGuid(), DepartmentId = department, FacilityId = request.FacilityId.Value, Name = name };
            if (db.Entry(coverage).State == EntityState.Detached) db.ScheduleCoverage.Add(coverage);
        } else {
            coverage = await db.ScheduleCoverage.SingleOrDefaultAsync(x => x.Id == request.CoverageId && x.DepartmentId == department, ct)
                ?? throw new AppException(400, "Vui lòng chọn cơ sở hợp lệ.");
        }
        if (!await db.ScheduleFacilities.AnyAsync(x => x.Id == coverage.FacilityId && x.Status == "active", ct))
            throw new AppException(400, "Cơ sở không tồn tại hoặc đã ngừng hoạt động.");
        if (await db.ScheduleAssignments.AnyAsync(x => !x.Cancelled && x.Id != (id ?? Guid.Empty) && x.StaffId == staff.StaffId && x.Date == request.Date && x.Shift == request.Shift, ct))
            throw new AppException(400, "Nhân viên đã được phân công trong ngày và ca này. Hãy sửa phân công hiện có.");
        var consent = string.IsNullOrWhiteSpace(request.TransferConsent) ? null : Text(request.TransferConsent);
        var crossFacility = await (from a in db.ScheduleAssignments join c in db.ScheduleCoverage on a.CoverageId equals c.Id
                                   where !a.Cancelled && a.Id != (id ?? Guid.Empty) && a.StaffId == staff.StaffId && a.Date == request.Date && c.FacilityId != coverage.FacilityId select a.Id).AnyAsync(ct);
        if (crossFacility && consent == null) throw new AppException(400, "Làm việc tại hai cơ sở trong ngày: mở Ghi chú / điều chuyển và nhập xác nhận đồng ý.");
        var week = await Week(department, monday, ct);
        if (item == null) { item = new() { Id = Guid.NewGuid() }; db.ScheduleAssignments.Add(item); }
        item.WeekId = week.Id; item.StaffId = staff.StaffId; item.CoverageId = coverage.Id; item.Date = request.Date; item.Shift = request.Shift;
        item.Reason = string.IsNullOrWhiteSpace(request.Reason) ? "Phân công lịch làm việc tuần" : Text(request.Reason); item.TransferConsent = consent;
        Audit(week, $"{(id.HasValue ? "Sửa" : "Tạo")} {item.Id}: {System.Text.Json.JsonSerializer.Serialize(request)}", item, previous, coverage.FacilityId);
        ValidateChanges(monday, isCorrection, affected.ToArray());
        await db.SaveChangesAsync(ct);
        if (tx != null) await tx.CommitAsync(ct);
        return item;
    }

    public sealed record ReasonRequest(string Reason, string? ExpectedVersion = null);
    [HttpPost("assignments/{id:guid}/cancel"), Authorize(Roles = ManagerRole)]
    public async Task<object> Cancel(Guid id, ReasonRequest request, CancellationToken ct)
    {
        await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        var item = await db.ScheduleAssignments.SingleOrDefaultAsync(x => x.Id == id, ct) ?? throw new AppException(404, "Không có phân công.");
        var week = await db.ScheduleWeeks.SingleAsync(x => x.Id == item.WeekId, ct);
        var isCorrection = await RequireOpenWeek(week.Monday, ct);
        ScheduleRules.CheckAssignmentVersion(item, request.ExpectedVersion);
        if (item.PatientConfirmed || item.ActualEndAt.HasValue || item.Cancelled) throw new AppException(400, "Không thể hủy ca đã ghi nhận trực hoặc đã hủy.");
        var previous = PlanSnapshot(item);
        item.Cancelled = true; item.Reason = Text(request.Reason);
        var facility = await db.ScheduleCoverage.Where(x => x.Id == item.CoverageId).Select(x => x.FacilityId).SingleAsync(ct);
        Audit(week, $"Hủy {id}: {item.Reason}", item, previous, facility);
        ValidateChanges(week.Monday, isCorrection, (item.Date, item.Shift));
        await db.SaveChangesAsync(ct); await tx.CommitAsync(ct);
        return new { message = "Đã hủy phân công." };
    }
    [HttpPost("publish"), Authorize(Roles = ManagerRole)]
    public async Task<object> Publish(DateOnly monday, CancellationToken ct)
    {
        await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        var isCorrection = await RequireOpenWeek(monday, ct);
        var weeks = await db.ScheduleWeeks.Where(x => x.Monday == monday).ToArrayAsync(ct);
        var weekIds = weeks.Select(x => x.Id).ToArray();
        var count = await db.ScheduleAssignments.CountAsync(x => weekIds.Contains(x.WeekId) && !x.Cancelled, ct);
        if (count == 0 && !isCorrection) throw new AppException(400, "Chưa có phân công để chốt tuần.");
        var valid = await (from a in db.ScheduleAssignments join w in db.ScheduleWeeks on a.WeekId equals w.Id
                           join s in db.Staff on a.StaffId equals s.StaffId
                           join d in db.Departments on w.DepartmentId equals d.DepartmentId
                           join c in db.ScheduleCoverage on a.CoverageId equals c.Id
                           join f in db.ScheduleFacilities on c.FacilityId equals f.Id
                           where w.Monday == monday && !a.Cancelled && s.Status == "active" && s.DepartmentId == w.DepartmentId
                               && d.Status == "active" && f.Status == "active" && s.DateJoined <= a.Date
                               && (!s.DateLeft.HasValue || s.DateLeft >= a.Date)
                               && !db.LeaveRequests.Any(l => l.StaffId == a.StaffId && l.Status == "approved" && l.StartDate <= a.Date && l.EndDate >= a.Date)
                           select a.Id).CountAsync(ct);
        if (valid != count) throw new AppException(400, "Có phân công ngoài thời gian công tác, nhân viên nghỉ phép, nghỉ việc, đổi khoa hoặc khoa/phòng/cơ sở ngừng hoạt động. Cần sửa/hủy trước khi chốt.");
        var affected = new List<(DateOnly Date, string Shift)>();
        if (isCorrection) {
            var previous = weeks.SelectMany(Snapshot).ToDictionary(x => x.Assignment.Id, x => x.Assignment);
            var current = await db.ScheduleAssignments.AsNoTracking().Where(x => weekIds.Contains(x.WeekId)).ToArrayAsync(ct);
            foreach (var item in current) {
                if (previous.TryGetValue(item.Id, out var original)) {
                    if (ScheduleRules.SamePlan(original, item)) continue;
                    affected.Add((original.Date, original.Shift));
                } else if (item.Cancelled) continue;
                affected.Add((item.Date, item.Shift));
            }
        }
        foreach (var week in weeks) { week.Published = true; week.PublishedSnapshot = null; Audit(week, "HR Staff chốt lịch tuần"); }
        ValidateChanges(monday, isCorrection, affected.ToArray());
        await db.SaveChangesAsync(ct); await tx.CommitAsync(ct);
        return new { message = "Đã chốt lịch tuần. Nhân viên có thể xem lịch cá nhân." };
    }

    [HttpPost("reopen"), Authorize(Roles = ManagerRole)]
    public async Task<object> Reopen(DateOnly monday, ReasonRequest request, CancellationToken ct)
    {
        var reason = Text(request.Reason);
        ScheduleRules.Reopenable(monday, Now);
        await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        var weeks = await db.ScheduleWeeks.Where(x => x.Monday == monday).ToArrayAsync(ct);
        if (!weeks.Any(x => x.Published))
            throw new AppException(400, "Tuần chưa chốt hoặc đã được mở lại.");
        var roster = await Roster(monday).ToArrayAsync(ct);
        foreach (var week in weeks) {
            week.PublishedSnapshot = JsonSerializer.Serialize(roster.Where(x => x.Assignment.WeekId == week.Id));
            week.Published = false;
            Audit(week, ScheduleRules.ReopenAuditPrefix + reason);
        }
        // Keep assignments and actual duty records intact. Save/Cancel still protect
        // assignments with confirmed patient service or an actual duty end.
        ScheduleRules.Reopenable(monday, Now);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return new { message = "Đã mở lại tuần. Nhân viên tiếp tục xem lịch đã công bố cho đến khi chốt lại." };
    }

    // Actual duty records remain separate from scheduling; they do not reopen a closed week.
    public sealed record PatientRequest(string Evidence, string? ExpectedVersion = null);
    public sealed record DutyEndRequest(DateTimeOffset EndedAt, string Note, string? ExpectedVersion = null);
    [HttpPost("assignments/{id:guid}/end-duty"), Authorize(Roles = ManagerRole)]
    public async Task<object> EndDuty(Guid id, DutyEndRequest request, CancellationToken ct)
    {
        await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        var item = await db.ScheduleAssignments.SingleOrDefaultAsync(x => x.Id == id, ct) ?? throw new AppException(404, "Không có phân công.");
        var week = await db.ScheduleWeeks.SingleAsync(x => x.Id == item.WeekId, ct);
        ScheduleRules.CheckAssignmentVersion(item, request.ExpectedVersion);
        if (!week.Published || item.Cancelled || item.ActualEndAt.HasValue) throw new AppException(400, "Chỉ ghi nhận một lần cho ca trực đã chốt và chưa hủy.");
        ScheduleRules.ValidateDutyEnd(item.Date, item.Shift, request.EndedAt, Now);
        var previous = PlanSnapshot(item, week.Published);
        var facility = await db.ScheduleCoverage.Where(x => x.Id == item.CoverageId).Select(x => x.FacilityId).SingleAsync(ct);
        item.ActualEndAt = request.EndedAt.ToUniversalTime(); item.EndNote = Text(request.Note); item.EndRecordedBy = Actor; item.EndRecordedAt = Now.UtcDateTime;
        Audit(week, $"Kết thúc trực {id}: {request.EndedAt:O}; {item.EndNote}", item, previous, facility);
        await db.SaveChangesAsync(ct); await tx.CommitAsync(ct);
        return new { message = "Đã ghi nhận kết thúc thực tế. Công trực cần xác nhận phục vụ bệnh nhân riêng." };
    }
    [HttpPost("assignments/{id:guid}/patient-confirmation"), Authorize(Roles = ManagerRole)]
    public async Task<object> Patient(Guid id, PatientRequest request, CancellationToken ct)
    {
        await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        var item = await db.ScheduleAssignments.SingleOrDefaultAsync(x => x.Id == id, ct) ?? throw new AppException(404, "Không có phân công.");
        var week = await db.ScheduleWeeks.SingleAsync(x => x.Id == item.WeekId, ct);
        ScheduleRules.CheckAssignmentVersion(item, request.ExpectedVersion);
        if (!week.Published || item.Cancelled || !ScheduleRules.IsDuty(item.Shift) || item.PatientConfirmed) throw new AppException(400, "Chỉ xác nhận một lần cho ca trực đã chốt và chưa hủy.");
        ScheduleRules.ValidateDutyStarted(item.Date, item.Shift, Now);
        var previous = PlanSnapshot(item, week.Published);
        var facility = await db.ScheduleCoverage.Where(x => x.Id == item.CoverageId).Select(x => x.FacilityId).SingleAsync(ct);
        item.PatientConfirmed = true; item.PatientEvidence = Text(request.Evidence); item.ConfirmedBy = Actor; item.ConfirmedAt = Now.UtcDateTime;
        Audit(week, $"Xác nhận phục vụ bệnh nhân cho {id}: {item.PatientEvidence}", item, previous, facility);
        await db.SaveChangesAsync(ct); await tx.CommitAsync(ct);
        return new { message = "Đã ghi nhận công trực." };
    }
}
