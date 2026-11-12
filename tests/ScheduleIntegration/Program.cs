using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Vnc.HRMS.Common.Exceptions;
using Vnc.HRMS.Controllers;
using Vnc.HRMS.Models;
using Vnc.HRMS.Models.Users;
using Vnc.HRMS.Models.Employees;
using Vnc.HRMS.Models.Organization;
using Vnc.HRMS.Persistence;
using Vnc.HRMS.Services;
using Vnc.HRMS.DTOs.Attendance;

// This test owns a new, uniquely named database. It never uses the application database.
var databaseName = "VNC_Schedule_Test_" + Guid.NewGuid().ToString("N");
var connection = new SqlConnectionStringBuilder { DataSource = "localhost", InitialCatalog = databaseName, IntegratedSecurity = true, TrustServerCertificate = true }.ConnectionString;
var configuration = new DbContextOptionsBuilder<AppDbContext>().UseSqlServer(connection).Options;
var created = false;
var actor = Guid.NewGuid(); var employeeUser = Guid.NewGuid();
var staff1 = Guid.NewGuid(); var staff2 = Guid.NewGuid(); var department1 = Guid.NewGuid(); var department2 = Guid.NewGuid(); var facility1 = Guid.NewGuid(); var facility2 = Guid.NewGuid();
var monday = new DateOnly(2026, 11, 9);
var clock = new TestClock { Now = new(2026, 11, 6, 10, 0, 0, TimeSpan.FromHours(7)) };
var ct = CancellationToken.None;
static void Check(bool ok, string name) { if (!ok) throw new Exception(name); Console.WriteLine("PASS " + name); }
async Task<object> Call(Func<SchedulesController, Task<object>> run, Guid? user = null, string role = "hr_staff") {
    await using var db = new AppDbContext(configuration);
    var controller = new SchedulesController(db, clock) { ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity([new Claim("sub", (user ?? actor).ToString()), new Claim(ClaimTypes.Role, role)], "test")) } } };
    return await run(controller);
}
async Task Reject(Func<SchedulesController, Task<object>> run, string name, int status = 400) {
    try { await Call(run); } catch (AppException ex) when (ex.StatusCode == status) { Check(true, name); return; }
    throw new Exception("Expected rejection: " + name);
}
async Task<int> CountAssignments() {
    await using var db = new AppDbContext(configuration);
    return await db.ScheduleAssignments.CountAsync();
}
SchedulesController.AssignmentRequest Input(Guid staff, Guid facility, DateOnly date, string shift = "morning", string? consent = null, string? version = null)
    => new(staff, Guid.Empty, date, shift, null, consent, version, facility);
