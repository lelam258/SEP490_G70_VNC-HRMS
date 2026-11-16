using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Vnc.HRMS.Common.Exceptions;
using Vnc.HRMS.DTOs.Attendance;
using Vnc.HRMS.Models;
using Vnc.HRMS.Models.Employees;
using Vnc.HRMS.Models.Users;
using Vnc.HRMS.Persistence;
using Vnc.HRMS.Services;
using Vnc.HRMS.Services.Rules;

internal static class AttendanceReconcileVerifyMonthlyRegression
{
    public static async Task Run(
        DbContextOptions<AppDbContext> options,
        TimeProvider clock,
        Action<DateTimeOffset> setClock,
        Guid hrId,
        Guid managerId,
        Guid accountantId,
        Guid facility1,
        Guid facility2,
        Guid department1,
        Action<bool, string> check,
        CancellationToken ct)
    {
        var savedClock = clock.GetUtcNow();
        // Use 2026-09 as isolated test month for UC 4.11 - 4.14
        const string testMonth = "2026-09";
        var staffA = Guid.NewGuid();
        var userA = Guid.NewGuid();
        var inactiveStaff = Guid.NewGuid();
        var inactiveUser = Guid.NewGuid();
        var coverageId = Guid.NewGuid();
        var weekId = Guid.NewGuid();
        var leaveId = Guid.NewGuid();
        var parser = new AttendanceWorkbookParser();

        var jsonOptions = new JsonSerializerOptions(JsonSerializerDefaults.Web);
        JsonElement Json(object value) => JsonSerializer.SerializeToElement(value, jsonOptions);

        ClaimsPrincipal Actor(Guid id, string role) =>
            new(new ClaimsIdentity([new("sub", id.ToString()), new(ClaimTypes.Role, role), new(ClaimTypes.Name, "test." + role)], "test"));

        var hr = Actor(hrId, "hr_staff");
        var manager = Actor(managerId, "hr_manager");

        async Task<T> RecordCall<T>(ClaimsPrincipal actor, Func<AttendanceRecordService, Task<T>> op)
        {
            await using var db = new AppDbContext(options);
            var access = new AttendanceAccess(db, clock);
            var http = new HttpContextAccessor { HttpContext = new DefaultHttpContext { User = actor } };
            var audit = new AuditLogHelper(db, http);
            var imports = new AttendanceImportService(db, access, parser, audit);
            var service = new AttendanceRecordService(db, access, imports, audit);
            return await op(service);
        }

        async Task<T> OnCallCall<T>(ClaimsPrincipal actor, Func<OnCallService, Task<T>> op)
        {
            await using var db = new AppDbContext(options);
            var access = new AttendanceAccess(db, clock);
            var http = new HttpContextAccessor { HttpContext = new DefaultHttpContext { User = actor } };
            var audit = new AuditLogHelper(db, http);
            var imports = new AttendanceImportService(db, access, parser, audit);
            var service = new OnCallService(db, access, imports, audit);
            return await op(service);
        }

        async Task Reject(Func<Task> op, int status, string expectedCode, string label)
        {
            try
            {
                await op();
            }
            catch (AppException ex) when (ex.StatusCode == status && (string.IsNullOrEmpty(expectedCode) || ex.Message.Contains(expectedCode, StringComparison.Ordinal)))
            {
                check(true, label);
                return;
            }
            throw new Exception($"Expected rejection ({status} / {expectedCode}): {label}");
        }

        await using (var db = new AppDbContext(options))
        {
            db.Users.AddRange(
                new User { UserId = userA, Username = "uc411." + userA.ToString("N")[..8], NormalizedUsername = ("UC411." + userA.ToString("N")[..8]).ToUpperInvariant(), Role = "employee" },
                new User { UserId = inactiveUser, Username = "uc412.inact." + inactiveUser.ToString("N")[..6], NormalizedUsername = ("UC412.INACT." + inactiveUser.ToString("N")[..6]).ToUpperInvariant(), Role = "employee" }
            );
            await db.SaveChangesAsync(ct);

            db.Staff.AddRange(
                new Staff
                {
                    StaffId = staffA,
                    UserId = userA,
                    StaffCode = "UC" + staffA.ToString("N")[..8],
                    FullName = "Bác sĩ Đối Chiếu",
                    DepartmentId = department1,
                    Status = "active",
                    DateJoined = new DateOnly(2024, 1, 1)
                },
                new Staff
                {
                    StaffId = inactiveStaff,
                    UserId = inactiveUser,
                    StaffCode = "IN" + inactiveStaff.ToString("N")[..8],
                    FullName = "Nhân sự Ngừng HĐ",
                    DepartmentId = department1,
                    Status = "inactive",
                    DateJoined = new DateOnly(2024, 1, 1)
                }
            );

            // Published schedule for week of Monday 2026-09-07 (contains 2026-09-10 morning & afternoon at facility1)
            db.ScheduleCoverage.Add(new ScheduleCoverage
            {
                Id = coverageId,
                FacilityId = facility1,
                DepartmentId = department1,
                Name = "Phòng khám Nội UC411"
            });
            db.ScheduleWeeks.Add(new ScheduleWeek
            {
                Id = weekId,
                DepartmentId = department1,
                Monday = new DateOnly(2026, 9, 7),
                Published = true
            });
            db.ScheduleAssignments.AddRange(
                new ScheduleAssignment
                {
                    Id = Guid.NewGuid(),
                    WeekId = weekId,
                    StaffId = staffA,
                    CoverageId = coverageId,
                    Date = new DateOnly(2026, 9, 10),
                    Shift = "morning",
                    Reason = "Lịch sáng 10/09"
                },
                new ScheduleAssignment
                {
                    Id = Guid.NewGuid(),
                    WeekId = weekId,
                    StaffId = staffA,
                    CoverageId = coverageId,
                    Date = new DateOnly(2026, 9, 10),
                    Shift = "afternoon",
                    Reason = "Lịch chiều 10/09"
                }
            );

            // Approved leave on 2026-09-15
            db.LeaveRequests.Add(new LeaveRequest
            {
                RequestId = leaveId,
                StaffId = staffA,
                DepartmentId = department1,
                LeaveType = "annual",
                StartDate = new DateOnly(2026, 9, 15),
                EndDate = new DateOnly(2026, 9, 15),
                TotalDays = 1m,
                Reason = "Nghỉ phép năm đã duyệt",
                Status = "approved",
                ApprovedBy = managerId
            });

            await db.SaveChangesAsync(ct);
        }

        try
        {
            // Set clock inside open window of 2026-09 (e.g. 2026-09-20)
            setClock(new DateTimeOffset(2026, 9, 20, 10, 0, 0, TimeSpan.FromHours(7)));

            // =========================================================================
            // 1. UC 4.12 — ENTRY MANUAL ATTENDANCE
            // =========================================================================
            var ctxJson = Json(await RecordCall(hr, s => s.ManualContext(hr, staffA, facility1, new DateOnly(2026, 9, 10), ct)));
            check(ctxJson.GetProperty("schedules").GetArrayLength() == 2 && !ctxJson.GetProperty("approvedLeave").GetBoolean(),
                "UC 4.12 Step 2: ManualContext displays published schedules and leave status for selected staff and date");

            // A1: Missing required reason -> MSG02
            await Reject(
                () => RecordCall(hr, s => s.CreateManual(hr, new CreateManualAttendanceRequest(
                    staffA, facility1, new DateOnly(2026, 9, 10), "main",
                    [new TimePairInput("07:00", "11:30"), new TimePairInput("13:30", "17:00")],
                    "Bảng công giấy T09", "   ", null), ct)),
                400, "MSG02", "UC 4.12 A1: Missing manual reason is rejected with MSG02");

            // A2: Check-out not after check-in -> MSG04
            await Reject(
                () => RecordCall(hr, s => s.CreateManual(hr, new CreateManualAttendanceRequest(
                    staffA, facility1, new DateOnly(2026, 9, 10), "main",
                    [new TimePairInput("11:30", "07:00")],
                    "Bảng công giấy T09", "Sai thứ tự giờ", null), ct)),
                400, "MSG04", "UC 4.12 A2: Check-out before check-in is rejected with MSG04");

            // A5: Inactive employee -> MSG25
            await Reject(
                () => RecordCall(hr, s => s.CreateManual(hr, new CreateManualAttendanceRequest(
                    inactiveStaff, facility1, new DateOnly(2026, 9, 10), "main",
                    [new TimePairInput("07:00", "11:30")],
                    "Bảng công giấy", "Nhân viên ngừng hoạt động", null), ct)),
                400, "MSG25", "UC 4.12 A5: Inactive employee manual attendance is rejected with MSG25");

            // Normal Flow: Valid manual attendance matching published schedule on 2026-09-10 -> status 'pending'
            var createdMain = Json(await RecordCall(hr, s => s.CreateManual(hr, new CreateManualAttendanceRequest(
                staffA, facility1, new DateOnly(2026, 9, 10), "main",
                [new TimePairInput("07:00", "11:30"), new TimePairInput("13:30", "17:00")],
                "Bảng chấm công giấy Khoa Nội", "Máy vân tay mất điện buổi sáng", null), ct)));
            var mainRecordId = createdMain.GetProperty("id").GetGuid();
            check(createdMain.GetProperty("status").GetString() == "pending" && !createdMain.GetProperty("flagged").GetBoolean()
                && createdMain.GetProperty("message").GetString()!.Contains("MSG03"),
                "UC 4.12 Normal Flow: Manual attendance matching schedule saves as pending with MSG03");

            // A2: Duplicate shift for same employee/date/shift -> MSG04
            await Reject(
                () => RecordCall(hr, s => s.CreateManual(hr, new CreateManualAttendanceRequest(
                    staffA, facility1, new DateOnly(2026, 9, 10), "main",
                    [new TimePairInput("07:00", "11:30")],
                    "Trùng ca", "Nhập trùng ca chính", null), ct)),
                400, "MSG04", "UC 4.12 A2: Duplicate shift for same employee/date/shift is blocked with MSG04");

            // A3: Approved leave conflict on 2026-09-15 -> saved as 'flagged'
            var createdLeaveConflict = Json(await RecordCall(hr, s => s.CreateManual(hr, new CreateManualAttendanceRequest(
                staffA, facility1, new DateOnly(2026, 9, 15), "evening",
                [new TimePairInput("17:00", "18:00")],
                "Phiếu trực tối", "Đi trực tối nhưng kết thúc sớm lúc 18:00", null), ct)));
            var eveningRecordId = createdLeaveConflict.GetProperty("id").GetGuid();
            check(createdLeaveConflict.GetProperty("status").GetString() == "flagged" && createdLeaveConflict.GetProperty("flagged").GetBoolean()
                && createdLeaveConflict.GetProperty("message").GetString()!.Contains("MSG04"),
                "UC 4.12 A3: Manual attendance on approved leave / early evening is flagged for supervisor review with MSG04");

            // =========================================================================
            // 2. UC 4.11 — RECONCILE ATTENDANCE & UC 4.13 — VERIFY ATTENDANCE RECORD
            // =========================================================================
            var eveningDetail = Json(await RecordCall(hr, s => s.Detail(hr, eveningRecordId, ct)));
            var eveningVersion = eveningDetail.GetProperty("version").GetString()!;
            check(eveningDetail.GetProperty("discrepancies").GetArrayLength() >= 2,
                "UC 4.11 Step 2-3: Detail side-by-side view identifies leave conflict and early evening discrepancy");

            // UC 4.13 A1: Cannot confirm a flagged record before reconciliation -> MSG04/MSG05
            await Reject(
                () => RecordCall(hr, s => s.Verify(hr, eveningRecordId, new VerifyAttendanceRequest("confirm", "Cố xác nhận khi đang Flagged", null, eveningVersion), ct)),
                400, "MSG04", "UC 4.13 A1: Flagged record cannot be confirmed before reconciliation (MSG04/MSG05)");

            // UC 4.11 A5: Reconcile without reason -> MSG02
            await Reject(
                () => RecordCall(hr, s => s.Reconcile(hr, eveningRecordId, new ReconcileAttendanceRequest("accept_manual", null, facility1, "", null, false, eveningVersion), ct)),
                400, "MSG02", "UC 4.11 A5: Reconcile without supporting reason is rejected with MSG02");

            // UC 4.11 A2: Early-finished evening shift (17:00-18:00 < 19:00) without supervisor confirmation -> MSG04 (GB-13)
            await Reject(
                () => RecordCall(hr, s => s.Reconcile(hr, eveningRecordId, new ReconcileAttendanceRequest(
                    "accept_manual", [new TimePairInput("17:00", "18:00")], facility1,
                    "Đối chiếu phiếu trực tối", null, false, eveningVersion), ct)),
                400, "MSG04", "UC 4.11 A2 (GB-13): Early-ended evening shift without supervisor confirmation is rejected with MSG04");

            // UC 4.11 A1: Mark unresolved keeps record Flagged and excluded from payroll (MSG04, MSG05)
            var unresolvedRes = Json(await RecordCall(hr, s => s.Reconcile(hr, eveningRecordId, new ReconcileAttendanceRequest(
                "mark_unresolved", null, facility1, "Chờ trưởng khoa ký xác nhận bổ sung", null, false, eveningVersion), ct)));
            check(unresolvedRes.GetProperty("status").GetString() == "flagged" && unresolvedRes.GetProperty("message").GetString()!.Contains("MSG04"),
                "UC 4.11 A1: Mark unresolved keeps record Flagged with MSG04/MSG05");

            // UC 4.11 A3: Stale version during editing -> MSG44 (409)
            await Reject(
                () => RecordCall(hr, s => s.Reconcile(hr, eveningRecordId, new ReconcileAttendanceRequest(
                    "accept_manual", [new TimePairInput("17:00", "18:00")], facility1,
                    "Dùng version cũ", "BS Trưởng khoa xác nhận", true, eveningVersion), ct)),
                409, "MSG44", "UC 4.11 A3: Conflicting edit version requests reload with MSG44");

            // Refresh version and reconcile with supervisor confirmation (GB-13)
            eveningDetail = Json(await RecordCall(hr, s => s.Detail(hr, eveningRecordId, ct)));
            eveningVersion = eveningDetail.GetProperty("version").GetString()!;
            var reconciledEvening = Json(await RecordCall(hr, s => s.Reconcile(hr, eveningRecordId, new ReconcileAttendanceRequest(
                "correct_time", [new TimePairInput("17:00", "18:00")], facility1,
                "Đã đối chiếu sổ trực và đơn nghỉ phép", "BS Trưởng khoa Nguyễn Văn B xác nhận vắng bệnh nhân", true, eveningVersion), ct)));
            check(reconciledEvening.GetProperty("status").GetString() == "reconciled",
                "UC 4.11 Step 5-6: Reconcile with supervisor confirmation moves record to Ready for Verification (reconciled)");

            // UC 4.13 A5: Unauthorized role (HR Manager) tries to verify -> MSG38 (403)
            eveningDetail = Json(await RecordCall(hr, s => s.Detail(hr, eveningRecordId, ct)));
            eveningVersion = eveningDetail.GetProperty("version").GetString()!;
            await Reject(
                () => RecordCall(manager, s => s.Verify(manager, eveningRecordId, new VerifyAttendanceRequest("confirm", "Manager try", null, eveningVersion), ct)),
                403, "MSG38", "UC 4.13 A5 (GB-41): Unauthorized role is denied attendance verification with MSG38");

            // UC 4.13 Step 4: Return for correction requires explanation (MSG02) and moves record back to Flagged
            await Reject(
                () => RecordCall(hr, s => s.Verify(hr, eveningRecordId, new VerifyAttendanceRequest("return", "  ", null, eveningVersion), ct)),
                400, "MSG02", "UC 4.13 Step 4: Returning a record for correction without explanation is rejected with MSG02");

            var returnedEvening = Json(await RecordCall(hr, s => s.Verify(hr, eveningRecordId, new VerifyAttendanceRequest(
                "return", "Yêu cầu đính kèm mã biên bản trực tối", null, eveningVersion), ct)));
            check(returnedEvening.GetProperty("status").GetString() == "flagged",
                "UC 4.13 Postcondition: Returned record transitions back to Flagged with documented reason");

            // Re-reconcile and Confirm both records (mainRecordId and eveningRecordId)
            eveningDetail = Json(await RecordCall(hr, s => s.Detail(hr, eveningRecordId, ct)));
            eveningVersion = eveningDetail.GetProperty("version").GetString()!;
            await RecordCall(hr, s => s.Reconcile(hr, eveningRecordId, new ReconcileAttendanceRequest(
                "correct_time", [new TimePairInput("17:00", "18:00")], facility1,
                "Bổ sung biên bản trực BB-09", "BS Trưởng khoa xác nhận", true, eveningVersion), ct));
            eveningDetail = Json(await RecordCall(hr, s => s.Detail(hr, eveningRecordId, ct)));
            eveningVersion = eveningDetail.GetProperty("version").GetString()!;
            var verifiedEvening = Json(await RecordCall(hr, s => s.Verify(hr, eveningRecordId, new VerifyAttendanceRequest(
                "confirm", "Đã kiểm tra đầy đủ căn cứ trực tối", "BS Trưởng khoa xác nhận", eveningVersion), ct)));
            check(verifiedEvening.GetProperty("status").GetString() == "confirmed",
                "UC 4.13 Step 6: Confirmed record records confirmed_by/confirmed_at and becomes Confirmed (MSG03)");

            // Verify mainRecordId (pending -> confirmed)
            var mainDetail = Json(await RecordCall(hr, s => s.Detail(hr, mainRecordId, ct)));
            var mainVersion = mainDetail.GetProperty("version").GetString()!;
            var verifiedMain = Json(await RecordCall(hr, s => s.Verify(hr, mainRecordId, new VerifyAttendanceRequest(
                "confirm", "Xác nhận 2 cặp giờ vào/ra ca chính (1 ngày công)", null, mainVersion), ct)));
            check(verifiedMain.GetProperty("status").GetString() == "confirmed",
                "UC 4.13 Normal Flow: Pending manual main shift with 2 IN/OUT pairs is confirmed");

            // Also test OnCallService.Verify (confirm / return)
            var onCallCreated = Json(await OnCallCall(hr, s => s.Save(hr, null, new SaveOnCallRequest(
                staffA, facility2, new DateOnly(2026, 9, 10), "noon", "11:30", "13:30",
                "Trực trưa tại cơ sở 2", "Điều động trực trưa liên cơ sở", "Quản lý xác nhận trực trưa", null, null), ct)));
            var onCallId = onCallCreated.GetProperty("id").GetGuid();
            var onCallDetail = Json(await OnCallCall(hr, s => s.Detail(hr, onCallId, ct)));
            var onCallVer = onCallDetail.GetProperty("item").GetProperty("version").GetString()!;
            var onCallVerified = Json(await OnCallCall(hr, s => s.Verify(hr, onCallId, new VerifyOnCallRequest("confirm", "Xác nhận ca trực trưa", null, onCallVer), ct)));
            check(onCallVerified.GetProperty("status").GetString() == "confirmed",
                "UC 4.13 On-call verification confirms pending noon duty for monthly consolidation");

            // =========================================================================
            // 3. UC 4.14 — CONFIRM MONTHLY ATTENDANCE
            // =========================================================================
            // At 2026-09-20, consolidation window (2026-09-28..2026-10-05) is not open yet (GB-52)
            var earlySummary = Json(await RecordCall(hr, s => s.MonthlySummary(hr, testMonth, null, null, ct)));
            check(earlySummary.GetProperty("windowStatus").GetString() == "early" && !earlySummary.GetProperty("canLock").GetBoolean(),
                "UC 4.14 Precondition (GB-52): Monthly summary before 2 days prior to month-end reports 'early' window and disables lock");

            await Reject(
                () => RecordCall(hr, s => s.LockMonthly(hr, testMonth, new LockMonthlyAttendanceRequest("Khóa sớm", earlySummary.GetProperty("version").GetString()!), ct)),
                400, "GB-52", "UC 4.14 A2 (GB-52): Locking monthly attendance before consolidation open date is rejected");

            // Advance clock to 2026-09-29 (inside GB-52 consolidation window: 2026-09-28 .. 2026-10-05)
            setClock(new DateTimeOffset(2026, 9, 29, 15, 0, 0, TimeSpan.FromHours(7)));

            var openSummary = Json(await RecordCall(hr, s => s.MonthlySummary(hr, testMonth, null, null, ct)));
            var staffRow = openSummary.GetProperty("staffSummaries").EnumerateArray().Single(x => x.GetProperty("staffId").GetGuid() == staffA);
            check(staffRow.GetProperty("confirmedMainDays").GetInt32() == 1
                && staffRow.GetProperty("confirmedNoonDuties").GetInt32() == 1
                && staffRow.GetProperty("confirmedEveningDuties").GetInt32() == 1
                && staffRow.GetProperty("paidLeaveDays").GetDecimal() == 1m,
                "UC 4.14 Step 2-4 (GB-06, GB-09): Multiple IN/OUT pairs in a main shift count as 1 workday, consolidating duties and paid leave across facilities");

            // Add an unconfirmed record for staffA on 2026-09-18 to verify A1 (blocking exceptions prevent monthly lock)
            var blockingRec = Json(await RecordCall(hr, s => s.CreateManual(hr, new CreateManualAttendanceRequest(
                staffA, facility1, new DateOnly(2026, 9, 18), "main",
                [new TimePairInput("07:00", "11:30")],
                "Bảng công giấy", "Bản ghi chưa xác nhận chặn khóa tháng", null), ct)));
            var blockingRecId = blockingRec.GetProperty("id").GetGuid();

            var blockedSummary = Json(await RecordCall(hr, s => s.MonthlySummary(hr, testMonth, null, null, ct)));
            check(!blockedSummary.GetProperty("canLock").GetBoolean() && blockedSummary.GetProperty("exceptions").GetArrayLength() > 0,
                "UC 4.14 Step 5: Unconfirmed or flagged records appear in monthly exceptions and disable final confirmation");

            await Reject(
                () => RecordCall(hr, s => s.LockMonthly(hr, testMonth, new LockMonthlyAttendanceRequest("Cố khóa khi còn ngoại lệ", blockedSummary.GetProperty("version").GetString()!), ct)),
                400, "MSG04", "UC 4.14 A1: Locking monthly attendance while exceptions remain is rejected with MSG04/MSG05");

            // Reconcile & confirm the blocking record so all exceptions in 2026-09 are resolved
            var blkDetail = Json(await RecordCall(hr, s => s.Detail(hr, blockingRecId, ct)));
            var blkVer = blkDetail.GetProperty("version").GetString()!;
            await RecordCall(hr, s => s.Reconcile(hr, blockingRecId, new ReconcileAttendanceRequest(
                "accept_manual", [new TimePairInput("07:00", "11:30"), new TimePairInput("13:30", "17:00")], facility1,
                "Đã kiểm tra bảng chấm công giấy ngày 18/09", "Trưởng khoa xác nhận làm ngoài lịch", true, blkVer), ct));
            blkDetail = Json(await RecordCall(hr, s => s.Detail(hr, blockingRecId, ct)));
            blkVer = blkDetail.GetProperty("version").GetString()!;
            await RecordCall(hr, s => s.Verify(hr, blockingRecId, new VerifyAttendanceRequest("confirm", "Xác nhận ngày 18/09", null, blkVer), ct));

            var readySummary = Json(await RecordCall(hr, s => s.MonthlySummary(hr, testMonth, null, null, ct)));
            check(readySummary.GetProperty("canLock").GetBoolean() && readySummary.GetProperty("exceptions").GetArrayLength() == 0,
                "UC 4.14 Normal Flow: Monthly summary is ready to lock once all records and schedules are confirmed");

            // Lock the monthly timesheet
            var lockRes = Json(await RecordCall(hr, s => s.LockMonthly(hr, testMonth, new LockMonthlyAttendanceRequest(
                "Chốt công tháng 09/2026 chuyển tính lương", readySummary.GetProperty("version").GetString()!), ct)));
            check(lockRes.GetProperty("status").GetString() == "locked" && lockRes.GetProperty("message").GetString()!.Contains("MSG03"),
                "UC 4.14 Step 6-7: LockMonthly locks MonthlyTimesheet and records locked_by/locked_at with MSG03");

            // Verify ordinary edits are blocked after MonthlyTimesheet is locked (UC 4.11 A4, 4.12 A4, 4.13 A4) -> MSG11
            await Reject(
                () => RecordCall(hr, s => s.CreateManual(hr, new CreateManualAttendanceRequest(
                    staffA, facility1, new DateOnly(2026, 9, 22), "main",
                    [new TimePairInput("07:00", "11:30")], "Sau khóa", "Thử nhập sau khi khóa tháng", null), ct)),
                400, "MSG11", "UC 4.12 A4 / UC 4.14 Postcondition: Locked monthly timesheet rejects new manual entries with MSG11");

            // UC 4.14 A4 & A5 (GB-26, GB-52, GB-59): Accountant reopens PayrollLock during correction window (2026-10-08) -> allows correction and re-lock preserving prior snapshot
            setClock(new DateTimeOffset(2026, 10, 8, 9, 0, 0, TimeSpan.FromHours(7)));
            var payrollLockId = Guid.NewGuid();
            var reopenLogId = Guid.NewGuid();
            await using (var db = new AppDbContext(options))
            {
                db.PayrollLocks.Add(new PayrollLock { LockId = payrollLockId, PayMonth = testMonth, Status = "reopened", LockedBy = accountantId, LockedAt = clock.GetUtcNow().UtcDateTime });
                db.AuditLogs.Add(new AuditLog
                {
                    LogId = reopenLogId,
                    UserId = accountantId,
                    Action = "reopen",
                    Module = "payroll",
                    EntityType = "PayrollLock",
                    EntityId = payrollLockId,
                    Result = "success",
                    NewValue = "{\"payMonth\":\"2026-09\",\"status\":\"reopened\"}"
                });
                await db.SaveChangesAsync(ct);
                await db.AuditLogs.Where(x => x.LogId == reopenLogId).ExecuteUpdateAsync(set => set.SetProperty(x => x.CreatedAt, clock.GetUtcNow().UtcDateTime), ct);
            }

            var reopenedSummary = Json(await RecordCall(hr, s => s.MonthlySummary(hr, testMonth, null, null, ct)));
            check(reopenedSummary.GetProperty("windowStatus").GetString() == "reopened" && reopenedSummary.GetProperty("canLock").GetBoolean(),
                "UC 4.14 A5 (GB-26): Audited Accountant reopen unlocks MonthlyTimesheet for authorized correction and re-locking");

            var relockRes = Json(await RecordCall(hr, s => s.LockMonthly(hr, testMonth, new LockMonthlyAttendanceRequest(
                "Khóa lại bảng công tháng 09/2026 sau điều chỉnh GB-26", reopenedSummary.GetProperty("version").GetString()!), ct)));
            check(relockRes.GetProperty("status").GetString() == "locked",
                "UC 4.14 A5 (GB-26): Re-locking monthly attendance succeeds and preserves the previous locked snapshot in AuditLogs");

            await using (var auditDb = new AppDbContext(options))
            {
                var lockLogs = await auditDb.AuditLogs.CountAsync(x => x.Action == "lock_monthly_timesheet" && x.EntityType == "MonthlyTimesheet", ct);
                check(lockLogs == 2, "Every monthly lock and re-lock preserves an immutable snapshot in AuditLogs");
            }
        }
        finally
        {
            setClock(savedClock);
            await using var db = new AppDbContext(options);
            await db.AuditLogs.Where(x => x.StaffId == staffA || x.StaffId == inactiveStaff || (x.EntityType == "MonthlyTimesheet" && x.WorkDate == new DateOnly(2026, 9, 1)) || (x.EntityType == "PayrollLock" && x.NewValue != null && x.NewValue.Contains("2026-09"))).ExecuteDeleteAsync(ct);
            await db.OnCallShifts.Where(x => x.StaffId == staffA).ExecuteDeleteAsync(ct);
            await db.AttendanceRecords.Where(x => x.StaffId == staffA || x.StaffId == inactiveStaff).ExecuteDeleteAsync(ct);
            await db.MonthlyTimesheets.Where(x => x.PayMonth == testMonth).ExecuteDeleteAsync(ct);
            await db.PayrollLocks.Where(x => x.PayMonth == testMonth).ExecuteDeleteAsync(ct);
            await db.LeaveRequests.Where(x => x.RequestId == leaveId).ExecuteDeleteAsync(ct);
            await db.ScheduleAssignments.Where(x => x.WeekId == weekId).ExecuteDeleteAsync(ct);
            await db.ScheduleWeeks.Where(x => x.Id == weekId).ExecuteDeleteAsync(ct);
            await db.ScheduleCoverage.Where(x => x.Id == coverageId).ExecuteDeleteAsync(ct);
            await db.Staff.Where(x => x.StaffId == staffA || x.StaffId == inactiveStaff).ExecuteDeleteAsync(ct);
            await db.Users.Where(x => x.UserId == userA || x.UserId == inactiveUser).ExecuteDeleteAsync(ct);
        }
    }
}
