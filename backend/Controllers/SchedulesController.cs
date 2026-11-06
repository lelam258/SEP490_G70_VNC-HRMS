using System.Data;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Vnc.HRMS.Common.Exceptions;
using Vnc.HRMS.Models;
using Vnc.HRMS.Persistence;
using Vnc.HRMS.Services;

namespace Vnc.HRMS.Controllers;

[ApiController, Authorize, Route("api/schedules")]
public sealed class SchedulesController(AppDbContext db) : ControllerBase
{
    private const string ManagerRole = "hr_staff";
    private Guid Actor => Guid.TryParse(User.FindFirstValue("sub"), out var id) ? id : throw new AppException(401, "Phiên không hợp lệ.");
    private bool Reader => User.IsInRole("admin") || User.IsInRole("hr_manager") || User.IsInRole(ManagerRole) || User.IsInRole("department_head");

    private async Task RequireOpenWeek(DateOnly monday, CancellationToken ct)
    {
        ScheduleRules.Editable(monday, ScheduleRules.Today);
        if (await db.ScheduleWeeks.AnyAsync(x => x.Monday == monday && x.Published, ct))
            throw new AppException(400, "Tuần đã chốt. Không thể tạo, sửa hoặc hủy phân công.");
    }
    private async Task<ScheduleWeek> Week(Guid department, DateOnly monday, CancellationToken ct)
    {
        var week = await db.ScheduleWeeks.SingleOrDefaultAsync(x => x.DepartmentId == department && x.Monday == monday, ct);
        if (week != null) return week;
        week = new() { Id = Guid.NewGuid(), DepartmentId = department, Monday = monday };
        db.ScheduleWeeks.Add(week);
        return week;
    }
    private void Audit(ScheduleWeek week, string detail)
    {
        db.Entry(week).Property(x => x.Published).IsModified = true;
        db.ScheduleChanges.Add(new() { Id = Guid.NewGuid(), WeekId = week.Id, ActorId = Actor, At = DateTime.UtcNow, Detail = detail });
    }
    private static string Text(string? value) => !string.IsNullOrWhiteSpace(value) && value.Trim().Length <= 1000
        ? value.Trim() : throw new AppException(400, "Vui lòng nhập nội dung (tối đa 1000 ký tự).");

    [HttpGet("options")]
    public async Task<object> Options(CancellationToken ct) => new {
        facilities = await db.ScheduleFacilities.AsNoTracking().OrderBy(x => x.Name).ToArrayAsync(ct),
        coverage = await db.ScheduleCoverage.AsNoTracking().ToArrayAsync(ct),
        departments = await db.Departments.AsNoTracking().Select(x => new { id = x.DepartmentId, x.Name }).ToArrayAsync(ct),
        staff = await db.Staff.AsNoTracking().Where(x => x.Status == "active" && (Reader || x.UserId == Actor))
            .OrderBy(x => x.FullName).Select(x => new { id = x.StaffId, x.FullName, x.DepartmentId }).ToArrayAsync(ct)
    };

    [HttpGet("week-status")]
    public async Task<object> Status(DateOnly date, CancellationToken ct)
    {
        var monday = ScheduleRules.Monday(date);
        var closed = await db.ScheduleWeeks.AnyAsync(x => x.Monday == monday && x.Published, ct);
        var assignments = from a in db.ScheduleAssignments.AsNoTracking()
                          join w in db.ScheduleWeeks on a.WeekId equals w.Id
                          join s in db.Staff on a.StaffId equals s.StaffId
                          where w.Monday == monday && !a.Cancelled && (Reader || (s.UserId == Actor && w.Published)) select a;
        return new { monday, closed, assignmentCount = await assignments.CountAsync(ct) };
    }

