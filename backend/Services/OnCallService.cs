using System.Data;
using System.Security.Claims;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Vnc.HRMS.Common.Exceptions;
using Vnc.HRMS.DTOs.Attendance;
using Vnc.HRMS.Models;
using Vnc.HRMS.Persistence;
using Vnc.HRMS.Services.Interfaces;
using Vnc.HRMS.Services.Rules;

namespace Vnc.HRMS.Services;

public sealed class OnCallService(AppDbContext db, AttendanceAccess access, AttendanceImportService imports, IAuditLogHelper audit)
{
    public async Task<object> Context(ClaimsPrincipal user, Guid staffId, Guid facilityId, DateOnly date, CancellationToken ct)
    {
        AttendanceAccess.RequireHrStaff(user);
        var plans = (await imports.PublishedPlans(date, date, ct)).Where(x => x.StaffId == staffId).ToArray();
        var facilities = await db.ScheduleFacilities.AsNoTracking().ToDictionaryAsync(x => x.Id, x => x.Name, ct);
        var evidence = await db.AttendanceRecords.AsNoTracking().Where(x => x.StaffId == staffId && x.WorkDate == date
            && (x.FacilityId == facilityId || x.FacilityId == null)).Select(x => new { id = x.AttendanceId, x.CheckIn, x.CheckOut, x.Source, x.ValidationStatus }).ToArrayAsync(ct);
        return new {
            staffId, date, facilityId,
            schedules = plans.Select(x => new { x.Id, x.FacilityId, facilityName = facilities.GetValueOrDefault(x.FacilityId), x.Shift,
                start = ScheduleRules.Hours(date, x.Shift).Start.ToString("HH:mm"), end = ScheduleRules.Hours(date, x.Shift).End.ToString("HH:mm") }),
            approvedLeave = await db.LeaveRequests.AnyAsync(x => x.StaffId == staffId && x.Status == "approved" && x.StartDate <= date && x.EndDate >= date, ct),
            evidence, lockedReason = await access.LockReason(date.ToString("yyyy-MM"), ct)
        };
    }
    private async Task<IQueryable<OnCallShift>> Scope(ClaimsPrincipal user, CancellationToken ct)
    {
        var staff = await access.StaffScope(user, ct);
        if (user.IsInRole("department_head")) {
            var department = await access.Department(user, ct);
            return db.OnCallShifts.AsNoTracking().Where(x => department.HasValue && x.DepartmentId == department);
        }
        return db.OnCallShifts.AsNoTracking().Where(x => staff.Any(s => s.StaffId == x.StaffId));
    }
    private IQueryable<object> Display(IQueryable<OnCallShift> query)
        => from shift in query join staff in db.Staff on shift.StaffId equals staff.StaffId
           join facility in db.ScheduleFacilities on shift.FacilityId equals facility.Id into facilities
           from facility in facilities.DefaultIfEmpty()
           join department in db.Departments on shift.DepartmentId equals department.DepartmentId
           join recorder in db.Users on shift.RecordedBy equals recorder.UserId into recorders
           from recorder in recorders.DefaultIfEmpty()
           join confirmer in db.Users on shift.ConfirmedBy equals confirmer.UserId into confirmers
           from confirmer in confirmers.DefaultIfEmpty()
           select new { id = shift.ShiftId, shift.StaffId, staff.StaffCode, staffName = staff.FullName, shift.DepartmentId,
               departmentName = department.Name, shift.FacilityId, facilityName = facility == null ? null : facility.Name,
               date = shift.ShiftDate, category = shift.ShiftCategory, start = shift.ShiftStart, end = shift.ShiftEnd,
               shift.Status, shift.Note, shift.DeviationReason, shift.SupervisorEvidence, shift.ReviewNote,
               shift.ScheduleAssignmentId, shift.AttendanceEvidenceId, shift.RecordedBy, shift.ConfirmedBy,
               recordedByName = recorder == null ? null : recorder.FullName ?? recorder.Username,
               confirmedByName = confirmer == null ? null : confirmer.FullName ?? confirmer.Username,
               shift.ConfirmedAt, shift.CreatedAt, shift.UpdatedAt, version = Convert.ToBase64String(shift.Version) };

