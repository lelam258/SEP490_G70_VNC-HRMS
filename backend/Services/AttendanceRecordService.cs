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

public sealed class AttendanceRecordService(
    AppDbContext db,
    AttendanceAccess access,
    AttendanceImportService imports,
    IAuditLogHelper? audit = null)
{
    public async Task<object> Options(ClaimsPrincipal user, CancellationToken ct)
    {
        var scope = await access.StaffScope(user, ct, user.IsInRole("accountant"));
        var staff = await scope.OrderBy(x => x.FullName).Select(x => new {
            id = x.StaffId, code = x.StaffCode, name = x.FullName,
            x.DepartmentId, x.Status, x.DateJoined, x.DateLeft, x.DeviceEnrollId
        }).ToArrayAsync(ct);
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
        return new {
            total, page, pageSize, month, lockedReason = await access.LockReason(month!, ct),
            counts = new {
                confirmed = await query.CountAsync(x => x.ValidationStatus == "confirmed", ct),
                flagged = await query.CountAsync(x => x.ValidationStatus == "flagged", ct),
                reconciled = await query.CountAsync(x => x.ValidationStatus == "reconciled", ct),
                pending = await query.CountAsync(x => x.ValidationStatus == "pending" || x.ValidationStatus == "imported", ct),
                unconfirmed = await query.CountAsync(x => x.ValidationStatus != "confirmed", ct)
            },
            items = await Items(query.OrderByDescending(x => x.WorkDate).ThenBy(x => x.AttendanceId).Skip((page - 1) * pageSize).Take(pageSize)).ToArrayAsync(ct)
        };
    }

    public async Task<object> Detail(ClaimsPrincipal user, Guid id, CancellationToken ct)
    {
        var scoped = (await Scope(user, ct)).Where(x => x.AttendanceId == id);
        var record = await scoped.SingleOrDefaultAsync(ct);
        if (record is null) {
            if (await db.AttendanceRecords.AnyAsync(x => x.AttendanceId == id, ct)) throw new AppException(403, "MSG38: Bạn không có quyền xem bản ghi này.");
            throw new AppException(404, "Không tìm thấy bản ghi chấm công.");
        }
        var item = await Items(scoped).SingleAsync(ct);
        var batch = record.ImportId.HasValue ? await db.AttendanceImports.AsNoTracking().Where(x => x.ImportId == record.ImportId)
            .Select(x => new { id = x.ImportId, x.FileName, x.ImportDate, x.DeviceSource }).SingleOrDefaultAsync(ct) : null;
        var importRowEntity = await db.AttendanceImportRows.AsNoTracking()
            .Where(x => x.AttendanceId == record.AttendanceId
                || (record.ImportId.HasValue && x.ImportId == record.ImportId && x.StaffId == record.StaffId && x.WorkDate == record.WorkDate && x.ShiftType == record.ShiftType))
            .OrderByDescending(x => x.AttendanceId == record.AttendanceId)
            .FirstOrDefaultAsync(ct);
        var actorIds = new[] { record.ConfirmedBy, record.ReconciledBy }.Where(x => x.HasValue).Select(x => x!.Value).ToArray();
        var actors = await db.Users.AsNoTracking().Where(x => actorIds.Contains(x.UserId)).Select(x => new { id = x.UserId, name = x.FullName ?? x.Username }).ToArrayAsync(ct);
        var facilities = await db.ScheduleFacilities.AsNoTracking().ToDictionaryAsync(x => x.Id, x => x.Name, ct);
        var plans = (await imports.PublishedPlans(record.WorkDate, record.WorkDate, ct)).Where(x => x.StaffId == record.StaffId).ToArray();
        var planIds = plans.Select(x => x.Id).ToArray();
        var liveAssignments = await db.ScheduleAssignments.AsNoTracking().Where(x => planIds.Contains(x.Id)).ToDictionaryAsync(x => x.Id, ct);
        var scheduleDetails = plans.Select(x => {
            liveAssignments.TryGetValue(x.Id, out var live);
            var hrs = ScheduleRules.Hours(x.Date, x.Shift);
            return new {
                x.Id, x.FacilityId, facilityName = facilities.GetValueOrDefault(x.FacilityId), x.Date, x.Shift,
                start = hrs.Start.ToString("HH:mm"), end = hrs.End.ToString("HH:mm"),
                patientConfirmed = live?.PatientConfirmed ?? false,
                patientEvidence = live?.PatientEvidence,
                actualEndAt = live?.ActualEndAt,
                endNote = live?.EndNote
            };
        }).ToArray();

        var leaves = await db.LeaveRequests.AsNoTracking()
            .Where(x => x.StaffId == record.StaffId && x.Status == "approved" && x.StartDate <= record.WorkDate && x.EndDate >= record.WorkDate)
            .Select(x => new { id = x.RequestId, x.LeaveType, x.StartDate, x.EndDate, x.TotalDays, x.Reason, x.Status })
            .ToArrayAsync(ct);

        var onCalls = await db.OnCallShifts.AsNoTracking()
            .Where(x => x.StaffId == record.StaffId && x.ShiftDate == record.WorkDate && x.Status != "cancelled" && x.Status != "rejected")
            .Select(x => new {
                id = x.ShiftId, x.FacilityId, x.ShiftDate, category = x.ShiftCategory, start = x.ShiftStart, end = x.ShiftEnd,
                x.Status, x.Note, x.DeviationReason, x.SupervisorEvidence, x.ReviewNote, x.ConfirmedBy, x.ConfirmedAt
            })
            .ToArrayAsync(ct);

        var pairs = ParsePairs(record);
        var machinePairs = importRowEntity is not null
            ? (JsonSerializer.Deserialize<AttendanceTimePair[]>(importRowEntity.TimePairsJson) ?? [])
            : (record.Source is "machine" or "fingerprint" ? pairs : []);

        var (discrepancies, suggestedClassification, supervisorConfirmed, supervisorEvidence) = InspectDiscrepancies(
            record, pairs, machinePairs, importRowEntity, plans, liveAssignments, leaves.Length > 0, onCalls.Select(x => (x.category, x.SupervisorEvidence, x.Status)).ToArray());

        var version = ComputeRecordVersion(record, plans, liveAssignments.Values, leaves.Select(x => x.id), onCalls.Select(x => (x.id, x.Status, x.SupervisorEvidence)));

        var events = await db.AuditLogs.AsNoTracking().Where(x => x.EntityId == id).OrderByDescending(x => x.CreatedAt)
            .Select(x => new { x.LogId, x.Action, x.Username, x.CreatedAt, x.Result }).ToArrayAsync(ct);

        var importRow = importRowEntity is null ? null : new {
            importRowEntity.Id, importRowEntity.SheetName, importRowEntity.RowNumber, importRowEntity.DeviceEnrollId,
            importRowEntity.RawDate, rawValues = JsonSerializer.Deserialize<string[]>(importRowEntity.RawValuesJson) ?? [],
            pairs = machinePairs, importRowEntity.ActualHours, importRowEntity.ReportedHours,
            importRowEntity.LateMinutes, importRowEntity.EarlyMinutes, importRowEntity.AttendanceSymbol,
            importRowEntity.ValidationStatus, importRowEntity.ErrorCode, importRowEntity.ValidationNote,
            importRowEntity.CorrectionReason
        };

        return new {
            item, pairs, machinePairs, record.DeviceEnrollId, batch, importRow,
            record.Note, record.ReconcileNote, record.ReconciledAt, record.ReconciledBy,
            record.ConfirmedAt, record.ConfirmedBy, actors, record.CreatedAt, record.PayslipId,
            lockedReason = await access.LockReason(record.WorkDate.ToString("yyyy-MM"), ct),
            schedules = plans.Select(x => new { x.Id, x.FacilityId, x.Date, x.Shift }),
            scheduleDetails, leaves,
            onCalls = onCalls.Select(x => new {
                x.id, x.FacilityId, facilityName = x.FacilityId.HasValue ? facilities.GetValueOrDefault(x.FacilityId.Value) : null,
                date = x.ShiftDate, x.category, x.start, x.end, x.Status, x.Note, x.DeviationReason, x.SupervisorEvidence, x.ReviewNote, x.ConfirmedBy, x.ConfirmedAt
            }),
            discrepancies, suggestedClassification, supervisorConfirmed, supervisorEvidence,
            version, events
        };
    }

    // 4.12 Manual Attendance Context (Step 2)
    public async Task<object> ManualContext(ClaimsPrincipal user, Guid staffId, Guid facilityId, DateOnly date, CancellationToken ct)
    {
        RequireHrStaffWithMsg38(user);
        var facilities = await db.ScheduleFacilities.AsNoTracking().ToDictionaryAsync(x => x.Id, x => x.Name, ct);
        var plans = (await imports.PublishedPlans(date, date, ct)).Where(x => x.StaffId == staffId).ToArray();
        var leaves = await db.LeaveRequests.AsNoTracking()
            .Where(x => x.StaffId == staffId && x.Status == "approved" && x.StartDate <= date && x.EndDate >= date)
            .Select(x => new { id = x.RequestId, x.LeaveType, x.StartDate, x.EndDate, x.Reason })
            .ToArrayAsync(ct);
        var existingRecords = await db.AttendanceRecords.AsNoTracking()
            .Where(x => x.StaffId == staffId && x.WorkDate == date)
            .Select(x => new {
                id = x.AttendanceId, x.ShiftType, x.FacilityId,
                facilityName = x.FacilityId.HasValue ? facilities.GetValueOrDefault(x.FacilityId.Value) : null,
                x.CheckIn, x.CheckOut, x.ActualHours, x.Source, status = x.ValidationStatus
            })
            .ToArrayAsync(ct);
        var onCalls = await db.OnCallShifts.AsNoTracking()
            .Where(x => x.StaffId == staffId && x.ShiftDate == date && x.Status != "cancelled" && x.Status != "rejected")
            .Select(x => new { id = x.ShiftId, category = x.ShiftCategory, start = x.ShiftStart, end = x.ShiftEnd, x.Status, x.SupervisorEvidence })
            .ToArrayAsync(ct);
        return new {
            staffId, facilityId, date,
            schedules = plans.Select(x => new {
                x.Id, x.FacilityId, facilityName = facilities.GetValueOrDefault(x.FacilityId), x.Shift,
                start = ScheduleRules.Hours(date, x.Shift).Start.ToString("HH:mm"),
                end = ScheduleRules.Hours(date, x.Shift).End.ToString("HH:mm")
            }),
            approvedLeave = leaves.Length > 0,
            leaves,
            existingRecords,
            onCalls,
            lockedReason = await access.LockReason(date.ToString("yyyy-MM"), ct)
        };
    }

    // 4.12 Entry Manual Attendance
    public async Task<object> CreateManual(ClaimsPrincipal user, CreateManualAttendanceRequest request, CancellationToken ct)
    {
        RequireHrStaffWithMsg38(user);
        if (request.StaffId == Guid.Empty || request.FacilityId == Guid.Empty || request.WorkDate == default
            || string.IsNullOrWhiteSpace(request.ShiftType) || request.Pairs is null || request.Pairs.Length == 0
            || string.IsNullOrWhiteSpace(request.Reason))
            throw new AppException(400, "MSG02: Trường thông tin này là bắt buộc (nhân viên, cơ sở, ngày làm việc, ca, giờ vào/ra và lý do).");

        var reason = AttendanceRules.Text(request.Reason, "MSG02: Lý do / bằng chứng nhập thủ công", true);
        var sourceRef = AttendanceRules.Text(request.SourceReference, "Nguồn tham chiếu", false, 200);
        var supervisorEvidence = AttendanceRules.Text(request.SupervisorEvidence, "Xác nhận của quản lý", false, 500);
        var shiftType = request.ShiftType.Trim().ToLowerInvariant();
        if (shiftType is not ("main" or "noon" or "evening"))
            throw new AppException(400, "MSG02: Loại ca không hợp lệ. Vui lòng chọn Ca chính (main), Trực trưa (noon) hoặc Trực tối (evening).");

        await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        await access.RequireOpenMonth(request.WorkDate.ToString("yyyy-MM"), ct);

        if (request.WorkDate > access.Today)
            throw new AppException(400, "MSG04: Không thể nhập chấm công thủ công cho ngày trong tương lai.");

        // A5: Employee is inactive or mapping is missing (MSG25)
        var staff = await db.Staff.AsNoTracking().SingleOrDefaultAsync(x => x.StaffId == request.StaffId, ct);
        if (staff is null || staff.Status != "active" || !staff.DepartmentId.HasValue
            || !await db.Departments.AsNoTracking().AnyAsync(x => x.DepartmentId == staff.DepartmentId && x.Status == "active", ct)
            || request.WorkDate < staff.DateJoined || (staff.DateLeft.HasValue && request.WorkDate > staff.DateLeft.Value))
            throw new AppException(400, "MSG25: Nhân viên hoặc khoa/phòng đã chọn không tồn tại, đã ngừng hoạt động hoặc ngoài thời gian công tác.");

        if (!await db.ScheduleFacilities.AsNoTracking().AnyAsync(x => x.Id == request.FacilityId && x.Status == "active", ct))
            throw new AppException(400, "MSG25: Cơ sở làm việc không tồn tại hoặc đã ngừng hoạt động.");

        // A2: Check-out is not after check-in, or the shift overlaps a verified record (MSG04)
        AttendanceTimePair[] pairs;
        decimal actualHours;
        try {
            pairs = AttendanceRules.Pairs(request.WorkDate, request.Pairs);
            actualHours = AttendanceRules.Hours(pairs, request.WorkDate);
        } catch (AppException ex) {
            throw new AppException(400, $"MSG04: Dữ liệu giờ vào/ra không hợp lệ — {ex.Message}");
        }

        var checkIn = pairs.Min(x => x.In)!.Value;
        var checkOut = pairs.Max(x => x.Out)!.Value;
        if (checkOut > access.Now.ToOffset(TimeSpan.FromHours(7)).DateTime)
            throw new AppException(400, "MSG04: Giờ chấm công thực tế chưa diễn ra.");

        if (shiftType is "noon" or "evening") {
            var dutyWindow = ScheduleRules.Hours(request.WorkDate, shiftType);
            if (checkOut.TimeOfDay <= dutyWindow.Start.ToTimeSpan() || checkIn.TimeOfDay >= dutyWindow.End.ToTimeSpan())
                throw new AppException(400, $"MSG04: Giờ vào/ra thực tế không thuộc khung giờ ca {(shiftType == "noon" ? "trực trưa" : "trực tối")}.");
        }

        var sameDayRecords = await db.AttendanceRecords.AsNoTracking()
            .Where(x => x.StaffId == staff.StaffId && x.WorkDate == request.WorkDate)
            .ToArrayAsync(ct);

        if (sameDayRecords.Any(x => x.ShiftType == shiftType))
            throw new AppException(400, "MSG04: Nhân viên đã có bản ghi chấm công cho ngày và ca này. Vui lòng sử dụng luồng Đối chiếu (Reconcile).");

        foreach (var existing in sameDayRecords.Where(x => x.ValidationStatus == "confirmed")) {
            var existingPairs = ParsePairs(existing);
            if (existingPairs.Any(ep => ep.In.HasValue && ep.Out.HasValue && pairs.Any(np => np.In < ep.Out && np.Out > ep.In)))
                throw new AppException(400, "MSG04: Khoảng thời gian nhập thủ công chồng lấn với một bản ghi đã được xác nhận trong ngày.");
        }

        // A3: Approved leave or other schedule conflict -> flags the record for supervisor review (MSG04, GB-05, GB-07)
        var hasApprovedLeave = await db.LeaveRequests.AsNoTracking()
            .AnyAsync(x => x.StaffId == staff.StaffId && x.Status == "approved" && x.StartDate <= request.WorkDate && x.EndDate >= request.WorkDate, ct);
        var plans = (await imports.PublishedPlans(request.WorkDate, request.WorkDate, ct)).Where(x => x.StaffId == staff.StaffId).ToArray();
        var candidateShifts = shiftType == "main" ? new[] { "morning", "afternoon" } : [shiftType];
        var matchingPlans = plans.Where(x => candidateShifts.Contains(x.Shift)).ToArray();

        var conflicts = new List<string>();
        if (hasApprovedLeave)
            conflicts.Add("Trùng ngày nghỉ phép đã được duyệt");
        if (plans.Length == 0)
            conflicts.Add("Chưa có lịch phân công đã công bố trong ngày");
        else if (matchingPlans.Length == 0)
            conflicts.Add("Ca nhập thủ công không có trong lịch phân công đã công bố");
        else if (matchingPlans.All(x => x.FacilityId != request.FacilityId))
            conflicts.Add("Cơ sở nhập thủ công khác với cơ sở trên lịch phân công");

        if (shiftType == "evening") {
            var plannedEveningEnd = ScheduleRules.Hours(request.WorkDate, "evening").End.ToTimeSpan();
            if (checkOut.TimeOfDay < plannedEveningEnd && string.IsNullOrWhiteSpace(supervisorEvidence))
                conflicts.Add("Ca tối kết thúc sớm chưa có xác nhận của quản lý trực (GB-13)");
        }

        var validationStatus = conflicts.Count > 0 ? "flagged" : "pending";
        var noteParts = new List<string>();
        if (!string.IsNullOrWhiteSpace(sourceRef)) noteParts.Add($"Nguồn: {sourceRef}");
        if (conflicts.Count > 0) noteParts.Add("MSG04: " + string.Join("; ", conflicts) + ". Cần đối chiếu và xác nhận của quản lý.");
        var reconcileText = reason
            + (!string.IsNullOrWhiteSpace(sourceRef) ? $" [Tham chiếu: {sourceRef}]" : "")
            + (!string.IsNullOrWhiteSpace(supervisorEvidence) ? $" [Xác nhận quản lý: {supervisorEvidence}]" : "");

        var actor = AttendanceAccess.Actor(user);
        var now = access.Now.UtcDateTime;
        var record = new AttendanceRecord {
            AttendanceId = Guid.NewGuid(),
            StaffId = staff.StaffId,
            StaffCode = staff.StaffCode,
            DepartmentId = staff.DepartmentId,
            FacilityId = request.FacilityId,
            DeviceEnrollId = staff.DeviceEnrollId,
            WorkDate = request.WorkDate,
            ShiftType = shiftType,
            CheckIn = checkIn,
            CheckOut = checkOut,
            TimePairsJson = JsonSerializer.Serialize(pairs),
            ActualHours = actualHours,
            Source = "manual",
            ValidationStatus = validationStatus,
            Note = noteParts.Count > 0 ? string.Join(" · ", noteParts) : "Nhập chấm công thủ công từ bảng công giấy.",
            ReconciledBy = actor,
            ReconciledAt = now,
            ReconcileNote = reconcileText,
            CreatedAt = now
        };

        db.AttendanceRecords.Add(record);
        WriteAudit(user, "create_manual_attendance", "AttendanceRecord", record.AttendanceId, null, new {
            record.StaffId, record.DepartmentId, record.FacilityId, record.WorkDate, record.ShiftType,
            status = record.ValidationStatus, record.Source, record.ActualHours, sourceReference = sourceRef,
            reason, supervisorEvidence, pairs
        });

        await access.RequireOpenMonth(request.WorkDate.ToString("yyyy-MM"), ct);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        return new {
            id = record.AttendanceId,
            status = record.ValidationStatus,
            flagged = validationStatus == "flagged",
            conflicts,
            message = validationStatus == "flagged"
                ? "MSG03 / MSG04: Đã lưu bản ghi thủ công nhưng gắn cờ Cần đối chiếu (Flagged) do có xung đột lịch/nghỉ phép."
                : "MSG03: Đã lưu bản ghi chấm công thủ công chờ xác nhận."
        };
    }

    // 4.11 Reconcile Attendance
    public async Task<object> Reconcile(ClaimsPrincipal user, Guid id, ReconcileAttendanceRequest request, CancellationToken ct)
    {
        RequireHrStaffWithMsg38(user);
        if (string.IsNullOrWhiteSpace(request.Reason))
            throw new AppException(400, "MSG02: Vui lòng nhập lý do và căn cứ đối chiếu chấm công.");

        var action = request.Action?.Trim().ToLowerInvariant();
        if (action is not ("accept_machine" or "accept_manual" or "correct_time" or "mark_unresolved"))
            throw new AppException(400, "MSG02: Chọn phương án đối chiếu hợp lệ (Accept Machine, Accept Manual, Correct Time hoặc Mark Unresolved).");

        var reason = AttendanceRules.Text(request.Reason, "MSG02: Lý do đối chiếu", true);
        var supervisorText = AttendanceRules.Text(request.SupervisorEvidence, "Căn cứ xác nhận quản lý", false, 500);

        await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        var record = await db.AttendanceRecords.SingleOrDefaultAsync(x => x.AttendanceId == id, ct)
            ?? throw new AppException(404, "Không tìm thấy bản ghi chấm công.");

        // A4: Period is already locked (MSG11)
        await access.RequireOpenMonth(record.WorkDate.ToString("yyyy-MM"), ct);
        if (record.ValidationStatus == "confirmed")
            throw new AppException(400, "MSG11: Bản ghi chấm công đã được xác nhận khóa; cần trả về trước khi đối chiếu lại.");

        // A3: New conflicting evidence appears during editing -> requests a refreshed record (MSG44)
        var plans = (await imports.PublishedPlans(record.WorkDate, record.WorkDate, ct)).Where(x => x.StaffId == record.StaffId).ToArray();
        var planIds = plans.Select(x => x.Id).ToArray();
        var liveAssignments = await db.ScheduleAssignments.AsNoTracking().Where(x => planIds.Contains(x.Id)).ToDictionaryAsync(x => x.Id, ct);
        var leaves = await db.LeaveRequests.AsNoTracking()
            .Where(x => x.StaffId == record.StaffId && x.Status == "approved" && x.StartDate <= record.WorkDate && x.EndDate >= record.WorkDate)
            .Select(x => x.RequestId).ToArrayAsync(ct);
        var onCalls = await db.OnCallShifts.AsNoTracking()
            .Where(x => x.StaffId == record.StaffId && x.ShiftDate == record.WorkDate && x.Status != "cancelled" && x.Status != "rejected")
            .Select(x => new { x.ShiftId, x.Status, x.SupervisorEvidence }).ToArrayAsync(ct);

        var currentVersion = ComputeRecordVersion(record, plans, liveAssignments.Values, leaves, onCalls.Select(x => (x.ShiftId, x.Status, x.SupervisorEvidence)));
        if (string.IsNullOrWhiteSpace(request.Version) || !string.Equals(currentVersion, request.Version, StringComparison.Ordinal))
            throw new AppException(409, "MSG44: Phân công lịch hoặc bằng chứng liên quan đã thay đổi. Vui lòng tải lại bản ghi trước khi chỉnh sửa.");

        var previousSnapshot = RecordSnapshot(record);
        var actor = AttendanceAccess.Actor(user);
        var now = access.Now.UtcDateTime;

        if (request.FacilityId.HasValue && request.FacilityId != record.FacilityId) {
            if (!await db.ScheduleFacilities.AsNoTracking().AnyAsync(x => x.Id == request.FacilityId && x.Status == "active", ct))
                throw new AppException(400, "MSG25: Cơ sở được chọn không tồn tại hoặc đã ngừng hoạt động.");
            record.FacilityId = request.FacilityId;
        }

        // A1: Original and manual times cannot be reconciled -> Record remains Flagged and is excluded from payroll (MSG04, MSG05)
        if (action == "mark_unresolved") {
            record.ValidationStatus = "flagged";
            record.ReconciledBy = actor;
            record.ReconciledAt = now;
            record.ReconcileNote = $"[Chưa giải quyết] {reason}";
            record.ConfirmedBy = null;
            record.ConfirmedAt = null;
            WriteAudit(user, "reconcile_attendance", "AttendanceRecord", record.AttendanceId, previousSnapshot, RecordSnapshot(record, action));
            await access.RequireOpenMonth(record.WorkDate.ToString("yyyy-MM"), ct);
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
            return new {
                id = record.AttendanceId,
                status = record.ValidationStatus,
                message = "MSG04 / MSG05: Dữ liệu chưa thể đối chiếu thống nhất. Bản ghi được giữ ở trạng thái Cần đối chiếu (Flagged) và loại khỏi tính lương."
            };
        }

        var importRowEntity = await db.AttendanceImportRows.AsNoTracking()
            .Where(x => x.AttendanceId == record.AttendanceId
                || (record.ImportId.HasValue && x.ImportId == record.ImportId && x.StaffId == record.StaffId && x.WorkDate == record.WorkDate && x.ShiftType == record.ShiftType))
            .OrderByDescending(x => x.AttendanceId == record.AttendanceId)
            .FirstOrDefaultAsync(ct);

        AttendanceTimePair[] resolvedPairs;
        if (action == "accept_machine") {
            var rawMachinePairs = importRowEntity is not null
                ? (JsonSerializer.Deserialize<AttendanceTimePair[]>(importRowEntity.TimePairsJson) ?? [])
                : ParsePairs(record);
            var distinctMachinePairs = rawMachinePairs.Distinct().ToArray();
            if (distinctMachinePairs.Length == 0 || distinctMachinePairs.Any(x => x.In is null || x.Out is null))
                throw new AppException(400, "MSG04: Dữ liệu máy chấm công đang thiếu giờ Vào/Ra; không thể chấp nhận nguyên trạng. Hãy chọn Chỉnh sửa giờ hoặc Chấp nhận thủ công kèm bằng chứng.");
            try { AttendanceRules.Hours(distinctMachinePairs, record.WorkDate); }
            catch (AppException ex) { throw new AppException(400, $"MSG04: Dữ liệu giờ máy không hợp lệ — {ex.Message}"); }
            resolvedPairs = distinctMachinePairs;
        } else {
            if (request.Pairs is { Length: > 0 }) {
                try { resolvedPairs = AttendanceRules.Pairs(record.WorkDate, request.Pairs); }
                catch (AppException ex) { throw new AppException(400, $"MSG04: Cặp giờ điều chỉnh không hợp lệ — {ex.Message}"); }
            } else {
                resolvedPairs = ParsePairs(record).Distinct().ToArray();
                if (resolvedPairs.Length == 0 || resolvedPairs.Any(x => x.In is null || x.Out is null))
                    throw new AppException(400, "MSG02 / MSG04: Vui lòng nhập đầy đủ cặp giờ Vào/Ra hợp lệ để đối chiếu.");
                try { AttendanceRules.Hours(resolvedPairs, record.WorkDate); }
                catch (AppException ex) { throw new AppException(400, $"MSG04: Cặp giờ hiện tại không hợp lệ — {ex.Message}"); }
            }
        }

        var actualHours = AttendanceRules.Hours(resolvedPairs, record.WorkDate);
        var checkIn = resolvedPairs.Min(x => x.In)!.Value;
        var checkOut = resolvedPairs.Max(x => x.Out)!.Value;
        if (checkOut > access.Now.ToOffset(TimeSpan.FromHours(7)).DateTime)
            throw new AppException(400, "MSG04: Giờ kết thúc không được nằm ở tương lai.");

        // Validate no overlap with another confirmed record on the same day
        var otherConfirmed = await db.AttendanceRecords.AsNoTracking()
            .Where(x => x.AttendanceId != record.AttendanceId && x.StaffId == record.StaffId && x.WorkDate == record.WorkDate && x.ValidationStatus == "confirmed")
            .ToArrayAsync(ct);
        foreach (var other in otherConfirmed) {
            if (other.ShiftType == record.ShiftType)
                throw new AppException(400, "MSG04: Nhân viên đã có bản ghi được xác nhận cho cùng ca làm việc trong ngày này.");
            var otherPairs = ParsePairs(other);
            if (otherPairs.Any(op => op.In.HasValue && op.Out.HasValue && resolvedPairs.Any(rp => rp.In < op.Out && rp.Out > op.In)))
                throw new AppException(400, "MSG04: Giờ đối chiếu chồng lấn với một bản ghi chấm công đã xác nhận khác trong ngày.");
        }

        // A2 (GB-13): Early-finished evening shift requires supervisor confirmation (MSG04)
        var isEveningShift = record.ShiftType == "evening"
            || (plans.Any(x => x.Shift == "evening") && checkOut.TimeOfDay > new TimeSpan(17, 0, 0) && checkOut.TimeOfDay < new TimeSpan(19, 0, 0));
        if (record.ShiftType == "evening") {
            var plannedEveningEnd = ScheduleRules.Hours(record.WorkDate, "evening").End.ToTimeSpan();
            if (checkOut.TimeOfDay < plannedEveningEnd) {
                var hasSupervisorConfirm = (request.SupervisorConfirmed && !string.IsNullOrWhiteSpace(supervisorText))
                    || !string.IsNullOrWhiteSpace(supervisorText)
                    || liveAssignments.Values.Any(x => x.Shift == "evening" && x.PatientConfirmed)
                    || onCalls.Any(x => !string.IsNullOrWhiteSpace(x.SupervisorEvidence));
                if (!hasSupervisorConfirm)
                    throw new AppException(400, "MSG04: Ca trực tối kết thúc sớm do vắng bệnh nhân bắt buộc phải có xác nhận của trưởng khoa/quản lý trực (GB-13).");
            }
        }

        record.CheckIn = checkIn;
        record.CheckOut = checkOut;
        record.TimePairsJson = JsonSerializer.Serialize(resolvedPairs);
        record.ActualHours = actualHours;
        if (action is "accept_manual" or "correct_time")
            record.Source = "manual";

        var formattedNote = $"[{action}] {reason}";
        if (!string.IsNullOrWhiteSpace(supervisorText))
            formattedNote += $" [Xác nhận quản lý: {supervisorText}]";
        else if (request.SupervisorConfirmed)
            formattedNote += " [Xác nhận quản lý: Đã xác nhận]";

        record.ReconciledBy = actor;
        record.ReconciledAt = now;
        record.ReconcileNote = formattedNote;
        record.ValidationStatus = "reconciled";

        WriteAudit(user, "reconcile_attendance", "AttendanceRecord", record.AttendanceId, previousSnapshot, RecordSnapshot(record, action));
        await access.RequireOpenMonth(record.WorkDate.ToString("yyyy-MM"), ct);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        return new {
            id = record.AttendanceId,
            status = record.ValidationStatus,
            actualHours = record.ActualHours,
            message = "MSG03: Đã đối chiếu chấm công thành công và chuyển sang trạng thái Sẵn sàng xác nhận (Ready for Verification)."
        };
    }

    // 4.13 Verify Attendance Record
    public async Task<object> Verify(ClaimsPrincipal user, Guid id, VerifyAttendanceRequest request, CancellationToken ct)
    {
        // A5: Unauthorized user tries to confirm -> System denies access (MSG38, GB-41)
        RequireHrStaffWithMsg38(user);
        var decision = request.Decision?.Trim().ToLowerInvariant();
        if (decision is not ("confirm" or "return"))
            throw new AppException(400, "MSG02: Chọn quyết định Xác nhận (confirm) hoặc Trả về đối chiếu (return).");

        if (decision == "return" && string.IsNullOrWhiteSpace(request.Reason))
            throw new AppException(400, "MSG02: Vui lòng nhập lý do trả về để đối chiếu lại.");
        var reason = AttendanceRules.Text(request.Reason, "MSG02: Lý do / ghi chú xác nhận", decision == "return");
        var supervisorText = AttendanceRules.Text(request.SupervisorEvidence, "Căn cứ xác nhận quản lý", false, 500);

        await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        var record = await db.AttendanceRecords.SingleOrDefaultAsync(x => x.AttendanceId == id, ct)
            ?? throw new AppException(404, "Không tìm thấy bản ghi chấm công.");

        // A4: Month locked or already finalized (MSG11)
        await access.RequireOpenMonth(record.WorkDate.ToString("yyyy-MM"), ct);

        var plans = (await imports.PublishedPlans(record.WorkDate, record.WorkDate, ct)).Where(x => x.StaffId == record.StaffId).ToArray();
        var planIds = plans.Select(x => x.Id).ToArray();
        var liveAssignments = await db.ScheduleAssignments.AsNoTracking().Where(x => planIds.Contains(x.Id)).ToDictionaryAsync(x => x.Id, ct);
        var leaves = await db.LeaveRequests.AsNoTracking()
            .Where(x => x.StaffId == record.StaffId && x.Status == "approved" && x.StartDate <= record.WorkDate && x.EndDate >= record.WorkDate)
            .Select(x => x.RequestId).ToArrayAsync(ct);
        var onCalls = await db.OnCallShifts.AsNoTracking()
            .Where(x => x.StaffId == record.StaffId && x.ShiftDate == record.WorkDate && x.Status != "cancelled" && x.Status != "rejected")
            .Select(x => new { x.ShiftId, x.Status, x.SupervisorEvidence }).ToArrayAsync(ct);

        var currentVersion = ComputeRecordVersion(record, plans, liveAssignments.Values, leaves, onCalls.Select(x => (x.ShiftId, x.Status, x.SupervisorEvidence)));
        if (string.IsNullOrWhiteSpace(request.Version) || !string.Equals(currentVersion, request.Version, StringComparison.Ordinal))
            throw new AppException(409, "MSG44: Dữ liệu bản ghi hoặc lịch liên quan đã thay đổi. Vui lòng tải lại trước khi xác nhận.");

        var previousSnapshot = RecordSnapshot(record);
        var actor = AttendanceAccess.Actor(user);
        var now = access.Now.UtcDateTime;

        if (decision == "return") {
            record.ValidationStatus = "flagged";
            record.ConfirmedBy = null;
            record.ConfirmedAt = null;
            record.ReconcileNote = string.IsNullOrWhiteSpace(record.ReconcileNote)
                ? $"[Trả về đối chiếu] {reason}"
                : $"{record.ReconcileNote} | [Trả về đối chiếu] {reason}";
            WriteAudit(user, "return_attendance_record", "AttendanceRecord", record.AttendanceId, previousSnapshot, RecordSnapshot(record, "return"));
            await access.RequireOpenMonth(record.WorkDate.ToString("yyyy-MM"), ct);
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
            return new {
                id = record.AttendanceId,
                status = record.ValidationStatus,
                message = "MSG03: Đã trả bản ghi về trạng thái Cần đối chiếu (Flagged) kèm lý do."
            };
        }

        // Confirm branch
        if (record.ValidationStatus == "confirmed")
            throw new AppException(409, "Bản ghi chấm công này đã được xác nhận trước đó.");

        // A1: Record still mismatched or incomplete -> refuses confirmation until reconciliation (MSG04, MSG05)
        if (record.ValidationStatus == "flagged")
            throw new AppException(400, "MSG04 / MSG05: Bản ghi đang ở trạng thái Cần đối chiếu (Flagged). Vui lòng thực hiện Đối chiếu (Reconcile) giải quyết sai lệch trước khi xác nhận.");

        if (!record.FacilityId.HasValue || string.IsNullOrWhiteSpace(record.ShiftType))
            throw new AppException(400, "MSG04 / MSG05: Bản ghi thiếu thông tin cơ sở hoặc loại ca làm việc. Cần đối chiếu trước khi xác nhận.");

        var pairs = ParsePairs(record);
        if (pairs.Length == 0 || pairs.Any(x => x.In is null || x.Out is null))
            throw new AppException(400, "MSG04 / MSG05: Bản ghi thiếu giờ Vào/Ra đầy đủ. Vui lòng đối chiếu trước khi xác nhận.");

        try { record.ActualHours = AttendanceRules.Hours(pairs, record.WorkDate); }
        catch (AppException ex) { throw new AppException(400, $"MSG04: Cặp giờ Vào/Ra không hợp lệ — {ex.Message}"); }

        if (leaves.Length > 0 && record.ReconciledAt is null)
            throw new AppException(400, "MSG04: Nhân viên có đơn nghỉ phép đã duyệt trong ngày này. Vui lòng thực hiện Đối chiếu (Reconcile) trước khi xác nhận.");

        // A2: Confirming duplicates another staff / date / shift record (MSG04)
        var duplicateConfirmed = await db.AttendanceRecords.AsNoTracking()
            .Where(x => x.AttendanceId != record.AttendanceId && x.StaffId == record.StaffId && x.WorkDate == record.WorkDate && x.ValidationStatus == "confirmed")
            .ToArrayAsync(ct);
        if (duplicateConfirmed.Any(x => x.ShiftType == record.ShiftType))
            throw new AppException(400, "MSG04: Đã có bản ghi chấm công được xác nhận cho cùng nhân viên, ngày và ca làm việc. Vui lòng đối chiếu bản ghi trùng.");
        foreach (var dup in duplicateConfirmed) {
            var dupPairs = ParsePairs(dup);
            if (dupPairs.Any(dp => dp.In.HasValue && dp.Out.HasValue && pairs.Any(p => p.In < dp.Out && p.Out > dp.In)))
                throw new AppException(400, "MSG04: Giờ chấm công trùng lặp với một bản ghi đã xác nhận khác của nhân viên trong ngày.");
        }

        // A3: On-call / evening early-end approval is missing -> requires supervisor confirmation (MSG04, GB-13)
        var checkOut = pairs.Max(x => x.Out)!.Value;
        if (record.ShiftType == "evening") {
            var plannedEveningEnd = ScheduleRules.Hours(record.WorkDate, "evening").End.ToTimeSpan();
            if (checkOut.TimeOfDay < plannedEveningEnd) {
                var hasSupervisorConfirm = !string.IsNullOrWhiteSpace(supervisorText)
                    || (record.ReconcileNote != null && record.ReconcileNote.Contains("Xác nhận quản lý", StringComparison.OrdinalIgnoreCase))
                    || liveAssignments.Values.Any(x => x.Shift == "evening" && x.PatientConfirmed)
                    || onCalls.Any(x => !string.IsNullOrWhiteSpace(x.SupervisorEvidence));
                if (!hasSupervisorConfirm)
                    throw new AppException(400, "MSG04: Ca trực tối kết thúc sớm thiếu xác nhận của quản lý trực (GB-13). Vui lòng bổ sung xác nhận quản lý trước khi xác nhận.");
            }
        }

        if (!string.IsNullOrWhiteSpace(supervisorText)) {
            record.ReconcileNote = string.IsNullOrWhiteSpace(record.ReconcileNote)
                ? $"[Xác nhận quản lý: {supervisorText}]"
                : $"{record.ReconcileNote} [Xác nhận quản lý: {supervisorText}]";
        }
        if (!string.IsNullOrWhiteSpace(reason)) {
            record.ReconcileNote = string.IsNullOrWhiteSpace(record.ReconcileNote)
                ? reason
                : $"{record.ReconcileNote} | [Ghi chú xác nhận: {reason}]";
        }

        record.ValidationStatus = "confirmed";
        record.ConfirmedBy = actor;
        record.ConfirmedAt = now;

        // GB-12, GB-14: Synchronize linked pending OnCallShift if linked to this attendance evidence
        var linkedDuties = await db.OnCallShifts
            .Where(x => (x.ShiftId == record.OnCallShiftId || x.AttendanceEvidenceId == record.AttendanceId)
                && x.StaffId == record.StaffId && x.ShiftDate == record.WorkDate && x.Status == "pending")
            .ToArrayAsync(ct);
        foreach (var duty in linkedDuties) {
            if (duty.ShiftCategory == record.ShiftType && duty.ShiftStart.HasValue && duty.ShiftEnd.HasValue) {
                var dutyPlanned = ScheduleRules.Hours(duty.ShiftDate, duty.ShiftCategory);
                var earlyDuty = duty.ShiftCategory == "evening" && duty.ShiftEnd.Value.TimeOfDay < dutyPlanned.End.ToTimeSpan();
                if (!earlyDuty || !string.IsNullOrWhiteSpace(duty.SupervisorEvidence) || !string.IsNullOrWhiteSpace(supervisorText)) {
                    if (string.IsNullOrWhiteSpace(duty.SupervisorEvidence) && !string.IsNullOrWhiteSpace(supervisorText))
                        duty.SupervisorEvidence = supervisorText;
                    duty.Status = "confirmed";
                    duty.ConfirmedBy = actor;
                    duty.ConfirmedAt = now;
                    duty.ReviewNote = null;
                }
            }
        }

        WriteAudit(user, "verify_attendance_record", "AttendanceRecord", record.AttendanceId, previousSnapshot, RecordSnapshot(record, "confirm"));
        await access.RequireOpenMonth(record.WorkDate.ToString("yyyy-MM"), ct);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        return new {
            id = record.AttendanceId,
            status = record.ValidationStatus,
            confirmedAt = record.ConfirmedAt,
            message = "MSG03: Đã xác nhận bản ghi chấm công thành công. Dữ liệu đã khóa chỉnh sửa thông thường và đủ điều kiện tổng hợp công tháng."
        };
    }

    // 4.14 Confirm Monthly Attendance — Read Consolidation Summary
    public async Task<object> MonthlySummary(ClaimsPrincipal user, string? month, Guid? departmentId, Guid? facilityId, CancellationToken ct)
    {
        if (!new[] { "admin", "hr_manager", "hr_staff", "department_head", "accountant" }.Any(user.IsInRole))
            throw new AppException(403, "MSG38: Bạn không có quyền truy cập chức năng tổng hợp chấm công tháng.");

        var normalizedMonth = string.IsNullOrWhiteSpace(month) ? access.Today.ToString("yyyy-MM") : month.Trim();
        var (start, end) = AttendanceRules.Month(normalizedMonth);

        Guid? scopedDept = departmentId;
        if (user.IsInRole("department_head")) {
            scopedDept = await access.Department(user, ct);
            if (!scopedDept.HasValue) throw new AppException(403, "MSG38: Tài khoản trưởng khoa chưa được gán khoa/phòng.");
        }

        var snapshot = await BuildMonthlyConsolidation(normalizedMonth, start, end, scopedDept, facilityId, ct);
        return snapshot;
    }

    // 4.14 Confirm Monthly Attendance — Lock Monthly Timesheet
    public async Task<object> LockMonthly(ClaimsPrincipal user, string month, LockMonthlyAttendanceRequest request, CancellationToken ct)
    {
        RequireHrStaffWithMsg38(user);
        var normalizedMonth = month?.Trim() ?? "";
        var (start, end) = AttendanceRules.Month(normalizedMonth);
        var note = AttendanceRules.Text(request?.Note, "Ghi chú chốt bảng chấm công tháng", false, 1000);

        await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);

        // A3 & A4: Check if month is already locked or outside consolidation / authorized correction window (MSG11, GB-52, GB-26, GB-59)
        await access.RequireConsolidationWindow(normalizedMonth, ct);

        var fullSummary = await BuildMonthlyConsolidation(normalizedMonth, start, end, null, null, ct);
        if (!string.IsNullOrWhiteSpace(request?.Version) && !string.Equals(fullSummary.Version, request.Version, StringComparison.Ordinal))
            throw new AppException(409, "MSG44: Dữ liệu tổng hợp chấm công tháng đã thay đổi. Vui lòng tải lại bảng tổng hợp trước khi khóa.");

        // A1: Unverified or mismatched attendance remains -> refuses lock (MSG04, MSG05)
        if (fullSummary.Totals.FlaggedRecords > 0 || fullSummary.Totals.UnconfirmedRecords > 0 || fullSummary.Totals.PendingOnCalls > 0) {
            var affectedNames = fullSummary.Exceptions
                .Where(x => x.Category is "flagged_record" or "unconfirmed_record" or "pending_on_call")
                .Select(x => $"{x.StaffCode} ({x.StaffName})")
                .Distinct()
                .Take(8)
                .ToArray();
            throw new AppException(400, $"MSG04 / MSG05: Còn {fullSummary.Totals.FlaggedRecords} bản ghi sai lệch (Flagged), {fullSummary.Totals.UnconfirmedRecords} bản ghi chưa xác nhận và {fullSummary.Totals.PendingOnCalls} ca trực chờ duyệt. Nhân viên bị ảnh hưởng: {string.Join(", ", affectedNames)}.");
        }

        // A2: A required department / site has not completed validation -> shows missing scope and keeps month Draft (MSG05)
        if (fullSummary.Totals.UnaccountedScheduledShifts > 0 || fullSummary.IncompleteScopes.Length > 0) {
            var scopes = fullSummary.IncompleteScopes.Take(6).ToArray();
            throw new AppException(400, $"MSG05: Chưa hoàn tất đối chiếu và xác nhận toàn bộ phạm. Các khoa/cơ sở còn thiếu: {string.Join(", ", scopes)}.");
        }

        var actor = AttendanceAccess.Actor(user);
        var now = access.Now.UtcDateTime;
        var timesheet = await db.MonthlyTimesheets.SingleOrDefaultAsync(x => x.PayMonth == normalizedMonth, ct);
        object? previousSnapshot = null;

        if (timesheet is null) {
            timesheet = new MonthlyTimesheet {
                TimesheetId = Guid.NewGuid(),
                PayMonth = normalizedMonth,
                CreatedAt = now
            };
            db.MonthlyTimesheets.Add(timesheet);
        } else {
            // GB-26: Preserve prior finalized snapshot in audit trail when relocking an authorized correction period
            var previousLockAudit = await db.AuditLogs.AsNoTracking()
                .Where(x => x.EntityType == "MonthlyTimesheet" && x.EntityId == timesheet.TimesheetId && x.Action == "lock_monthly_timesheet")
                .OrderByDescending(x => x.CreatedAt)
                .Select(x => x.NewValue)
                .FirstOrDefaultAsync(ct);
            previousSnapshot = new {
                timesheet.TimesheetId,
                timesheet.PayMonth,
                timesheet.Status,
                timesheet.LockedBy,
                timesheet.LockedAt,
                priorFinalizedSnapshot = previousLockAudit
            };
        }

        timesheet.Status = "locked";
        timesheet.LockedBy = actor;
        timesheet.LockedAt = now;
        timesheet.UpdatedAt = now;

        var finalizedPayload = new {
            timesheet.TimesheetId,
            payMonth = normalizedMonth,
            status = "locked",
            lockedBy = actor,
            lockedAt = now,
            note,
            totals = fullSummary.Totals,
            facilityTotals = fullSummary.FacilityTotals,
            departmentTotals = fullSummary.DepartmentTotals,
            staffCount = fullSummary.StaffSummaries.Length,
            staffSummaries = fullSummary.StaffSummaries.Select(s => new {
                s.StaffId, s.StaffCode, s.StaffName, s.DepartmentId, s.ConfirmedMainDays,
                s.ConfirmedNoonDuties, s.ConfirmedEveningDuties, s.ConfirmedHours, s.OvertimeHours,
                s.PaidLeaveDays, s.UnpaidLeaveDays
            }).ToArray()
        };

        WriteAudit(user, "lock_monthly_timesheet", "MonthlyTimesheet", timesheet.TimesheetId, previousSnapshot, finalizedPayload);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        return new {
            id = timesheet.TimesheetId,
            payMonth = normalizedMonth,
            status = timesheet.Status,
            lockedBy = timesheet.LockedBy,
            lockedAt = timesheet.LockedAt,
            message = "MSG03: Đã tổng hợp và khóa bảng chấm công tháng thành công. Bản chụp dữ liệu đã sẵn sàng cho phân hệ Tính lương."
        };
    }

    private sealed record MonthlyExceptionItem(
        string Id, string Category, string Severity, Guid StaffId, string StaffCode, string StaffName,
        Guid? DepartmentId, string? DepartmentName, Guid? FacilityId, string? FacilityName,
        DateOnly Date, string ShiftType, string Message, string? TargetUrl);

    private sealed record StaffMonthlySummaryItem(
        Guid StaffId, string StaffCode, string StaffName, Guid? DepartmentId, string? DepartmentName,
        int PlannedMainDays, int ConfirmedMainDays, int ConfirmedNoonDuties, int ConfirmedEveningDuties,
        decimal ConfirmedHours, decimal OvertimeHours, decimal PaidLeaveDays, decimal UnpaidLeaveDays,
        int MachineRecordCount, int ManualRecordCount, int FlaggedCount, int UnconfirmedCount,
        int MissingPunchCount, int UnaccountedScheduleCount, bool ReadyForPayroll);

    private sealed record ScopeTotalItem(
        Guid Id, string Name, int StaffCount, int ConfirmedMainDays, int ConfirmedNoonDuties,
        int ConfirmedEveningDuties, decimal ConfirmedHours, decimal PaidLeaveDays,
        int FlaggedCount, int UnconfirmedCount, int UnaccountedScheduleCount, bool Completed);

    private sealed record MonthlyTotalsSummary(
        int TotalStaff, int ConfirmedMainDays, int ConfirmedNoonDuties, int ConfirmedEveningDuties,
        decimal ConfirmedHours, decimal OvertimeHours, decimal PaidLeaveDays, decimal UnpaidLeaveDays,
        int MachineRecords, int ManualRecords, int ConfirmedRecords, int FlaggedRecords,
        int UnconfirmedRecords, int MissingPunchRecords, int PendingOnCalls, int UnaccountedScheduledShifts);

    private sealed record MonthlyConsolidationResult(
        string PayMonth, string Status, Guid? TimesheetId, Guid? LockedBy, string? LockedByName, DateTime? LockedAt,
        DateOnly ConsolidationOpenDate, DateOnly StandardLockDate, DateOnly CorrectionDeadline,
        string WindowStatus, string? LockedReason, string? ConsolidationLockReason, bool CanLock,
        string Version, MonthlyTotalsSummary Totals, ScopeTotalItem[] FacilityTotals,
        ScopeTotalItem[] DepartmentTotals, StaffMonthlySummaryItem[] StaffSummaries,
        MonthlyExceptionItem[] Exceptions, string[] IncompleteScopes);

    private async Task<MonthlyConsolidationResult> BuildMonthlyConsolidation(
        string month, DateOnly start, DateOnly end, Guid? filterDeptId, Guid? filterFacilityId, CancellationToken ct)
    {
        var timesheet = await db.MonthlyTimesheets.AsNoTracking().SingleOrDefaultAsync(x => x.PayMonth == month, ct);
        string? lockedByName = null;
        if (timesheet?.LockedBy is Guid lockedById) {
            lockedByName = await db.Users.AsNoTracking().Where(x => x.UserId == lockedById).Select(x => x.FullName ?? x.Username).SingleOrDefaultAsync(ct);
        }

        var openDate = PayrollPeriodRules.GetConsolidationOpenDate(start.Year, start.Month);
        var standardLockDate = PayrollPeriodRules.GetStandardLockDate(start.Year, start.Month);
        var correctionDeadline = PayrollPeriodRules.GetCorrectionDeadline(start.Year, start.Month);
        var lockedReason = await access.LockReason(month, ct);
        var consolidationLockReason = await access.ConsolidationLockReason(month, ct);

        var isCurrentlyLocked = lockedReason is not null && timesheet?.Status == "locked";
        var windowStatus = isCurrentlyLocked ? "locked"
            : access.Today < openDate ? "early"
            : consolidationLockReason is not null ? "closed"
            : access.Today > standardLockDate ? "reopened" : "open";

        var departments = await db.Departments.AsNoTracking().Where(x => x.Status == "active").OrderBy(x => x.Name).ToArrayAsync(ct);
        var deptMap = departments.ToDictionary(x => x.DepartmentId, x => x.Name);
        var facilities = await db.ScheduleFacilities.AsNoTracking().Where(x => x.Status == "active").OrderBy(x => x.Name).ToArrayAsync(ct);
        var facilityMap = facilities.ToDictionary(x => x.Id, x => x.Name);

        var activeStaff = await db.Staff.AsNoTracking()
            .Where(x => x.Status == "active" && x.DateJoined <= end && (!x.DateLeft.HasValue || x.DateLeft >= start))
            .OrderBy(x => x.FullName)
            .ToArrayAsync(ct);
        var staffMap = activeStaff.ToDictionary(x => x.StaffId);

        var records = await db.AttendanceRecords.AsNoTracking()
            .Where(x => x.WorkDate >= start && x.WorkDate <= end)
            .ToArrayAsync(ct);

        var onCalls = await db.OnCallShifts.AsNoTracking()
            .Where(x => x.ShiftDate >= start && x.ShiftDate <= end && x.Status != "cancelled" && x.Status != "rejected")
            .ToArrayAsync(ct);

        var leaveTypes = await db.LeaveTypes.AsNoTracking().ToDictionaryAsync(x => x.Code, x => x.IsPaid, StringComparer.OrdinalIgnoreCase, ct);
        var leaves = await db.LeaveRequests.AsNoTracking()
            .Where(x => x.Status == "approved" && x.StartDate <= end && x.EndDate >= start)
            .ToArrayAsync(ct);

        var plans = await imports.PublishedPlans(start, end, ct);

        // Apply optional view filters for staff/records while keeping full awareness
        var filteredStaff = activeStaff
            .Where(x => !filterDeptId.HasValue || x.DepartmentId == filterDeptId)
            .ToArray();

        var recordsByStaff = records
            .Where(x => !filterFacilityId.HasValue || x.FacilityId == filterFacilityId)
            .ToLookup(x => x.StaffId);
        var onCallsByStaff = onCalls
            .Where(x => !filterFacilityId.HasValue || x.FacilityId == filterFacilityId)
            .ToLookup(x => x.StaffId);
        var leavesByStaff = leaves.ToLookup(x => x.StaffId);
        var plansByStaff = plans
            .Where(x => !filterFacilityId.HasValue || x.FacilityId == filterFacilityId)
            .ToLookup(x => x.StaffId);

        var exceptions = new List<MonthlyExceptionItem>();
        var staffSummaries = new List<StaffMonthlySummaryItem>();

        foreach (var person in filteredStaff) {
            var deptName = person.DepartmentId.HasValue ? deptMap.GetValueOrDefault(person.DepartmentId.Value) : null;
            var personRecords = recordsByStaff[person.StaffId].ToArray();
            var personDuties = onCallsByStaff[person.StaffId].ToArray();
            var personLeaves = leavesByStaff[person.StaffId].ToArray();
            var personPlans = plansByStaff[person.StaffId].ToArray();

            var leaveDates = new HashSet<DateOnly>();
            decimal paidLeaveDays = 0m;
            decimal unpaidLeaveDays = 0m;
            foreach (var lv in personLeaves) {
                var isPaid = !leaveTypes.TryGetValue(lv.LeaveType, out var paidFlag) || paidFlag;
                var from = lv.StartDate < start ? start : lv.StartDate;
                var to = lv.EndDate > end ? end : lv.EndDate;
                for (var d = from; d <= to; d = d.AddDays(1)) {
                    if (d.DayOfWeek == DayOfWeek.Sunday) continue;
                    if (leaveDates.Add(d)) {
                        if (isPaid) paidLeaveDays += 1m;
                        else unpaidLeaveDays += 1m;
                    }
                }
            }

            // GB-06, GB-09 (Step 4): Multiple IN/OUT pairs on the same day do NOT count as multiple workdays
            var confirmedMainDates = personRecords
                .Where(x => x.ValidationStatus == "confirmed" && (x.ShiftType == "main" || string.IsNullOrEmpty(x.ShiftType)))
                .Select(x => x.WorkDate)
                .Distinct()
                .ToHashSet();

            var confirmedNoonDates = personRecords
                .Where(x => x.ValidationStatus == "confirmed" && x.ShiftType == "noon")
                .Select(x => x.WorkDate)
                .Concat(personDuties.Where(x => x.Status == "confirmed" && x.ShiftCategory == "noon").Select(x => x.ShiftDate))
                .Distinct()
                .ToHashSet();

            var confirmedEveningDates = personRecords
                .Where(x => x.ValidationStatus == "confirmed" && x.ShiftType == "evening")
                .Select(x => x.WorkDate)
                .Concat(personDuties.Where(x => x.Status == "confirmed" && x.ShiftCategory == "evening").Select(x => x.ShiftDate))
                .Distinct()
                .ToHashSet();

            var confirmedRecordIds = personRecords.Where(x => x.ValidationStatus == "confirmed").Select(x => x.AttendanceId).ToHashSet();
            var confirmedRecordHours = personRecords.Where(x => x.ValidationStatus == "confirmed").Sum(x => x.ActualHours ?? 0m);
            var standaloneDutyHours = personDuties
                .Where(x => x.Status == "confirmed" && (!x.AttendanceEvidenceId.HasValue || !confirmedRecordIds.Contains(x.AttendanceEvidenceId.Value)) && x.ShiftStart.HasValue && x.ShiftEnd.HasValue)
                .Sum(x => Math.Round((decimal)(x.ShiftEnd!.Value - x.ShiftStart!.Value).TotalHours, 2, MidpointRounding.AwayFromZero));

            var totalConfirmedHours = Math.Round(confirmedRecordHours + standaloneDutyHours, 2, MidpointRounding.AwayFromZero);
            var overtimeHours = Math.Round(
                personRecords.Where(x => x.ValidationStatus == "confirmed" && x.ShiftType == "main" && (x.ActualHours ?? 0m) > 8m).Sum(x => (x.ActualHours ?? 0m) - 8m)
                + standaloneDutyHours
                + personRecords.Where(x => x.ValidationStatus == "confirmed" && x.ShiftType is "noon" or "evening").Sum(x => x.ActualHours ?? 0m),
                2, MidpointRounding.AwayFromZero);

            var machineCount = personRecords.Count(x => x.Source is "machine" or "fingerprint");
            var manualCount = personRecords.Count(x => x.Source == "manual");
            var flaggedRecords = personRecords.Where(x => x.ValidationStatus == "flagged").ToArray();
            var unconfirmedRecords = personRecords.Where(x => x.ValidationStatus is not ("confirmed" or "flagged")).ToArray();
            var pendingDuties = personDuties.Where(x => x.Status != "confirmed").ToArray();

            var missingPunchCount = personRecords.Count(x => {
                var p = ParsePairs(x);
                return p.Length == 0 || p.Any(pair => pair.In is null || pair.Out is null);
            });

            foreach (var rec in flaggedRecords) {
                var facName = rec.FacilityId.HasValue ? facilityMap.GetValueOrDefault(rec.FacilityId.Value) : null;
                exceptions.Add(new MonthlyExceptionItem(
                    $"rec-{rec.AttendanceId}", "flagged_record", "error", person.StaffId, person.StaffCode, person.FullName,
                    person.DepartmentId, deptName, rec.FacilityId, facName, rec.WorkDate, rec.ShiftType ?? "main",
                    rec.Note ?? "MSG04: Bản ghi đang gắn cờ Cần đối chiếu (Flagged).", $"/attendance/records/{rec.AttendanceId}"));
            }

            foreach (var rec in unconfirmedRecords) {
                var facName = rec.FacilityId.HasValue ? facilityMap.GetValueOrDefault(rec.FacilityId.Value) : null;
                exceptions.Add(new MonthlyExceptionItem(
                    $"rec-{rec.AttendanceId}", "unconfirmed_record", "warning", person.StaffId, person.StaffCode, person.FullName,
                    person.DepartmentId, deptName, rec.FacilityId, facName, rec.WorkDate, rec.ShiftType ?? "main",
                    $"MSG05: Bản ghi ở trạng thái '{rec.ValidationStatus}' chưa được xác nhận (Verify).", $"/attendance/records/{rec.AttendanceId}"));
            }

            foreach (var duty in pendingDuties) {
                var facName = duty.FacilityId.HasValue ? facilityMap.GetValueOrDefault(duty.FacilityId.Value) : null;
                exceptions.Add(new MonthlyExceptionItem(
                    $"duty-{duty.ShiftId}", "pending_on_call", "warning", person.StaffId, person.StaffCode, person.FullName,
                    person.DepartmentId, deptName, duty.FacilityId, facName, duty.ShiftDate, duty.ShiftCategory,
                    duty.ReviewNote ?? "MSG05: Hồ sơ ca trực đang chờ xác nhận.", $"/attendance/on-call/{duty.ShiftId}"));
            }

            var plannedMainDates = personPlans
                .Where(x => x.Shift is "morning" or "afternoon")
                .Select(x => x.Date)
                .Distinct()
                .ToArray();

            var unaccountedSchedules = 0;
            foreach (var planGroup in personPlans.Where(x => x.Date <= access.Today).GroupBy(x => (x.Date, ShiftGroup: x.Shift is "morning" or "afternoon" ? "main" : x.Shift))) {
                var planDate = planGroup.Key.Date;
                var shiftGroup = planGroup.Key.ShiftGroup;
                if (leaveDates.Contains(planDate)) continue;
                var hasAnyRecordOrDuty = shiftGroup == "main"
                    ? personRecords.Any(x => x.WorkDate == planDate && (x.ShiftType == "main" || string.IsNullOrEmpty(x.ShiftType)))
                    : (personRecords.Any(x => x.WorkDate == planDate && x.ShiftType == shiftGroup)
                        || personDuties.Any(x => x.ShiftDate == planDate && x.ShiftCategory == shiftGroup));
                if (!hasAnyRecordOrDuty) {
                    unaccountedSchedules++;
                    var firstPlan = planGroup.First();
                    var facName = facilityMap.GetValueOrDefault(firstPlan.FacilityId);
                    exceptions.Add(new MonthlyExceptionItem(
                        $"plan-{firstPlan.Id}", "unaccounted_schedule", "error", person.StaffId, person.StaffCode, person.FullName,
                        person.DepartmentId, deptName, firstPlan.FacilityId, facName, planDate, shiftGroup,
                        "MSG04 / MSG05: Ca làm việc đã công bố trên lịch nhưng chưa có chấm công hoặc đơn nghỉ phép đối ứng.",
                        $"/attendance/records/new?staffId={person.StaffId}&facilityId={firstPlan.FacilityId}&date={planDate:yyyy-MM-dd}&shift={shiftGroup}"));
                }
            }

            var totalMissingPunches = missingPunchCount + unaccountedSchedules;
            var totalUnconfirmed = unconfirmedRecords.Length + pendingDuties.Length;
            var ready = flaggedRecords.Length == 0 && totalUnconfirmed == 0 && unaccountedSchedules == 0;

            staffSummaries.Add(new StaffMonthlySummaryItem(
                person.StaffId, person.StaffCode, person.FullName, person.DepartmentId, deptName,
                plannedMainDates.Length, confirmedMainDates.Count, confirmedNoonDates.Count, confirmedEveningDates.Count,
                totalConfirmedHours, overtimeHours, paidLeaveDays, unpaidLeaveDays,
                machineCount, manualCount, flaggedRecords.Length, totalUnconfirmed,
                totalMissingPunches, unaccountedSchedules, ready));
        }

        // Also check records belonging to staff not in filteredStaff (if any) when unfiltered
        var facilityTotals = facilities
            .Where(f => !filterFacilityId.HasValue || f.Id == filterFacilityId)
            .Select(f => {
                var facRecords = records.Where(r => r.FacilityId == f.Id && (!filterDeptId.HasValue || r.DepartmentId == filterDeptId)).ToArray();
                var facDuties = onCalls.Where(d => d.FacilityId == f.Id && (!filterDeptId.HasValue || d.DepartmentId == filterDeptId)).ToArray();
                var facPlans = plans.Where(p => p.FacilityId == f.Id && p.Date <= access.Today
                    && (!filterDeptId.HasValue || (staffMap.TryGetValue(p.StaffId, out var st) && st.DepartmentId == filterDeptId))).ToArray();
                var facStaffIds = facRecords.Select(r => r.StaffId).Concat(facDuties.Select(d => d.StaffId)).Concat(facPlans.Select(p => p.StaffId)).Distinct().ToArray();
                var mainDays = facRecords.Where(r => r.ValidationStatus == "confirmed" && r.ShiftType == "main").Select(r => (r.StaffId, r.WorkDate)).Distinct().Count();
                var noonDuties = facRecords.Where(r => r.ValidationStatus == "confirmed" && r.ShiftType == "noon").Select(r => (r.StaffId, r.WorkDate))
                    .Concat(facDuties.Where(d => d.Status == "confirmed" && d.ShiftCategory == "noon").Select(d => (d.StaffId, d.ShiftDate))).Distinct().Count();
                var eveningDuties = facRecords.Where(r => r.ValidationStatus == "confirmed" && r.ShiftType == "evening").Select(r => (r.StaffId, r.WorkDate))
                    .Concat(facDuties.Where(d => d.Status == "confirmed" && d.ShiftCategory == "evening").Select(d => (d.StaffId, d.ShiftDate))).Distinct().Count();
                var hours = Math.Round(facRecords.Where(r => r.ValidationStatus == "confirmed").Sum(r => r.ActualHours ?? 0m), 2, MidpointRounding.AwayFromZero);
                var flagged = facRecords.Count(r => r.ValidationStatus == "flagged");
                var unconfirmed = facRecords.Count(r => r.ValidationStatus is not ("confirmed" or "flagged")) + facDuties.Count(d => d.Status != "confirmed");
                var unaccounted = exceptions.Count(e => e.Category == "unaccounted_schedule" && e.FacilityId == f.Id);
                return new ScopeTotalItem(f.Id, f.Name, facStaffIds.Length, mainDays, noonDuties, eveningDuties, hours, 0m,
                    flagged, unconfirmed, unaccounted, flagged == 0 && unconfirmed == 0 && unaccounted == 0);
            }).ToArray();

        var departmentTotals = departments
            .Where(d => !filterDeptId.HasValue || d.DepartmentId == filterDeptId)
            .Select(d => {
                var deptStaff = staffSummaries.Where(s => s.DepartmentId == d.DepartmentId).ToArray();
                var flagged = deptStaff.Sum(s => s.FlaggedCount);
                var unconfirmed = deptStaff.Sum(s => s.UnconfirmedCount);
                var unaccounted = deptStaff.Sum(s => s.UnaccountedScheduleCount);
                return new ScopeTotalItem(
                    d.DepartmentId, d.Name, deptStaff.Length,
                    deptStaff.Sum(s => s.ConfirmedMainDays),
                    deptStaff.Sum(s => s.ConfirmedNoonDuties),
                    deptStaff.Sum(s => s.ConfirmedEveningDuties),
                    Math.Round(deptStaff.Sum(s => s.ConfirmedHours), 2, MidpointRounding.AwayFromZero),
                    deptStaff.Sum(s => s.PaidLeaveDays),
                    flagged, unconfirmed, unaccounted,
                    flagged == 0 && unconfirmed == 0 && unaccounted == 0);
            }).ToArray();

        var incompleteScopes = departmentTotals.Where(d => !d.Completed).Select(d => d.Name)
            .Concat(facilityTotals.Where(f => !f.Completed).Select(f => f.Name))
            .Distinct()
            .ToArray();

        var totals = new MonthlyTotalsSummary(
            TotalStaff: staffSummaries.Count,
            ConfirmedMainDays: staffSummaries.Sum(x => x.ConfirmedMainDays),
            ConfirmedNoonDuties: staffSummaries.Sum(x => x.ConfirmedNoonDuties),
            ConfirmedEveningDuties: staffSummaries.Sum(x => x.ConfirmedEveningDuties),
            ConfirmedHours: Math.Round(staffSummaries.Sum(x => x.ConfirmedHours), 2, MidpointRounding.AwayFromZero),
            OvertimeHours: Math.Round(staffSummaries.Sum(x => x.OvertimeHours), 2, MidpointRounding.AwayFromZero),
            PaidLeaveDays: staffSummaries.Sum(x => x.PaidLeaveDays),
            UnpaidLeaveDays: staffSummaries.Sum(x => x.UnpaidLeaveDays),
            MachineRecords: staffSummaries.Sum(x => x.MachineRecordCount),
            ManualRecords: staffSummaries.Sum(x => x.ManualRecordCount),
            ConfirmedRecords: records.Count(x => x.ValidationStatus == "confirmed" && (!filterDeptId.HasValue || x.DepartmentId == filterDeptId) && (!filterFacilityId.HasValue || x.FacilityId == filterFacilityId)),
            FlaggedRecords: staffSummaries.Sum(x => x.FlaggedCount),
            UnconfirmedRecords: records.Count(x => x.ValidationStatus is not ("confirmed" or "flagged") && (!filterDeptId.HasValue || x.DepartmentId == filterDeptId) && (!filterFacilityId.HasValue || x.FacilityId == filterFacilityId)),
            MissingPunchRecords: staffSummaries.Sum(x => x.MissingPunchCount),
            PendingOnCalls: onCalls.Count(x => x.Status != "confirmed" && (!filterDeptId.HasValue || x.DepartmentId == filterDeptId) && (!filterFacilityId.HasValue || x.FacilityId == filterFacilityId)),
            UnaccountedScheduledShifts: staffSummaries.Sum(x => x.UnaccountedScheduleCount)
        );

        var version = AttendanceRules.Version(new {
            month,
            timesheetStatus = timesheet?.Status ?? "draft",
            timesheetLockedAt = timesheet?.LockedAt,
            totals,
            exceptionIds = exceptions.Select(x => x.Id).OrderBy(x => x).ToArray()
        });

        var canLock = consolidationLockReason is null
            && !isCurrentlyLocked
            && exceptions.Count == 0
            && incompleteScopes.Length == 0;

        return new MonthlyConsolidationResult(
            PayMonth: month,
            Status: isCurrentlyLocked ? "locked" : (timesheet?.Status == "locked" ? "reopened" : (timesheet?.Status ?? "draft")),
            TimesheetId: timesheet?.TimesheetId,
            LockedBy: timesheet?.LockedBy,
            LockedByName: lockedByName,
            LockedAt: timesheet?.LockedAt,
            ConsolidationOpenDate: openDate,
            StandardLockDate: standardLockDate,
            CorrectionDeadline: correctionDeadline,
            WindowStatus: windowStatus,
            LockedReason: lockedReason,
            ConsolidationLockReason: consolidationLockReason,
            CanLock: canLock,
            Version: version,
            Totals: totals,
            FacilityTotals: facilityTotals,
            DepartmentTotals: departmentTotals,
            StaffSummaries: staffSummaries.ToArray(),
            Exceptions: exceptions.OrderBy(x => x.Date).ThenBy(x => x.StaffCode).ToArray(),
            IncompleteScopes: incompleteScopes
        );
    }

    private static void RequireHrStaffWithMsg38(ClaimsPrincipal user)
    {
        if (!user.IsInRole("hr_staff"))
            throw new AppException(403, "MSG38: Bạn không có quyền truy cập chức năng hoặc thực hiện nghiệp vụ chấm công này.");
    }

    private static AttendanceTimePair[] ParsePairs(AttendanceRecord record)
        => record.TimePairsJson is null
            ? (record.CheckIn.HasValue || record.CheckOut.HasValue ? [new AttendanceTimePair(record.CheckIn, record.CheckOut)] : [])
            : (JsonSerializer.Deserialize<AttendanceTimePair[]>(record.TimePairsJson) ?? []);

    private static (object[] Discrepancies, string SuggestedClassification, bool SupervisorConfirmed, string? SupervisorEvidence) InspectDiscrepancies(
        AttendanceRecord record,
        AttendanceTimePair[] pairs,
        AttendanceTimePair[] machinePairs,
        AttendanceImportRow? importRow,
        (Guid Id, Guid StaffId, Guid FacilityId, DateOnly Date, string Shift)[] plans,
        IReadOnlyDictionary<Guid, ScheduleAssignment> liveAssignments,
        bool hasApprovedLeave,
        (string Category, string? SupervisorEvidence, string? Status)[] onCalls)
    {
        var list = new List<(string Code, string Label, string Severity)>();

        string? supervisorEvidence = onCalls.Select(x => x.SupervisorEvidence).FirstOrDefault(x => !string.IsNullOrWhiteSpace(x))
            ?? liveAssignments.Values.Select(x => x.PatientEvidence).FirstOrDefault(x => !string.IsNullOrWhiteSpace(x));
        if (supervisorEvidence is null && record.ReconcileNote is not null) {
            var marker = "[Xác nhận quản lý:";
            var idx = record.ReconcileNote.IndexOf(marker, StringComparison.OrdinalIgnoreCase);
            if (idx >= 0) {
                var endIdx = record.ReconcileNote.IndexOf(']', idx);
                supervisorEvidence = endIdx > idx
                    ? record.ReconcileNote[(idx + marker.Length)..endIdx].Trim()
                    : record.ReconcileNote[(idx + marker.Length)..].Trim();
            }
        }
        var supervisorConfirmed = !string.IsNullOrWhiteSpace(supervisorEvidence)
            || liveAssignments.Values.Any(x => x.PatientConfirmed);

        if (pairs.Length == 0 || pairs.Any(x => x.In is null || x.Out is null)) {
            list.Add(("missing_punch", "Thiếu lượt chấm công Vào hoặc Ra.", "error"));
        }
        if (hasApprovedLeave) {
            list.Add(("leave_conflict", "Ngày làm việc trùng với đơn nghỉ phép đã được duyệt.", "error"));
        }
        if (importRow?.ErrorCode == "repeated_time_pairs" || (machinePairs.Length > 1 && machinePairs.Distinct().Count() != machinePairs.Length)) {
            list.Add(("duplicate_shift", "Máy chấm công xuất lặp cặp giờ Vào/Ra giống nhau (chỉ tính thời lượng 1 lần).", "warning"));
        }
        if (importRow?.ReportedHours is decimal rep && record.ActualHours is decimal act && Math.Abs(rep - act) > 0.05m) {
            list.Add(("source_mismatch", $"Tổng giờ máy báo ({rep:0.##}h) khác thời lượng thực tế ({act:0.##}h).", "warning"));
        }

        var candidateShifts = (record.ShiftType ?? "main") == "main" ? new[] { "morning", "afternoon" } : [record.ShiftType!];
        var matchingPlans = plans.Where(x => candidateShifts.Contains(x.Shift)).ToArray();
        if (plans.Length == 0) {
            list.Add(("source_mismatch", "Chưa có lịch phân công đã công bố cho nhân viên trong ngày này.", "warning"));
        } else if (matchingPlans.Length == 0) {
            list.Add(("source_mismatch", "Loại ca chấm công chưa khớp với ca làm việc đã công bố trên lịch.", "warning"));
        } else if (record.FacilityId.HasValue && matchingPlans.All(x => x.FacilityId != record.FacilityId)) {
            list.Add(("source_mismatch", "Cơ sở ghi nhận chấm công khác với cơ sở phân công trên lịch.", "error"));
        }

        var checkOut = pairs.Where(x => x.Out.HasValue).Select(x => x.Out!.Value).DefaultIfEmpty().Max();
        if (record.ShiftType == "evening" && checkOut != default) {
            var plannedEveningEnd = ScheduleRules.Hours(record.WorkDate, "evening").End.ToTimeSpan();
            if (checkOut.TimeOfDay < plannedEveningEnd) {
                if (!supervisorConfirmed)
                    list.Add(("early_evening_unconfirmed", "Ca tối kết thúc sớm trước 19:00 nhưng chưa có xác nhận của quản lý trực (GB-13).", "error"));
                else
                    list.Add(("late_early", "Ca tối kết thúc sớm (đã có xác nhận của quản lý trực).", "info"));
            }
        }

        if ((importRow?.LateMinutes ?? 0m) > 0m || (importRow?.EarlyMinutes ?? 0m) > 0m) {
            list.Add(("late_early", $"Ghi nhận đi muộn {importRow?.LateMinutes ?? 0m:0} phút / về sớm {importRow?.EarlyMinutes ?? 0m:0} phút.", "warning"));
        }

        var suggested = list.FirstOrDefault().Code ?? "matched";
        return (
            list.Select(x => (object)new { code = x.Code, label = x.Label, severity = x.Severity }).ToArray(),
            suggested,
            supervisorConfirmed,
            supervisorEvidence
        );
    }

    private static string ComputeRecordVersion(
        AttendanceRecord record,
        IEnumerable<(Guid Id, Guid StaffId, Guid FacilityId, DateOnly Date, string Shift)> plans,
        IEnumerable<ScheduleAssignment> liveAssignments,
        IEnumerable<Guid> leaveIds,
        IEnumerable<(Guid ShiftId, string? Status, string? SupervisorEvidence)> onCalls)
        => AttendanceRules.Version(new {
            record.AttendanceId,
            record.StaffId,
            record.FacilityId,
            record.WorkDate,
            record.ShiftType,
            record.CheckIn,
            record.CheckOut,
            record.ActualHours,
            record.Source,
            record.ValidationStatus,
            record.TimePairsJson,
            record.ReconciledBy,
            record.ReconciledAt,
            record.ReconcileNote,
            record.ConfirmedBy,
            record.ConfirmedAt,
            plans = plans.OrderBy(x => x.Id).Select(x => new { x.Id, x.FacilityId, x.Date, x.Shift }),
            live = liveAssignments.OrderBy(x => x.Id).Select(x => new { x.Id, x.Cancelled, x.PatientConfirmed, x.PatientEvidence, x.ActualEndAt }),
            leaves = leaveIds.OrderBy(x => x),
            onCalls = onCalls.OrderBy(x => x.ShiftId).Select(x => new { x.ShiftId, x.Status, x.SupervisorEvidence })
        });

    private static object RecordSnapshot(AttendanceRecord record, string? action = null) => new {
        record.AttendanceId,
        record.StaffId,
        record.DepartmentId,
        record.FacilityId,
        record.WorkDate,
        record.ShiftType,
        record.CheckIn,
        record.CheckOut,
        record.ActualHours,
        record.Source,
        status = record.ValidationStatus,
        record.Note,
        record.ReconcileNote,
        record.ReconciledBy,
        record.ReconciledAt,
        record.ConfirmedBy,
        record.ConfirmedAt,
        action,
        pairs = ParsePairs(record)
    };

    private void WriteAudit(ClaimsPrincipal user, string action, string entityType, Guid entityId, object? oldValue, object? newValue)
    {
        if (audit is not null) {
            audit.Log(action, entityType, entityId, oldValue, newValue);
            return;
        }
        var actorId = Guid.TryParse(user.FindFirstValue("sub"), out var parsed) ? parsed : (Guid?)null;
        var username = user.FindFirstValue("name") ?? user.Identity?.Name ?? actorId?.ToString();
        db.AuditLogs.Add(new AuditLog {
            LogId = Guid.NewGuid(),
            UserId = actorId,
            Username = username,
            Action = action,
            Module = entityType == "MonthlyTimesheet" ? "payroll" : "attendance",
            EntityType = entityType,
            EntityId = entityId,
            OldValue = oldValue is null ? null : JsonSerializer.Serialize(oldValue),
            NewValue = newValue is null ? null : JsonSerializer.Serialize(newValue),
            CreatedAt = access.Now.UtcDateTime
        });
    }
}
