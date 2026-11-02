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

// This test owns a new, uniquely named database. It never uses the application database.
var databaseName = "VNC_Schedule_Test_" + Guid.NewGuid().ToString("N");
var connection = new SqlConnectionStringBuilder { DataSource = "localhost", InitialCatalog = databaseName, IntegratedSecurity = true, TrustServerCertificate = true }.ConnectionString;
var configuration = new DbContextOptionsBuilder<AppDbContext>().UseSqlServer(connection).Options;
var created = false;
var actor = Guid.NewGuid(); var employeeUser = Guid.NewGuid();
var staff1 = Guid.NewGuid(); var staff2 = Guid.NewGuid(); var department1 = Guid.NewGuid(); var department2 = Guid.NewGuid(); var facility1 = Guid.NewGuid(); var facility2 = Guid.NewGuid();
var monday = ScheduleRules.Monday(ScheduleRules.Today);
var ct = CancellationToken.None;
static void Check(bool ok, string name) { if (!ok) throw new Exception(name); Console.WriteLine("PASS " + name); }
async Task<object> Call(Func<SchedulesController, Task<object>> run, Guid? user = null, string role = "hr_staff") {
    await using var db = new AppDbContext(configuration);
    var controller = new SchedulesController(db) { ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity([new Claim("sub", (user ?? actor).ToString()), new Claim(ClaimTypes.Role, role)], "test")) } } };
    return await run(controller);
}
async Task Reject(Func<SchedulesController, Task<object>> run, string name, int status = 400) {
    try { await Call(run); } catch (AppException ex) when (ex.StatusCode == status) { Check(true, name); return; }
    throw new Exception("Expected rejection: " + name);
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
    await Reject(c => c.Reopen(monday, new("Correct mistaken assignment"), ct), "Cannot reopen a week that was never closed");
    var first = (ScheduleAssignment)await Call(c => c.Create(Input(staff1, facility1, monday), ct));
    await Call(c => c.Create(Input(staff2, facility2, monday), ct));
    Check(true, "HR assigns staff across departments without coverage setup");
    await Reject(c => c.Create(Input(staff1, facility2, monday), ct), "Duplicate employee/day/shift rejected across sites");
    await Reject(c => c.Create(Input(staff1, facility2, monday, "afternoon"), ct), "Same-day site transfer requires consent");
    await Call(c => c.Create(Input(staff1, facility2, monday, "afternoon", "Receiving site agrees"), ct));
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
    await Reject(c => c.Reopen(monday, new(" \t "), ct), "Reopening requires a nonblank reason");
    await Reject(c => c.Reopen(monday, new(new string('x', 1001)), ct), "Reopen reason cannot exceed 1000 characters");
    await Reject(c => c.Reopen(monday.AddDays(1), new("Wrong weekday"), ct), "Reopen requires a Monday");
    await using (var db = new AppDbContext(configuration)) {
        Check(await db.ScheduleWeeks.Where(x => x.Monday == monday).AllAsync(x => x.Published), "Failed reopen leaves every department published");
        db.ScheduleWeeks.Add(new() { Id = Guid.NewGuid(), DepartmentId = department1, Monday = monday.AddDays(-7), Published = true });
        await db.SaveChangesAsync();
    }
    await Reject(c => c.Reopen(monday.AddDays(-7), new("Old week"), ct), "Expired week cannot be reopened");
    var beforeReopen = DateTime.UtcNow;
    await Call(c => c.Reopen(monday, new("  Correct mistaken facility  "), ct));
    await using (var db = new AppDbContext(configuration)) {
        Check(await db.ScheduleWeeks.Where(x => x.Monday == monday).AllAsync(x => !x.Published), "Reopen returns all departments to draft atomically");
        var audit = await (from change in db.ScheduleChanges join week in db.ScheduleWeeks on change.WeekId equals week.Id
                           where week.Monday == monday && change.Detail.EndsWith(": Correct mistaken facility") select change).ToArrayAsync();
        Check(audit.Length == 2 && audit.All(x => x.ActorId == actor && x.At >= beforeReopen), "Reopen records trimmed reason, actor and time for every department");
    }
    await Reject(c => c.Reopen(monday, new("Repeated reopen"), ct), "Already reopened week cannot be reopened again");
    var reopenedEmployee = JsonSerializer.SerializeToElement(await Call(c => c.List(monday, null, null, null, ct), employeeUser, "employee"));
    Check(reopenedEmployee.GetArrayLength() == 0, "Employee cannot see reopened draft until republished");
    ScheduleAssignment toCorrect;
    await using (var db = new AppDbContext(configuration)) toCorrect = await db.ScheduleAssignments.SingleAsync(x => x.StaffId == staff2 && x.Date == monday && x.Shift == "morning" && !x.Cancelled);
    await Call(c => c.Update(toCorrect.Id, Input(staff2, facility1, monday.AddDays(3), version: ScheduleRules.AssignmentVersion(toCorrect)), ct));
    var extra = (ScheduleAssignment)await Call(c => c.Create(Input(staff1, facility1, monday.AddDays(1)), ct));
    await Call(c => c.Cancel(extra.Id, new("Correct extra shift", ScheduleRules.AssignmentVersion(extra)), ct));
    Check(true, "HR can correct, create and cancel assignments after reopening");
    var patientDuty = (ScheduleAssignment)await Call(c => c.Create(Input(staff1, facility2, monday, "noon"), ct));
    var endedDuty = (ScheduleAssignment)await Call(c => c.Create(Input(staff1, facility2, monday, "evening"), ct));
    await Call(c => c.Publish(monday, ct));
    // Seed already-recorded duty fixtures; time validation is covered by ScheduleRules tests.
    await using (var db = new AppDbContext(configuration)) {
        var patient = await db.ScheduleAssignments.SingleAsync(x => x.Id == patientDuty.Id);
        patient.PatientConfirmed = true; patient.PatientEvidence = "Existing patient reference"; patient.ConfirmedBy = actor; patient.ConfirmedAt = DateTime.UtcNow;
        var ended = await db.ScheduleAssignments.SingleAsync(x => x.Id == endedDuty.Id);
        ended.ActualEndAt = new DateTimeOffset(monday.ToDateTime(new TimeOnly(19, 15)), TimeSpan.FromHours(7));
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
    Check(republished.GetArrayLength() == 5
        && republished.EnumerateArray().Count(r => !r.GetProperty("assignment").GetProperty("Cancelled").GetBoolean()) == 3
        && republished.EnumerateArray().All(r => r.GetProperty("Published").GetBoolean()), "Employee sees corrected schedule and retained cancellations after republishing");
    var correctedRows = JsonSerializer.SerializeToElement(await Call(c => c.List(monday, staff2, null, facility1, ct)));
    Check(correctedRows.GetArrayLength() == 1 && correctedRows[0].GetProperty("assignment").GetProperty("Date").GetString() == monday.AddDays(3).ToString("yyyy-MM-dd"), "Corrected date and facility persist after republishing");
    await Reject(c => c.Create(Input(staff1, facility1, monday.AddDays(5)), ct), "Republished week is locked again");
} finally {
    if (created && databaseName.StartsWith("VNC_Schedule_Test_") && databaseName.Length == 50) {
        await using var cleanup = new AppDbContext(configuration);
        await cleanup.Database.EnsureDeletedAsync();
        Console.WriteLine("Removed owned test database.");
    }
}