    public async Task<object> List(ClaimsPrincipal user, AttendanceFilter filter, CancellationToken ct)
    {
        var month = string.IsNullOrWhiteSpace(filter.Month) ? access.Today.ToString("yyyy-MM") : filter.Month;
        var (start, end) = AttendanceRules.Month(month);
        var query = (await Scope(user, ct)).Where(x => x.ShiftDate >= start && x.ShiftDate <= end);
        if (filter.StaffId.HasValue) query = query.Where(x => x.StaffId == filter.StaffId);
        if (filter.DepartmentId.HasValue) query = query.Where(x => x.DepartmentId == filter.DepartmentId);
        if (filter.FacilityId.HasValue) query = query.Where(x => x.FacilityId == filter.FacilityId);
        if (!string.IsNullOrEmpty(filter.Status)) query = query.Where(x => x.Status == filter.Status);
        if (!string.IsNullOrWhiteSpace(filter.Search)) {
            var search = AttendanceRules.Text(filter.Search, "Từ khóa", maximum: 100);
            query = query.Where(x => db.Staff.Any(s => s.StaffId == x.StaffId && (s.StaffCode.Contains(search) || s.FullName.Contains(search))));
        }
        var total = await query.CountAsync(ct);
        var pageSize = Math.Clamp(filter.PageSize, 1, 100); var page = Math.Clamp(filter.Page, 1, Math.Max(1, (total + pageSize - 1) / pageSize));
        return new { total, page, pageSize, month, lockedReason = await access.LockReason(month!, ct),
            items = await Display(query.OrderByDescending(x => x.ShiftDate).ThenBy(x => x.ShiftId).Skip((page - 1) * pageSize).Take(pageSize)).ToArrayAsync(ct) };
    }
    public async Task<object> Detail(ClaimsPrincipal user, Guid id, CancellationToken ct)
    {
        var query = (await Scope(user, ct)).Where(x => x.ShiftId == id);
        var shift = await query.SingleOrDefaultAsync(ct);
        if (shift is null) {
            if (await db.OnCallShifts.AnyAsync(x => x.ShiftId == id, ct)) throw new AppException(403, "Bạn không có quyền xem hồ sơ trực này.");
            throw new AppException(404, "Không tìm thấy hồ sơ trực.");
        }
        var hours = ScheduleRules.Hours(shift.ShiftDate, shift.ShiftCategory);
        return new { item = await Display(query).SingleAsync(ct), plannedStart = hours.Start.ToString("HH:mm"), plannedEnd = hours.End.ToString("HH:mm"),
            actualHours = shift.ShiftStart.HasValue && shift.ShiftEnd.HasValue ? (decimal?)(shift.ShiftEnd.Value - shift.ShiftStart.Value).TotalHours : null,
            lockedReason = await access.LockReason(shift.ShiftDate.ToString("yyyy-MM"), ct) };
    }