try {
    await using (var seed = new AppDbContext(configuration)) {
        created = await seed.Database.EnsureCreatedAsync();
        if (!created) throw new Exception("Refusing to use an existing database.");
        seed.Users.AddRange(new User { UserId = actor, Username = "hr.test", NormalizedUsername = "HR.TEST", Role = "hr_staff", Email = "hr@test.invalid" },
            new User { UserId = employeeUser, Username = "employee.test", NormalizedUsername = "EMPLOYEE.TEST", Role = "employee", Email = "employee@test.invalid" });
        seed.Departments.AddRange(new Department { DepartmentId = department1, DeptCode = "D1", Name = "Nursing" }, new Department { DepartmentId = department2, DeptCode = "D2", Name = "Doctors" });
        seed.Staff.AddRange(new Staff { StaffId = staff1, UserId = employeeUser, StaffCode = "S1", FullName = "Staff One", DepartmentId = department1, DateJoined = monday.AddYears(-1) },
            new Staff { StaffId = staff2, UserId = actor, StaffCode = "S2", FullName = "Staff Two", DepartmentId = department2, DateJoined = monday.AddYears(-1) });
        seed.ScheduleFacilities.AddRange(new ScheduleFacility { Id = facility1, Name = "Site 1" }, new ScheduleFacility { Id = facility2, Name = "Site 2" });
        await seed.SaveChangesAsync();
    }
    await Reject(c => c.Publish(monday, ct), "Empty week cannot close");
    await Reject(c => c.Create(Input(staff1, facility1, monday.AddDays(7)), ct), "Cannot plan two weeks ahead before its window");
    await Reject(c => c.Create(Input(staff1, facility1, monday.AddDays(-7)), ct), "Cannot create initial assignments after the work week started");
    await Reject(c => c.Reopen(monday, new("Correct mistaken assignment"), ct), "Cannot reopen a week that was never closed");
    var first = (ScheduleAssignment)await Call(c => c.Create(Input(staff1, facility1, monday), ct));
    await Call(c => c.Create(Input(staff2, facility2, monday), ct));
    Check(true, "HR assigns staff across departments without coverage setup");
    await Reject(c => c.Create(Input(staff1, facility2, monday), ct), "Duplicate employee/day/shift rejected across sites");
    await Reject(c => c.Create(Input(staff1, facility2, monday, "afternoon"), ct), "Same-day site transfer requires consent");
    await Call(c => c.Create(Input(staff1, facility2, monday, "afternoon", "Receiving site agrees"), ct));
    await using (var db = new AppDbContext(configuration)) {
        (await db.ScheduleFacilities.FindAsync(facility1))!.Status = "inactive";
        await db.SaveChangesAsync();
    }
    await Reject(c => c.Create(Input(staff1, facility1, monday.AddDays(1)), ct), "Inactive facilities cannot receive new assignments");
    await Reject(c => c.Create(new(staff1, first.CoverageId, monday.AddDays(1), "morning", null, null), ct), "Legacy coverage requests cannot bypass inactive facilities");
    await Reject(c => c.Publish(monday, ct), "Publication rechecks facility activity");
    await using (var db = new AppDbContext(configuration)) {
        (await db.ScheduleFacilities.FindAsync(facility1))!.Status = "active";
        db.LeaveRequests.Add(new LeaveRequest { RequestId = Guid.NewGuid(), StaffId = staff1, DepartmentId = department1,
            LeaveType = "annual", StartDate = monday.AddDays(4), EndDate = monday.AddDays(4), Status = "approved", Reason = "Test approved absence" });
        await db.SaveChangesAsync();
    }
    var availability = JsonSerializer.SerializeToElement(await Call(c => c.Availability(staff1, monday, null, ct)));
    Check(availability.GetProperty("assignments").GetArrayLength() == 2 && availability.GetProperty("leave").GetArrayLength() == 1,
        "Availability includes existing site assignments and approved leave");
    var editingAvailability = JsonSerializer.SerializeToElement(await Call(c => c.Availability(staff1, monday, first.Id, ct)));
    Check(editingAvailability.GetProperty("assignments").GetArrayLength() == 1, "Availability excludes the assignment being edited");
    var employeeDraft = JsonSerializer.SerializeToElement(await Call(c => c.List(monday, null, null, null, ct), employeeUser, "employee"));
    Check(employeeDraft.GetArrayLength() == 0, "Employee cannot see draft schedules");
    var oldVersion = ScheduleRules.AssignmentVersion(first);
    var updated = (ScheduleAssignment)await Call(c => c.Update(first.Id, Input(staff1, facility1, monday.AddDays(1), version: oldVersion), ct));
    await Reject(c => c.Update(first.Id, Input(staff1, facility1, monday, version: oldVersion), ct), "Concurrent stale edit rejected", 409);
    await Call(c => c.Cancel(first.Id, new("Change of plan", ScheduleRules.AssignmentVersion(updated)), ct));
    Check(true, "HR edits and cancels before closure");
    await Reject(c => c.Cancel(first.Id, new(" "), ct), "Already cancelled schedule cannot be cancelled again");
    await Reject(c => c.FullDay(Input(staff1, facility2, monday), ct), "Conflict in second full-day shift rolls back the first shift");
    var conflict = (ScheduleAssignment)await Call(c => c.Create(Input(staff2, facility2, monday.AddDays(1), "afternoon"), ct));
    await Reject(c => c.AssignWeek(new(staff2, Guid.Empty, monday, [0, 1], ["afternoon"], null, null, facility2), ct), "Conflict in second bulk day rolls back the first day");
    await using (var db = new AppDbContext(configuration)) Check(await db.ScheduleAssignments.CountAsync() == 4, "Failed bulk operations leave no partial assignments");
    await Call(c => c.Cancel(conflict.Id, new("Remove test conflict", ScheduleRules.AssignmentVersion(conflict)), ct));
    await Call(c => c.AssignWeek(new(staff2, Guid.Empty, monday, [1, 2], ["morning", "afternoon"], null, null, facility2), ct));
    await Call(c => c.Publish(monday, ct));
    Check(true, "HR closes the whole week without staffing-quota configuration");
    await using (var db = new AppDbContext(configuration)) {
        var history = JsonSerializer.SerializeToElement(await new AuditViewerService(db, new AttendanceAccess(db, clock)).List(
            new ClaimsPrincipal(new ClaimsIdentity([new Claim("sub", actor.ToString()), new Claim(ClaimTypes.Role, "hr_staff")], "test")),
            new AuditFilter(Month: monday.ToString("yyyy-MM")), true, ct));
        Check(history.GetProperty("total").GetInt32() == await db.ScheduleChanges.CountAsync(), "Schedule history includes typed audit events exactly once");
    }
    await Reject(c => c.Create(Input(staff1, facility1, monday.AddDays(2)), ct), "Creation blocked after closure");
    await Reject(c => c.Update(first.Id, Input(staff1, facility1, monday.AddDays(2)), ct), "Editing blocked after closure");
    await Reject(c => c.Cancel(first.Id, new("After closure"), ct), "Cancellation blocked after closure");
    await Reject(c => c.Publish(monday, ct), "Already closed week cannot close again");
    var employeeRows = JsonSerializer.SerializeToElement(await Call(c => c.List(monday, null, null, null, ct), employeeUser, "employee"));
    Check(employeeRows.GetArrayLength() == 2 && employeeRows.EnumerateArray().All(r => r.GetProperty("assignment").GetProperty("StaffId").GetGuid() == staff1), "Employee sees only own published schedules");
    var unrelated = JsonSerializer.SerializeToElement(await Call(c => c.List(monday, staff2, null, null, ct), employeeUser, "employee"));
    Check(unrelated.GetArrayLength() == 0, "Employee filter cannot expose another employee's schedule");
    var status = JsonSerializer.SerializeToElement(await Call(c => c.Status(monday, ct)));
    Check(status.GetProperty("closed").GetBoolean() && status.GetProperty("assignmentCount").GetInt32() == 6, "Closure status counts active assignments across departments");
    Check(status.GetProperty("publishDeadline").GetDateTimeOffset() == ScheduleRules.PublishDeadline(monday)
        && status.GetProperty("planningStartsAt").GetDateTimeOffset() == ScheduleRules.PlanningStart(monday), "Status exposes server-authoritative planning times");
    // At work start, an unpublished schedule must not become a late first publication.
    await Call(c => c.Reopen(monday, new("Prepare deadline fixture"), ct));
    await using (var db = new AppDbContext(configuration)) {
        var weekIds = await db.ScheduleWeeks.Where(w => w.Monday == monday).Select(w => w.Id).ToArrayAsync();
        await db.ScheduleChanges.Where(change => weekIds.Contains(change.WeekId)
            && change.Detail.StartsWith(ScheduleRules.ReopenAuditPrefix)).ExecuteDeleteAsync();
    }
    clock.Now = ScheduleRules.PublishDeadline(monday);
    await Reject(c => c.Publish(monday, ct), "Existing initial draft cannot publish at exact Monday midnight");
    await Reject(c => c.Create(Input(staff1, facility1, monday.AddDays(2)), ct), "Initial draft cannot add assignments after deadline");
    await Reject(c => c.Reopen(monday, new("Bypass initial publication deadline"), ct), "Unpublished draft cannot use reopen to bypass deadline");
    await using (var db = new AppDbContext(configuration)) Check(await db.ScheduleWeeks.Where(w => w.Monday == monday).AllAsync(w => !w.Published), "Failed late publication leaves every department unpublished");
    clock.Now = ScheduleRules.PublishDeadline(monday).AddTicks(-1);
    clock.Step = TimeSpan.FromTicks(1);
    await Reject(c => c.Publish(monday, ct), "Publication rechecks time when validation crosses the deadline");
    clock.Step = TimeSpan.Zero;
    await using (var db = new AppDbContext(configuration)) Check(await db.ScheduleWeeks.Where(w => w.Monday == monday).AllAsync(w => !w.Published), "Crossing deadline rolls back publication for all departments");
    clock.Now = ScheduleRules.PublishDeadline(monday).AddTicks(-1);
    await Call(c => c.Publish(monday, ct));
    clock.Now = ScheduleRules.PublishDeadline(monday);
    await Reject(c => c.Reopen(monday, new(" \t "), ct), "Reopening requires a nonblank reason");
    await Reject(c => c.Reopen(monday, new(new string('x', 1001)), ct), "Reopen reason cannot exceed 1000 characters");
    await Reject(c => c.Reopen(monday.AddDays(1), new("Wrong weekday"), ct), "Reopen requires a Monday");
    await using (var db = new AppDbContext(configuration)) {
        Check(await db.ScheduleWeeks.Where(x => x.Monday == monday).AllAsync(x => x.Published), "Failed reopen leaves every department published");
        db.ScheduleWeeks.Add(new() { Id = Guid.NewGuid(), DepartmentId = department1, Monday = monday.AddDays(-7), Published = true });
        await db.SaveChangesAsync();
    }
    await Reject(c => c.Reopen(monday.AddDays(-7), new("Old week"), ct), "Expired week cannot be reopened");
    var beforeReopen = clock.Now.UtcDateTime;
    await Call(c => c.Reopen(monday, new("  Correct mistaken facility  "), ct));
    var correctionStatus = JsonSerializer.SerializeToElement(await Call(c => c.Status(monday, ct)));
    Check(correctionStatus.GetProperty("isCorrection").GetBoolean(), "Only an audited reopen enables corrections after first publication deadline");
    await using (var db = new AppDbContext(configuration)) {
        Check(await db.ScheduleWeeks.Where(x => x.Monday == monday).AllAsync(x => !x.Published), "Reopen returns all departments to draft atomically");
        var audit = await (from change in db.ScheduleChanges join week in db.ScheduleWeeks on change.WeekId equals week.Id
                           where week.Monday == monday && change.Detail.EndsWith(": Correct mistaken facility") select change).ToArrayAsync();
        Check(audit.Length == 2 && audit.All(x => x.ActorId == actor && x.At >= beforeReopen), "Reopen records trimmed reason, actor and time for every department");
    }
    await Reject(c => c.Reopen(monday, new("Repeated reopen"), ct), "Already reopened week cannot be reopened again");
    var reopenedEmployee = JsonSerializer.SerializeToElement(await Call(c => c.List(monday, null, null, null, ct), employeeUser, "employee"));
    Check(reopenedEmployee.GetRawText() == employeeRows.GetRawText(), "Employee keeps the last published roster while HR edits the draft");
    var personalStatus = JsonSerializer.SerializeToElement(await Call(c => c.Status(monday, ct), employeeUser, "employee"));
    Check(personalStatus.GetProperty("closed").GetBoolean() && personalStatus.GetProperty("assignmentCount").GetInt32() == 1,
        "Employee status still describes the published roster after reopening");
    await Reject(c => c.Create(Input(staff1, facility1, monday, "noon"), ct), "Current-week creation rejects shifts less than 24 hours away");
    ScheduleAssignment imminent;
    await using (var db = new AppDbContext(configuration)) imminent = await db.ScheduleAssignments.SingleAsync(x => x.StaffId == staff1 && x.Date == monday && x.Shift == "afternoon" && !x.Cancelled);
    await Reject(c => c.Update(imminent.Id, Input(staff1, facility1, monday.AddDays(3), version: ScheduleRules.AssignmentVersion(imminent)), ct), "Rescheduling cannot bypass the original shift's 24-hour limit");
    await Reject(c => c.Cancel(imminent.Id, new("Too close", ScheduleRules.AssignmentVersion(imminent)), ct), "Cancellation rejects shifts less than 24 hours away");
    var beforeBulk = await CountAssignments();
    await Reject(c => c.AssignWeek(new(staff1, Guid.Empty, monday, [0, 3], ["noon"], null, null, facility1), ct), "Bulk creation validates every affected shift against 24 hours");
    await Reject(c => c.FullDay(Input(staff1, facility1, monday), ct), "Full-day creation also enforces 24 hours");
    Check(await CountAssignments() == beforeBulk, "Rejected 24-hour operations leave no partial assignments");
    clock.Now = ScheduleRules.ShiftStart(monday.AddDays(1), "noon").AddHours(-24);
    var exactBoundary = (ScheduleAssignment)await Call(c => c.Create(Input(staff1, facility1, monday.AddDays(1), "noon"), ct));
    await Call(c => c.Cancel(exactBoundary.Id, new("Exact 24-hour boundary", ScheduleRules.AssignmentVersion(exactBoundary)), ct));
    Check(true, "Create and cancel accept an exact 24-hour lead time");
    var beforeRace = await CountAssignments();
    clock.Now = ScheduleRules.ShiftStart(monday.AddDays(1), "evening").AddHours(-24).AddTicks(-1);
    clock.Step = TimeSpan.FromTicks(1);
    await Reject(c => c.Create(Input(staff1, facility1, monday.AddDays(1), "evening"), ct), "Create rechecks 24 hours when validation crosses the boundary");
    clock.Now = ScheduleRules.ShiftStart(monday.AddDays(1), "morning").AddHours(-24).AddTicks(-2);
    await Reject(c => c.AssignWeek(new(staff1, Guid.Empty, monday, [1], ["morning"], null, null, facility1), ct), "Bulk commit rechecks 24 hours and rolls back earlier saves");
    clock.Step = TimeSpan.Zero;
    clock.Now = ScheduleRules.PublishDeadline(monday);
    Check(await CountAssignments() == beforeRace, "Crossing the 24-hour boundary leaves the database unchanged");
    ScheduleAssignment toCorrect;
    await using (var db = new AppDbContext(configuration)) toCorrect = await db.ScheduleAssignments.SingleAsync(x => x.StaffId == staff2 && x.Date == monday.AddDays(1) && x.Shift == "morning" && !x.Cancelled);
    await Reject(c => c.Update(toCorrect.Id, Input(staff2, facility1, monday, version: ScheduleRules.AssignmentVersion(toCorrect)), ct), "Rescheduling also validates the revised shift's 24-hour limit");
    await Call(c => c.Update(toCorrect.Id, Input(staff2, facility1, monday.AddDays(3), version: ScheduleRules.AssignmentVersion(toCorrect)), ct));
    var extra = (ScheduleAssignment)await Call(c => c.Create(Input(staff1, facility1, monday.AddDays(1)), ct));
    await Call(c => c.Cancel(extra.Id, new("Correct extra shift", ScheduleRules.AssignmentVersion(extra)), ct));
    Check(true, "HR can correct, create and cancel assignments after reopening");
    var patientDuty = (ScheduleAssignment)await Call(c => c.Create(Input(staff1, facility2, monday.AddDays(1), "noon"), ct));
    var endedDuty = (ScheduleAssignment)await Call(c => c.Create(Input(staff1, facility2, monday.AddDays(1), "evening"), ct));
    var draftHidden = JsonSerializer.SerializeToElement(await Call(c => c.List(monday, null, null, null, ct), employeeUser, "employee"));
    Check(draftHidden.GetRawText() == employeeRows.GetRawText(), "Draft additions and cancellations do not leak into the published roster");
    var otherEmployee = JsonSerializer.SerializeToElement(await Call(c => c.List(monday, staff2, null, null, ct), employeeUser, "employee"));
    Check(otherEmployee.GetArrayLength() == 0, "Published snapshots preserve employee-level access control");
    await Call(c => c.Publish(monday, ct));
    // Seed already-recorded duty fixtures; time validation is covered by ScheduleRules tests.
    await using (var db = new AppDbContext(configuration)) {
        var patient = await db.ScheduleAssignments.SingleAsync(x => x.Id == patientDuty.Id);
        patient.PatientConfirmed = true; patient.PatientEvidence = "Existing patient reference"; patient.ConfirmedBy = actor; patient.ConfirmedAt = DateTime.UtcNow;
        var ended = await db.ScheduleAssignments.SingleAsync(x => x.Id == endedDuty.Id);
        ended.ActualEndAt = new DateTimeOffset(monday.AddDays(1).ToDateTime(new TimeOnly(19, 15)), TimeSpan.FromHours(7));
        ended.EndNote = "Existing duty completion"; ended.EndRecordedBy = actor; ended.EndRecordedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
    }
    // Read exactly as a new List request does, without seed-context tracking.
    await using (var db = new AppDbContext(configuration)) {
        patientDuty = await db.ScheduleAssignments.AsNoTracking().SingleAsync(x => x.Id == patientDuty.Id);
        endedDuty = await db.ScheduleAssignments.AsNoTracking().SingleAsync(x => x.Id == endedDuty.Id);
    }
    await Call(c => c.Reopen(monday, new("Correct another unrecorded shift"), ct));
    await Reject(c => c.Update(patientDuty.Id, Input(staff1, facility2, monday, "noon", version: ScheduleRules.AssignmentVersion(patientDuty)), ct), "Reopen cannot edit a patient-confirmed duty");
    await Reject(c => c.Cancel(patientDuty.Id, new("Must stay protected", ScheduleRules.AssignmentVersion(patientDuty)), ct), "Reopen cannot cancel a patient-confirmed duty");
    await Reject(c => c.Update(endedDuty.Id, Input(staff1, facility2, monday, "evening", version: ScheduleRules.AssignmentVersion(endedDuty)), ct), "Reopen cannot edit an ended duty");
    await Reject(c => c.Cancel(endedDuty.Id, new("Must stay protected", ScheduleRules.AssignmentVersion(endedDuty)), ct), "Reopen cannot cancel an ended duty");
    await using (var db = new AppDbContext(configuration)) {
        var patient = await db.ScheduleAssignments.SingleAsync(x => x.Id == patientDuty.Id);
        var ended = await db.ScheduleAssignments.SingleAsync(x => x.Id == endedDuty.Id);
        Check(ScheduleRules.AssignmentVersion(patient) == ScheduleRules.AssignmentVersion(patientDuty)
            && ScheduleRules.AssignmentVersion(ended) == ScheduleRules.AssignmentVersion(endedDuty), "Reopen preserves actual duty evidence and end records unchanged");
    }
    await Call(c => c.Publish(monday, ct));
    var republished = JsonSerializer.SerializeToElement(await Call(c => c.List(monday, null, null, null, ct), employeeUser, "employee"));
    Check(republished.GetArrayLength() == 6
        && republished.EnumerateArray().Count(r => !r.GetProperty("assignment").GetProperty("Cancelled").GetBoolean()) == 3
        && republished.EnumerateArray().All(r => r.GetProperty("Published").GetBoolean()), "Employee sees corrected schedule and retained cancellations after republishing");
    var correctedRows = JsonSerializer.SerializeToElement(await Call(c => c.List(monday, staff2, null, facility1, ct)));
    Check(correctedRows.GetArrayLength() == 1 && correctedRows[0].GetProperty("assignment").GetProperty("Date").GetString() == monday.AddDays(3).ToString("yyyy-MM-dd"), "Corrected date and facility persist after republishing");
    await Reject(c => c.Create(Input(staff1, facility1, monday.AddDays(5)), ct), "Republished week is locked again");
    clock.Now = ScheduleRules.CorrectionEnd(monday).AddTicks(-1);
    clock.Step = TimeSpan.FromTicks(1);
    await Reject(c => c.Reopen(monday, new("Request crosses the end of the week"), ct), "Reopen rechecks time before saving at end of week");
    clock.Step = TimeSpan.Zero;
    await using (var db = new AppDbContext(configuration)) Check(await db.ScheduleWeeks.Where(w => w.Monday == monday).AllAsync(w => w.Published), "Crossing correction expiry preserves the published schedule");
    clock.Now = ScheduleRules.CorrectionEnd(monday);
    await Reject(c => c.Reopen(monday, new("Too late"), ct), "Published week cannot reopen after Sunday ends");

    var nextWeek = monday.AddDays(7);
    clock.Now = new(monday.AddDays(4).ToDateTime(new TimeOnly(10, 0)), TimeSpan.FromHours(7));
    var onlyShift = (ScheduleAssignment)await Call(c => c.Create(Input(staff1, facility1, nextWeek.AddDays(2)), ct));
    await Call(c => c.Publish(nextWeek, ct));
    clock.Now = ScheduleRules.PublishDeadline(nextWeek);
    await Call(c => c.Reopen(nextWeek, new("Cancel the only remaining assignment"), ct));
    var revisedShift = (ScheduleAssignment)await Call(c => c.Update(onlyShift.Id,
        Input(staff1, facility2, nextWeek.AddDays(3), version: ScheduleRules.AssignmentVersion(onlyShift)), ct));
    var unchangedPublished = JsonSerializer.SerializeToElement(await Call(c => c.List(nextWeek, null, null, null, ct), employeeUser, "employee"));
    Check(unchangedPublished[0].GetProperty("FacilityId").GetGuid() == facility1
        && unchangedPublished[0].GetProperty("assignment").GetProperty("Date").GetString() == nextWeek.AddDays(2).ToString("yyyy-MM-dd"),
        "Changing a draft's date and facility preserves the original published values");
    var hiddenFacility = JsonSerializer.SerializeToElement(await Call(c => c.List(nextWeek, null, null, facility2, ct), employeeUser, "employee"));
    Check(hiddenFacility.GetArrayLength() == 0, "Employee filters use published facilities rather than draft facilities");
    clock.Now = ScheduleRules.ShiftStart(nextWeek.AddDays(2), "morning").AddHours(-24).AddTicks(1);
    await Reject(c => c.Publish(nextWeek, ct), "Republication revalidates both affected start times against 24 hours");
    var afterRejectedPublish = JsonSerializer.SerializeToElement(await Call(c => c.List(nextWeek, null, null, null, ct), employeeUser, "employee"));
    Check(afterRejectedPublish.GetRawText() == unchangedPublished.GetRawText(), "Rejected republication retains the published snapshot");
    clock.Now = ScheduleRules.PublishDeadline(nextWeek);
    await Call(c => c.Cancel(onlyShift.Id, new("No coverage needed", ScheduleRules.AssignmentVersion(revisedShift)), ct));
    var beforeEmptyPublish = JsonSerializer.SerializeToElement(await Call(c => c.List(nextWeek, null, null, null, ct), employeeUser, "employee"));
    Check(!beforeEmptyPublish[0].GetProperty("assignment").GetProperty("Cancelled").GetBoolean(), "Unpublished cancellation does not replace the employee's roster");
    await Call(c => c.Publish(nextWeek, ct));
    var afterEmptyPublish = JsonSerializer.SerializeToElement(await Call(c => c.List(nextWeek, null, null, null, ct), employeeUser, "employee"));
    Check(afterEmptyPublish.GetArrayLength() == 1 && afterEmptyPublish[0].GetProperty("assignment").GetProperty("Cancelled").GetBoolean(), "A revision can publish all cancellations without retaining obsolete active shifts");
} finally {
    if (created && databaseName.StartsWith("VNC_Schedule_Test_") && databaseName.Length == 50) {
        await using var cleanup = new AppDbContext(configuration);
        await cleanup.Database.EnsureDeletedAsync();
        Console.WriteLine("Removed owned test database.");
    }
}

sealed class TestClock : TimeProvider
{
    public DateTimeOffset Now { get; set; }
    public TimeSpan Step { get; set; }
    public override DateTimeOffset GetUtcNow()
    {
        var current = Now;
        Now = Now.Add(Step);
        return current.ToUniversalTime();
    }
}
