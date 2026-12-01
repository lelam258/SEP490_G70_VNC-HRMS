using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Vnc.HRMS.DTOs.Attendance;
using Vnc.HRMS.Models;
using Vnc.HRMS.Models.Employees;
using Vnc.HRMS.Models.Users;
using Vnc.HRMS.Persistence;
using Vnc.HRMS.Services;
using Vnc.HRMS.Services.Rules;

internal static class OvertimeImportRegression
{
    public static async Task Run(DbContextOptions<AppDbContext> options, TimeProvider clock, Guid hrId,
        Guid departmentId, Guid facilityId, Func<object?[][], byte[]> workbook, Action<bool, string> check, CancellationToken ct)
    {
        // Existing suite clock is 8 November; all source punches below have already happened.
        var date = new DateOnly(2026, 11, 5);
        var staffIds = new List<Guid>(); var userIds = new List<Guid>();
        var coverageId = Guid.NewGuid(); var weekId = Guid.NewGuid();
        var hr = new ClaimsPrincipal(new ClaimsIdentity([new("sub", hrId.ToString()), new(ClaimTypes.Role, "hr_staff")], "test"));
        var json = new JsonSerializerOptions(JsonSerializerDefaults.Web);
        JsonElement AsJson(object value) => JsonSerializer.SerializeToElement(value, json);
        Guid? batchId = null;
        await using var db = new AppDbContext(options);
        var http = new HttpContextAccessor { HttpContext = new DefaultHttpContext { User = hr } };
        var access = new AttendanceAccess(db, clock);
        var imports = new AttendanceImportService(db, access, new AttendanceWorkbookParser(), new AuditLogHelper(db, http));
        var records = new AttendanceRecordService(db, access, imports, new AuditLogHelper(db, http));
        var ends = new[] { "17:00", "17:29", "17:30", "17:59", "18:00", "18:45", "20:00", "18:30" };
        var expected = new[] { 0m, 0m, .5m, .5m, 1m, 1.5m, 2m, 0m };
        try {
            departmentId = Guid.NewGuid();
            db.Departments.Add(new Vnc.HRMS.Models.Organization.Department { DepartmentId = departmentId, DeptCode = "GB12", Name = "GB12 isolated department" });
            db.ScheduleCoverage.Add(new ScheduleCoverage { Id = coverageId, DepartmentId = departmentId, FacilityId = facilityId, Name = "GB12 test scope" });
            db.ScheduleWeeks.Add(new ScheduleWeek { Id = weekId, DepartmentId = departmentId, Monday = new(2026, 11, 2), Published = true });
            var grid = new List<object?[]> { new object?[] { "Employee ID", "Date", "In1", "Out1", "In2", "Out2", "Hours" } };
            for (var i = 0; i < ends.Length; i++) {
                var user = Guid.NewGuid(); var staff = Guid.NewGuid(); userIds.Add(user); staffIds.Add(staff);
                var device = "GB12-" + i;
                db.Users.Add(new User { UserId = user, Username = "gb12-" + user.ToString("N"), NormalizedUsername = "GB12-" + user.ToString("N").ToUpperInvariant(), Role = "employee", IsProvisioned = true });
                db.Staff.Add(new Staff { StaffId = staff, UserId = user, StaffCode = device, DeviceEnrollId = device, FullName = device, DepartmentId = departmentId, DateJoined = new(2020, 1, 1) });
                foreach (var shift in i == 7 ? new[] { "morning", "afternoon", "evening" } : new[] { "morning", "afternoon" })
                    db.ScheduleAssignments.Add(new ScheduleAssignment { Id = Guid.NewGuid(), WeekId = weekId, StaffId = staff, CoverageId = coverageId, Date = date, Shift = shift, Reason = "GB12 fixture" });
                grid.Add([device, "2026-11-05", "07:00", ends[i], "", "", 8]);
            }
            await db.SaveChangesAsync(ct); db.ChangeTracker.Clear();
            var stage = AsJson(await imports.Stage(hr, "gb12.xlsx", workbook(grid.ToArray()), facilityId, "2026-11", "GB12 regression", null, ct));
            batchId = stage.GetProperty("id").GetGuid();
            var preview = AsJson(await imports.Preview(batchId.Value, null, null, 1, 100, ct));
            foreach (var row in preview.GetProperty("items").EnumerateArray()) {
                var i = int.Parse(row.GetProperty("deviceEnrollId").GetString()![5..]);
                check(row.GetProperty("potentialOvertimeHours").GetDecimal() == expected[i]
                    && row.GetProperty("hasNightOnCall").GetBoolean() == (i == 7)
                    && row.GetProperty("pairs").GetArrayLength() == 1 && row.GetProperty("actualHours").GetDecimal() == 8m,
                    $"Single machine IN/OUT pair {ends[i]} excludes lunch and yields {expected[i]} separate OT / night={i == 7}");
            }
            var commit = AsJson(await imports.Commit(hr, batchId.Value, preview.GetProperty("version").GetString()!, false, ct));
            check(commit.GetProperty("created").GetInt32() == 8, "GB-12 import commits valid evidence without confirming overtime");
            var imported = await db.AttendanceRecords.AsNoTracking().Where(r => r.ImportId == batchId).ToArrayAsync(ct);
            check(OvertimeRules.ConfirmedHours(imported, []) == 0m, "GB-12 committed but unverified import has zero payable OT");
            db.ChangeTracker.Clear();
            async Task Rejected(Func<Task> operation, int status, string label) {
                try { await operation(); } catch (Vnc.HRMS.Common.Exceptions.AppException e) when(e.StatusCode == status) { check(true, label); return; }
                throw new Exception("Expected rejection: " + label);
            }
            var outsider = new ClaimsPrincipal(new ClaimsIdentity([new("sub", userIds[0].ToString()), new(ClaimTypes.Role,"employee")], "test"));
            await Rejected(async () => await records.PreviewBulkVerify(outsider, new("2026-11", imported.Select(r=>r.AttendanceId).ToArray()), ct),403,
                "Bulk verification preview denies employees before reading attendance");
            await Rejected(async () => await records.BulkVerify(outsider, new("2026-11",[new(imported[0].AttendanceId,"x")]),ct),403,
                "Bulk verification write denies employees");
            await Rejected(async () => await records.PreviewBulkVerify(hr,new("2026-11",Enumerable.Range(0,1001).Select(_=>Guid.NewGuid()).ToArray()),ct),400,
                "Bulk verification limits selection to 1000 records");
            var review = await records.PreviewBulkVerify(hr,new("2026-11",Filter:new AttendanceFilter {Month="2026-11",DepartmentId=departmentId}),ct);
            check(review.Items.Length==8 && review.Skipped.Length==0,"Bulk review includes every eligible filtered record across pages");
            var changed=await db.AttendanceRecords.SingleAsync(r=>r.AttendanceId==imported[0].AttendanceId,ct);
            changed.ValidationStatus="flagged";
            var stale=await db.AttendanceRecords.SingleAsync(r=>r.AttendanceId==imported[1].AttendanceId,ct);
            stale.ReconcileNote="Concurrent evidence change after review";
            await db.SaveChangesAsync(ct);db.ChangeTracker.Clear();
            var result=await records.BulkVerify(hr,new("2026-11",review.Items.Select(i=>new BulkAttendanceVersion(i.Id,i.Version)).ToArray(),"GB12 evidence reviewed"),ct);
            check(result.Confirmed==6 && result.Failed.Length==2 && result.Failed.Any(f=>f.Id==changed.AttendanceId) && result.Failed.Any(f=>f.Id==stale.AttendanceId),
                "Bulk confirmation succeeds independently while changed flagged/stale records stay unconfirmed");
            check(await db.AttendanceRecords.AsNoTracking().Where(r=>r.AttendanceId==changed.AttendanceId||r.AttendanceId==stale.AttendanceId).AllAsync(r=>r.ConfirmedBy==null&&r.ConfirmedAt==null,ct),
                "Failed bulk rows do not leak confirmation fields to subsequent transactions");
            changed=await db.AttendanceRecords.SingleAsync(r=>r.AttendanceId==changed.AttendanceId,ct);changed.ValidationStatus="imported";
            await db.SaveChangesAsync(ct);db.ChangeTracker.Clear();
            var retryReview=await records.PreviewBulkVerify(hr,new("2026-11",Filter:new AttendanceFilter{Month="2026-11",DepartmentId=departmentId}),ct);
            check(retryReview.Items.Length==2,"Bulk review excludes already confirmed rows on retry");
            var retry=await records.BulkVerify(hr,new("2026-11",retryReview.Items.Select(i=>new BulkAttendanceVersion(i.Id,i.Version)).ToArray()),ct);
            check(retry.Confirmed==2 && retry.Failed.Length==0,"Fresh review safely confirms only the remaining rows");
            check(await db.AuditLogs.CountAsync(a=>a.Action=="verify_attendance_record"&&a.EntityId.HasValue&&imported.Select(r=>r.AttendanceId).Contains(a.EntityId.Value),ct)==8,
                "Bulk confirmation preserves one normal verification audit per successful record");
            var missing=Guid.NewGuid();
            var missingResult=await records.BulkVerify(hr,new("2026-11",[new(missing,"missing")]),ct);
            check(missingResult.Confirmed==0&&missingResult.Failed.Length==1,"Bulk confirmation reports missing IDs without creating attendance");
            var period=await db.PayrollLocks.SingleOrDefaultAsync(p=>p.PayMonth=="2026-11",ct);var originalStatus=period?.Status;var addedPeriod=period is null;
            period ??= new PayrollLock {LockId=Guid.NewGuid(),PayMonth="2026-11"};if(addedPeriod)db.PayrollLocks.Add(period);period.Status="locked";await db.SaveChangesAsync(ct);
            try { await Rejected(async()=>await records.BulkVerify(hr,new("2026-11",[new(imported[0].AttendanceId,"x")]),ct),400,"Monthly lock blocks bulk confirmation before any row changes"); }
            finally { if(addedPeriod)db.PayrollLocks.Remove(period);else period.Status=originalStatus;await db.SaveChangesAsync(ct);db.ChangeTracker.Clear(); }
            db.ChangeTracker.Clear();
            check(await db.AttendanceRecords.Where(r => r.ImportId == batchId).AllAsync(r => r.ActualHours == 8m, ct),
                "Machine Giờ=8 survives commit and HR verification without adding lunch or OT to main hours");
            var summary = AsJson(await records.MonthlySummary(hr, "2026-11", departmentId, null, ct));
            foreach (var row in summary.GetProperty("staffSummaries").EnumerateArray().Where(r => staffIds.Contains(r.GetProperty("staffId").GetGuid()))) {
                var i = staffIds.IndexOf(row.GetProperty("staffId").GetGuid());
                check(row.GetProperty("overtimeHours").GetDecimal() == expected[i], $"GB-12 monthly summary matches verified import for {ends[i]} / night={i == 7}");
            }
            // A roster change after preview must invalidate the commit token even if the row stays valid.
            var newFile = workbook([["Employee ID", "Date", "In1", "Out1"], ["GB12-0", "2026-11-06", "13:30", "18:00"]]);
            var staged2 = AsJson(await imports.Stage(hr, "gb12-roster-change.xlsx", newFile, facilityId, "2026-11", "GB12 refresh", null, ct));
            var id2 = staged2.GetProperty("id").GetGuid();
            var before = AsJson(await imports.Preview(id2, null, null, 1, 100, ct));
            db.ScheduleAssignments.Add(new ScheduleAssignment { Id = Guid.NewGuid(), WeekId = weekId, StaffId = staffIds[0], CoverageId = coverageId, Date = date.AddDays(1), Shift = "evening", Reason = "New night roster" });
            await db.SaveChangesAsync(ct);
            var after = AsJson(await imports.Preview(id2, null, null, 1, 100, ct));
            check(before.GetProperty("version").GetString() != after.GetProperty("version").GetString()
                && after.GetProperty("items")[0].GetProperty("potentialOvertimeHours").GetDecimal() == 0m,
                "GB-12 live night roster changes invalidate import preview and remove potential OT");
        } finally {
            db.ChangeTracker.Clear();
            await db.AttendanceImportRows.Where(r => staffIds.Contains(r.StaffId ?? Guid.Empty) || r.DeviceEnrollId.StartsWith("GB12-")).ExecuteDeleteAsync(ct);
            await db.AttendanceRecords.Where(r => staffIds.Contains(r.StaffId)).ExecuteDeleteAsync(ct);
            await db.AttendanceImports.Where(b => b.DeviceSource == "GB12 regression" || b.DeviceSource == "GB12 refresh").ExecuteDeleteAsync(ct);
            await db.ScheduleAssignments.Where(a => a.WeekId == weekId).ExecuteDeleteAsync(ct);
            await db.ScheduleWeeks.Where(w => w.Id == weekId).ExecuteDeleteAsync(ct);
            await db.ScheduleCoverage.Where(c => c.Id == coverageId).ExecuteDeleteAsync(ct);
            await db.Staff.Where(s => staffIds.Contains(s.StaffId)).ExecuteDeleteAsync(ct);
            await db.Users.Where(u => userIds.Contains(u.UserId)).ExecuteDeleteAsync(ct);
            await db.Departments.Where(d => d.DepartmentId == departmentId).ExecuteDeleteAsync(ct);
        }
    }
}