    [HttpGet]
    public async Task<object> List(DateOnly date, Guid? staffId, Guid? departmentId, Guid? facilityId, CancellationToken ct)
    {
        var monday = ScheduleRules.Monday(date);
        var query = from a in db.ScheduleAssignments.AsNoTracking()
                    join w in db.ScheduleWeeks on a.WeekId equals w.Id
                    join c in db.ScheduleCoverage on a.CoverageId equals c.Id
                    join f in db.ScheduleFacilities on c.FacilityId equals f.Id
                    join s in db.Staff on a.StaffId equals s.StaffId
                    where w.Monday == monday && (Reader || (s.UserId == Actor && w.Published))
                    where (!staffId.HasValue || s.StaffId == staffId) && (!departmentId.HasValue || w.DepartmentId == departmentId) && (!facilityId.HasValue || c.FacilityId == facilityId)
                    orderby a.Date, a.Shift, s.FullName
                    select new { assignment = a, w.Published, s.FullName, facility = f.Name, c.FacilityId, coverage = c.Name, w.DepartmentId };
        var rows = await query.ToArrayAsync(ct);
        return rows.Select(x => new { x.assignment, version = ScheduleRules.AssignmentVersion(x.assignment), x.Published, x.FullName, x.facility, x.FacilityId, x.coverage, x.DepartmentId,
            start = ScheduleRules.Hours(x.assignment.Date, x.assignment.Shift).Start.ToString("HH:mm"),
            end = ScheduleRules.Hours(x.assignment.Date, x.assignment.Shift).End.ToString("HH:mm"),
            dutyCredit = ScheduleRules.IsDuty(x.assignment.Shift) && !x.assignment.Cancelled && x.assignment.PatientConfirmed });
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
        await tx.CommitAsync(ct);
        return new { created = entries.Length };
    }
    [HttpPost("full-day"), Authorize(Roles = ManagerRole)]
    public async Task<object> FullDay(AssignmentRequest request, CancellationToken ct)
    {
        await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        var morning = await Save(null, request with { Shift = "morning" }, ct, false);
        var afternoon = await Save(null, request with { Shift = "afternoon" }, ct, false);
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
        await RequireOpenWeek(monday, ct);
        ScheduleRules.Hours(request.Date, request.Shift);
        ScheduleAssignment? item = null;
        if (id.HasValue) {
            item = await db.ScheduleAssignments.SingleOrDefaultAsync(x => x.Id == id, ct) ?? throw new AppException(404, "Không tìm thấy phân công.");
            var originalWeek = await db.ScheduleWeeks.SingleAsync(x => x.Id == item.WeekId, ct);
            if (originalWeek.Monday != monday) throw new AppException(400, "Chỉ đổi ngày trong cùng tuần của phân công.");
            ScheduleRules.CheckAssignmentVersion(item, request.ExpectedVersion);
            if (item.Cancelled || item.PatientConfirmed || item.ActualEndAt.HasValue) throw new AppException(400, "Không sửa ca đã hủy hoặc đã ghi nhận trực.");
        }
        var staff = await db.Staff.SingleOrDefaultAsync(x => x.StaffId == request.StaffId && x.Status == "active", ct)
            ?? throw new AppException(400, "Nhân viên không tồn tại hoặc đã ngừng làm việc.");
        var department = staff.DepartmentId ?? throw new AppException(400, "Cần cập nhật khoa/phòng cho nhân viên trước khi xếp lịch.");
        if (staff.DateLeft.HasValue && staff.DateLeft.Value < request.Date) throw new AppException(400, "Ngày phân công nằm sau ngày nghỉ việc.");
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
        Audit(week, $"{(id.HasValue ? "Sửa" : "Tạo")} {item.Id}: {System.Text.Json.JsonSerializer.Serialize(request)}");
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
        await RequireOpenWeek(week.Monday, ct);
        ScheduleRules.CheckAssignmentVersion(item, request.ExpectedVersion);
        if (item.PatientConfirmed || item.ActualEndAt.HasValue || item.Cancelled) throw new AppException(400, "Không thể hủy ca đã ghi nhận trực hoặc đã hủy.");
        item.Cancelled = true; item.Reason = Text(request.Reason); Audit(week, $"Hủy {id}: {item.Reason}");
        await db.SaveChangesAsync(ct); await tx.CommitAsync(ct);
        return new { message = "Đã hủy phân công." };
    }
    [HttpPost("publish"), Authorize(Roles = ManagerRole)]
    public async Task<object> Publish(DateOnly monday, CancellationToken ct)
    {
        await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        await RequireOpenWeek(monday, ct);
        var weeks = await db.ScheduleWeeks.Where(x => x.Monday == monday).ToArrayAsync(ct);
        var weekIds = weeks.Select(x => x.Id).ToArray();
        var count = await db.ScheduleAssignments.CountAsync(x => weekIds.Contains(x.WeekId) && !x.Cancelled, ct);
        if (count == 0) throw new AppException(400, "Chưa có phân công để chốt tuần.");
        var valid = await (from a in db.ScheduleAssignments join w in db.ScheduleWeeks on a.WeekId equals w.Id
                           join s in db.Staff on a.StaffId equals s.StaffId
                           where w.Monday == monday && !a.Cancelled && s.Status == "active" && s.DepartmentId == w.DepartmentId
                               && (!s.DateLeft.HasValue || s.DateLeft >= a.Date)
                               && !db.LeaveRequests.Any(l => l.StaffId == a.StaffId && l.Status == "approved" && l.StartDate <= a.Date && l.EndDate >= a.Date)
                           select a.Id).CountAsync(ct);
        if (valid != count) throw new AppException(400, "Có nhân viên nghỉ phép, nghỉ việc hoặc đã đổi khoa. Cần sửa/hủy phân công đó trước khi chốt.");
        foreach (var week in weeks) { week.Published = true; Audit(week, "HR Staff chốt lịch tuần"); }
        await db.SaveChangesAsync(ct); await tx.CommitAsync(ct);
        return new { message = "Đã chốt lịch tuần. Nhân viên có thể xem lịch cá nhân." };
    }