    public async Task<object> Save(ClaimsPrincipal user, Guid? id, SaveOnCallRequest request, CancellationToken ct)
    {
        AttendanceAccess.RequireHrStaff(user);
        await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        OnCallShift? shift = null;
        object? previous = null;
        if (id.HasValue) {
            shift = await db.OnCallShifts.SingleOrDefaultAsync(x => x.ShiftId == id, ct) ?? throw new AppException(404, "Không tìm thấy hồ sơ trực.");
            AttendanceRules.RequireVersion(shift.Version, request.Version);
            if (shift.Status != "pending" || shift.ConfirmedAt.HasValue) throw new AppException(400, "Chỉ sửa hồ sơ trực đang chờ xác nhận.");
            await access.RequireOpenMonth(shift.ShiftDate.ToString("yyyy-MM"), ct);
            previous = Snapshot(shift);
        }
        await access.RequireOpenMonth(request.Date.ToString("yyyy-MM"), ct);
        if (!ScheduleRules.IsDuty(request.Category)) throw new AppException(400, "Chọn trực trưa hoặc trực tối.");
        if (request.Date > access.Today) throw new AppException(400, "Không ghi nhận trực thực tế cho ngày tương lai.");
        var pairs = AttendanceRules.Pairs(request.Date, [new(request.Start, request.End)]);
        var start = pairs[0].In!.Value; var end = pairs[0].Out!.Value;
        var plannedHours = ScheduleRules.Hours(request.Date, request.Category);
        if (end.TimeOfDay <= plannedHours.Start.ToTimeSpan() || start.TimeOfDay >= plannedHours.End.ToTimeSpan())
            throw new AppException(400, "Giờ trực thực tế phải thuộc khoảng ca trực trưa hoặc trực tối đã chọn.");
        if (end > access.Now.ToOffset(TimeSpan.FromHours(7)).DateTime) throw new AppException(400, "Giờ kết thúc thực tế không được ở tương lai.");
        var staff = await db.Staff.SingleOrDefaultAsync(x => x.StaffId == request.StaffId && x.Status == "active", ct)
            ?? throw new AppException(400, "Nhân viên không tồn tại hoặc đã ngừng làm việc.");
        if (staff.DepartmentId is not Guid department || !await db.Departments.AnyAsync(x => x.DepartmentId == department && x.Status == "active", ct)
            || staff.DateJoined > request.Date || (staff.DateLeft.HasValue && staff.DateLeft < request.Date))
            throw new AppException(400, "Khoa/phòng hoặc thời gian công tác của nhân viên không hợp lệ.");
        if (!await db.ScheduleFacilities.AnyAsync(x => x.Id == request.FacilityId && x.Status == "active", ct)) throw new AppException(400, "Cơ sở không hoạt động.");
        if (await db.LeaveRequests.AnyAsync(x => x.StaffId == staff.StaffId && x.Status == "approved" && x.StartDate <= request.Date && x.EndDate >= request.Date, ct))
            throw new AppException(400, "Ca trực trùng với nghỉ phép đã được duyệt.");
        if (await db.OnCallShifts.AnyAsync(x => x.ShiftId != (id ?? Guid.Empty) && x.StaffId == staff.StaffId && x.ShiftDate == request.Date
            && x.Status != "cancelled" && x.Status != "rejected" && (x.ShiftCategory == request.Category || (x.ShiftStart < end && x.ShiftEnd > start)), ct))
            throw new AppException(400, "Đã có hồ sơ trực cùng ca hoặc trùng thời gian.");
        var plans = (await imports.PublishedPlans(request.Date, request.Date, ct)).Where(x => x.StaffId == staff.StaffId).ToArray();
        var exactPlan = plans.FirstOrDefault(x => x.FacilityId == request.FacilityId && x.Shift == request.Category);
        var plan = exactPlan.Id != Guid.Empty ? exactPlan : plans.FirstOrDefault(x => x.Shift == request.Category);
        foreach (var other in plans.Where(x => x.Id != plan.Id)) {
            var hours = ScheduleRules.Hours(other.Date, other.Shift);
            if (other.Date.ToDateTime(hours.Start) < end && other.Date.ToDateTime(hours.End) > start)
                throw new AppException(400, "Thời gian trực trùng với một phân công đã công bố khác.");
        }
        var note = AttendanceRules.Text(request.Note, "Ghi chú");
        var reason = AttendanceRules.Text(request.DeviationReason, "Lý do điều chỉnh");
        var evidence = AttendanceRules.Text(request.SupervisorEvidence, "Căn cứ xác nhận quản lý");
        if (exactPlan.Id == Guid.Empty && (reason.Length == 0 || evidence.Length == 0))
            throw new AppException(400, "Trực ngoài lịch hoặc khác cơ sở đã phân công cần lý do, căn cứ quản lý và xác nhận điều chuyển khi áp dụng.");
        if ((start.TimeOfDay != plannedHours.Start.ToTimeSpan() || end.TimeOfDay != plannedHours.End.ToTimeSpan() || id.HasValue) && reason.Length == 0)
            throw new AppException(400, "Cần lý do khi sửa hồ sơ hoặc giờ thực tế khác giờ dự kiến.");
        AttendanceRecord? attendance = null;
        if (request.AttendanceEvidenceId.HasValue) {
            attendance = await db.AttendanceRecords.AsNoTracking().SingleOrDefaultAsync(x => x.AttendanceId == request.AttendanceEvidenceId
                && x.StaffId == staff.StaffId && x.WorkDate == request.Date && (x.FacilityId == request.FacilityId || x.FacilityId == null), ct)
                ?? throw new AppException(400, "Bằng chứng chấm công không thuộc nhân viên, ngày hoặc cơ sở đã chọn.");
        }
        var reviews = new List<string>();
        if (request.Category == "evening" && end.TimeOfDay < plannedHours.End.ToTimeSpan() && evidence.Length == 0)
            reviews.Add("Trực tối kết thúc sớm: cần quản lý xác nhận tình huống phục vụ bệnh nhân trước khi duyệt");
        if (attendance is null) reviews.Add("Chưa liên kết bằng chứng chấm công để đối chiếu");
        else {
            var evidencePairs = attendance.TimePairsJson is null ? [new AttendanceTimePair(attendance.CheckIn, attendance.CheckOut)]
                : JsonSerializer.Deserialize<AttendanceTimePair[]>(attendance.TimePairsJson) ?? [];
            var coveredUntil = start;
            foreach (var pair in evidencePairs.OrderBy(x => x.In))
                if (pair.In <= coveredUntil && pair.Out > coveredUntil) coveredUntil = pair.Out.Value;
            if (coveredUntil < end) reviews.Add("Giờ trực chưa khớp các cặp Vào/Ra trên bằng chứng chấm công");
        }
        if (shift is null) { shift = new OnCallShift { ShiftId = Guid.NewGuid(), RecordedBy = AttendanceAccess.Actor(user) }; db.OnCallShifts.Add(shift); }
        shift.StaffId = staff.StaffId; shift.DepartmentId = department; shift.FacilityId = request.FacilityId;
        shift.ShiftDate = request.Date; shift.ShiftCategory = request.Category; shift.ShiftStart = start; shift.ShiftEnd = end;
        shift.Note = note; shift.DeviationReason = reason; shift.SupervisorEvidence = evidence;
        shift.ScheduleAssignmentId = plan.Id == Guid.Empty ? null : plan.Id; shift.AttendanceEvidenceId = attendance?.AttendanceId;
        shift.ReviewNote = reviews.Count == 0 ? null : string.Join(". ", reviews) + "."; shift.Status = "pending";
        audit.Log(id.HasValue ? "edit_on_call" : "create_on_call", "OnCallShift", shift.ShiftId, previous, Snapshot(shift));
        await access.RequireOpenMonth(request.Date.ToString("yyyy-MM"), ct);
        await db.SaveChangesAsync(ct); await tx.CommitAsync(ct);
        return new { id = shift.ShiftId, message = "Đã lưu hồ sơ trực chờ xác nhận. Chưa được dùng để tính lương.", shift.ReviewNote };
    }