    [HttpPost("reopen"), Authorize(Roles = ManagerRole)]
    public async Task<object> Reopen(DateOnly monday, ReasonRequest request, CancellationToken ct)
    {
        var reason = Text(request.Reason);
        ScheduleRules.Editable(monday, ScheduleRules.Today);
        await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        var weeks = await db.ScheduleWeeks.Where(x => x.Monday == monday).ToArrayAsync(ct);
        if (!weeks.Any(x => x.Published))
            throw new AppException(400, "Tuần chưa chốt hoặc đã được mở lại.");
        foreach (var week in weeks) {
            week.Published = false;
            Audit(week, $"HR Staff mở lại lịch tuần để sửa sai: {reason}");
        }
        // Keep assignments and actual duty records intact. Save/Cancel still protect
        // assignments with confirmed patient service or an actual duty end.
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return new { message = "Đã mở lại tuần. Sửa lịch rồi chốt lại để nhân viên xem." };
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
        ScheduleRules.ValidateDutyEnd(item.Date, item.Shift, request.EndedAt, DateTimeOffset.UtcNow);
        item.ActualEndAt = request.EndedAt.ToUniversalTime(); item.EndNote = Text(request.Note); item.EndRecordedBy = Actor; item.EndRecordedAt = DateTime.UtcNow;
        Audit(week, $"Kết thúc trực {id}: {request.EndedAt:O}; {item.EndNote}");
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
        ScheduleRules.ValidateDutyStarted(item.Date, item.Shift, DateTimeOffset.UtcNow);
        item.PatientConfirmed = true; item.PatientEvidence = Text(request.Evidence); item.ConfirmedBy = Actor; item.ConfirmedAt = DateTime.UtcNow;
        Audit(week, $"Xác nhận phục vụ bệnh nhân cho {id}: {item.PatientEvidence}");
        await db.SaveChangesAsync(ct); await tx.CommitAsync(ct);
        return new { message = "Đã ghi nhận công trực." };
    }
}