    public async Task<object> Verify(ClaimsPrincipal user, Guid id, VerifyOnCallRequest request, CancellationToken ct)
    {
        AttendanceAccess.RequireHrStaff(user);
        await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        var shift = await db.OnCallShifts.SingleOrDefaultAsync(x => x.ShiftId == id, ct)
            ?? throw new AppException(404, "Không tìm thấy hồ sơ trực.");
        AttendanceRules.RequireVersion(shift.Version, request.Version);
        await access.RequireOpenMonth(shift.ShiftDate.ToString("yyyy-MM"), ct);
        var decision = request.Decision?.Trim().ToLowerInvariant();
        if (decision is not ("confirm" or "return" or "reject"))
            throw new AppException(400, "Chọn Xác nhận hoặc Trả về để điều chỉnh.");
        var previous = Snapshot(shift);
        if (!string.IsNullOrWhiteSpace(request.SupervisorEvidence))
            shift.SupervisorEvidence = AttendanceRules.Text(request.SupervisorEvidence, "Căn cứ xác nhận quản lý");

        if (decision == "confirm") {
            if (shift.Status == "confirmed") throw new AppException(409, "Hồ sơ trực này đã được xác nhận.");
            if (shift.Status is "cancelled" or "rejected") throw new AppException(400, "Hồ sơ trực đã hủy hoặc từ chối; không thể xác nhận.");
            if (!shift.ShiftStart.HasValue || !shift.ShiftEnd.HasValue || shift.ShiftEnd <= shift.ShiftStart)
                throw new AppException(400, "MSG04: Dữ liệu giờ trực chưa đầy đủ hoặc không hợp lệ. Vui lòng kiểm tra lại.");
            var planned = ScheduleRules.Hours(shift.ShiftDate, shift.ShiftCategory);
            var earlyEvening = shift.ShiftCategory == "evening" && shift.ShiftEnd.Value.TimeOfDay < planned.End.ToTimeSpan();
            if (earlyEvening && string.IsNullOrWhiteSpace(shift.SupervisorEvidence)) {
                var patientConfirmed = shift.ScheduleAssignmentId.HasValue
                    && await db.ScheduleAssignments.AnyAsync(x => x.Id == shift.ScheduleAssignmentId && x.PatientConfirmed, ct);
                if (!patientConfirmed)
                    throw new AppException(400, "MSG04: Ca trực tối kết thúc sớm do hết bệnh nhân bắt buộc có xác nhận của quản lý trước khi xác nhận (GB-13).");
            }
            if (await db.LeaveRequests.AnyAsync(x => x.StaffId == shift.StaffId && x.Status == "approved" && x.StartDate <= shift.ShiftDate && x.EndDate >= shift.ShiftDate, ct))
                throw new AppException(400, "MSG04: Nhân viên có nghỉ phép đã duyệt trong ngày trực. Cần đối chiếu lại.");
            if (await db.OnCallShifts.AnyAsync(x => x.ShiftId != shift.ShiftId && x.StaffId == shift.StaffId && x.ShiftDate == shift.ShiftDate
                && x.Status == "confirmed" && (x.ShiftCategory == shift.ShiftCategory || (x.ShiftStart < shift.ShiftEnd && x.ShiftEnd > shift.ShiftStart)), ct))
                throw new AppException(400, "MSG04: Đã có hồ sơ trực được xác nhận trùng ca hoặc thời gian cho nhân viên trong ngày này.");
            shift.Status = "confirmed";
            shift.ConfirmedBy = AttendanceAccess.Actor(user);
            shift.ConfirmedAt = access.Now.UtcDateTime;
            shift.RejectedReason = null;
            shift.ReviewNote = string.IsNullOrWhiteSpace(request.Reason) ? null : AttendanceRules.Text(request.Reason, "Ghi chú xác nhận");
            audit.Log("verify_on_call", "OnCallShift", shift.ShiftId, previous, Snapshot(shift));
        } else {
            var reason = AttendanceRules.Text(request.Reason, "Lý do trả về / yêu cầu đối chiếu lại", true);
            shift.Status = decision == "reject" ? "rejected" : "pending";
            shift.ConfirmedBy = null;
            shift.ConfirmedAt = null;
            shift.RejectedReason = reason;
            shift.ReviewNote = "Cần đối chiếu lại: " + reason;
            audit.Log("return_on_call", "OnCallShift", shift.ShiftId, previous, Snapshot(shift));
        }
        await access.RequireOpenMonth(shift.ShiftDate.ToString("yyyy-MM"), ct);
        await db.SaveChangesAsync(ct); await tx.CommitAsync(ct);
        return new {
            id = shift.ShiftId,
            status = shift.Status,
            message = shift.Status == "confirmed"
                ? "MSG03: Đã xác nhận hồ sơ trực. Dữ liệu đủ điều kiện tổng hợp công tháng."
                : "MSG03: Đã trả hồ sơ trực về trạng thái chờ đối chiếu."
        };
    }

    private static object Snapshot(OnCallShift shift) => new { shift.StaffId, shift.DepartmentId, shift.FacilityId,
        shift.ShiftDate, shift.ShiftCategory, shift.ShiftStart, shift.ShiftEnd, shift.Status, shift.Note, shift.DeviationReason,
        shift.SupervisorEvidence, shift.ReviewNote, shift.AttendanceEvidenceId, shift.ScheduleAssignmentId, shift.ConfirmedBy, shift.ConfirmedAt };
}
