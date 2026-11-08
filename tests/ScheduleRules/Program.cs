using Vnc.HRMS.Services;
using Vnc.HRMS.Common.Exceptions;
using Vnc.HRMS.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Reflection;
using Vnc.HRMS.Models;
using Vnc.HRMS.Common.Utils;
using System.Text.Json;

static void Check(bool ok, string name) { if (!ok) throw new Exception(name); Console.WriteLine($"PASS {name}"); }
Check(UsernamePolicy.IsValid("nguyenvanthinh@gmail.com"), "Email-style usernames supported");
Check(UsernamePolicy.IsValid("admin") && UsernamePolicy.IsValid("staff.demo_01"), "Existing username formats supported");
Check(!UsernamePolicy.IsValid("tên@gmail.com") && !UsernamePolicy.IsValid("name @gmail.com"), "Username rejects accents and spaces");
Check(!UsernamePolicy.IsValid("ab") && !UsernamePolicy.IsValid(new string('a', 51)), "Username enforces length bounds");
Check(!UsernamePolicy.IsValid("name@gmail") && !UsernamePolicy.IsValid("name@@gmail.com"), "Malformed email-style usernames rejected");
Check(ScheduleRules.Hours(new(2026, 4, 14), "morning") == (new TimeOnly(7, 10), new TimeOnly(11, 45)), "Last winter day");
Check(ScheduleRules.Hours(new(2026, 4, 15), "morning") == (new TimeOnly(7, 0), new TimeOnly(11, 30)), "First summer day");
Check(ScheduleRules.Hours(new(2026, 11, 30), "morning").Start == new TimeOnly(7, 0), "Last summer day");
Check(ScheduleRules.Hours(new(2026, 12, 1), "morning").Start == new TimeOnly(7, 10), "First winter day");
Check(ScheduleRules.Hours(new(2026, 11, 1), "evening") == (new TimeOnly(17, 0), new TimeOnly(19, 0)), "Evening duty follows clinic rules");
Check(ScheduleRules.Monday(new(2026, 11, 1)) == new DateOnly(2026, 10, 26), "Sunday belongs to preceding Monday");
Check(ScheduleRules.Monday(new(2027, 1, 1)) == new DateOnly(2026, 12, 28), "Week across year boundary");
var planningMonday = new DateOnly(2026, 11, 9);
var planningStart = new DateTimeOffset(2026, 11, 2, 0, 0, 0, TimeSpan.FromHours(7));
var publishDeadline = new DateTimeOffset(2026, 11, 9, 7, 0, 0, TimeSpan.FromHours(7));
Check(ScheduleRules.PlanningStart(planningMonday) == planningStart, "Planning opens on Monday of the preceding week");
Check(ScheduleRules.PublishDeadline(planningMonday) == publishDeadline, "Initial summer publication closes at Monday 07:00 Vietnam time");
Reject(() => ScheduleRules.Editable(planningMonday, planningStart.AddTicks(-1)), "Cannot plan two weeks ahead before planning opens");
ScheduleRules.Editable(planningMonday, planningStart);
Check(true, "Next week's assignments can be created from Monday this week");
ScheduleRules.Editable(planningMonday, publishDeadline.AddTicks(-1));
Check(true, "Initial publication allowed immediately before first shift");
Reject(() => ScheduleRules.Editable(planningMonday, publishDeadline), "Initial publication rejected at exact shift start");
Reject(() => ScheduleRules.Editable(planningMonday, publishDeadline.AddDays(1)), "Unpublished draft cannot first publish during the work week");
ScheduleRules.Editable(planningMonday, publishDeadline.AddTicks(-1).ToUniversalTime());
Reject(() => ScheduleRules.Editable(planningMonday, publishDeadline.ToUniversalTime()), "UTC and Vietnam enforce the same publication deadline");
var winterMonday = new DateOnly(2026, 12, 7);
var winterDeadline = new DateTimeOffset(2026, 12, 7, 7, 10, 0, TimeSpan.FromHours(7));
Check(ScheduleRules.PublishDeadline(winterMonday) == winterDeadline, "Winter publication deadline follows 07:10 clinic opening");
ScheduleRules.Editable(winterMonday, winterDeadline.AddTicks(-1));
Reject(() => ScheduleRules.Editable(winterMonday, winterDeadline), "Winter deadline rejects exact 07:10");
ScheduleRules.Editable(planningMonday, publishDeadline.AddHours(1), isCorrection: true);
Check(true, "Audited reopened schedule can be corrected and republished after work starts");
var correctionEnd = new DateTimeOffset(2026, 11, 16, 0, 0, 0, TimeSpan.FromHours(7));
ScheduleRules.Reopenable(planningMonday, correctionEnd.AddTicks(-1));
ScheduleRules.Editable(planningMonday, correctionEnd.AddTicks(-1), isCorrection: true);
Reject(() => ScheduleRules.Reopenable(planningMonday, correctionEnd), "Reopening closes at Monday midnight after the work week");
Reject(() => ScheduleRules.Editable(planningMonday, correctionEnd, isCorrection: true), "Correction cannot modify an expired week");
Reject(() => ScheduleRules.Reopenable(planningMonday, planningStart.AddTicks(-1)), "Reopening cannot bypass the start of the planning window");
Reject(() => ScheduleRules.PublishDeadline(planningMonday.AddDays(1)), "Publication deadline requires a Monday");
Check(ScheduleRules.PlanningStart(new(2027, 1, 4)).Date == new DateTime(2026, 12, 28), "Planning window crosses calendar years");
Check(!ScheduleRules.IsDuty("afternoon") && ScheduleRules.IsDuty("noon") && ScheduleRules.IsDuty("evening"), "Only duty shifts qualify for duty credit");
foreach (var method in typeof(SchedulesController).GetMethods().Where(m => m.GetCustomAttribute<HttpPostAttribute>() != null || m.GetCustomAttribute<HttpPutAttribute>() != null))
    Check(method.GetCustomAttributes<AuthorizeAttribute>().Any(a => a.Roles == "hr_staff"), $"Mutation {method.Name} restricted to HR Staff");

var week = new DateOnly(2026, 11, 2);
static void Reject(Action action, string name) {
    var rejected = false; try { action(); } catch (AppException e) { rejected = e.StatusCode == 400; }
    Check(rejected, name);
}
var dutyDate = new DateOnly(2026, 11, 1);
var now = new DateTimeOffset(2026, 11, 1, 22, 0, 0, TimeSpan.FromHours(7));
ScheduleRules.ValidateDutyEnd(dutyDate, "evening", now.AddHours(-2), now);
Check(true, "Actual end after planned 19:00 accepted");
ScheduleRules.ValidateDutyEnd(dutyDate, "evening", now.AddHours(-4), now);
Check(true, "Actual end before planned 19:00 accepted");
Reject(() => ScheduleRules.ValidateDutyEnd(dutyDate, "evening", now.AddHours(-6), now), "End before shift start rejected");
Reject(() => ScheduleRules.ValidateDutyEnd(dutyDate, "evening", now.AddMinutes(1), now), "Future end rejected");
Reject(() => ScheduleRules.ValidateDutyEnd(dutyDate, "evening", now.AddHours(3), now.AddDays(1)), "Overnight end rejected");
Reject(() => ScheduleRules.ValidateDutyEnd(dutyDate, "morning", now.AddHours(-2), now), "Ordinary shift cannot record duty completion");
ScheduleRules.ValidateDutyEnd(dutyDate, "evening", now.AddHours(-2).ToUniversalTime(), now);
Check(true, "UTC and Vietnam timestamps validate consistently");

var eveningStart = new DateTimeOffset(2026, 11, 2, 17, 0, 0, TimeSpan.FromHours(7));
Reject(() => ScheduleRules.ValidateDutyStarted(new(2026, 11, 2), "evening", eveningStart.AddTicks(-1)), "Duty credit rejected before evening shift start");
ScheduleRules.ValidateDutyStarted(new(2026, 11, 2), "evening", eveningStart);
Check(true, "Duty credit accepted at exact evening shift start");
ScheduleRules.ValidateDutyStarted(new(2026, 11, 2), "evening", eveningStart.ToUniversalTime());
Check(true, "Duty start comparison uses UTC-equivalent Vietnam time");
Reject(() => ScheduleRules.ValidateDutyStarted(new(2026, 11, 2), "evening", new(2026, 11, 2, 8, 0, 0, TimeSpan.FromHours(7))), "Same-day duty credit rejected before scheduled hours");
var summerNoon = new DateTimeOffset(2026, 11, 2, 11, 30, 0, TimeSpan.FromHours(7));
Reject(() => ScheduleRules.ValidateDutyStarted(new(2026, 11, 2), "noon", summerNoon.AddSeconds(-1)), "Summer noon duty cannot start before 11:30");
ScheduleRules.ValidateDutyStarted(new(2026, 11, 2), "noon", summerNoon);
Check(true, "Summer noon duty starts at 11:30 Vietnam time");
var winterNoon = new DateTimeOffset(2026, 12, 1, 11, 45, 0, TimeSpan.FromHours(7));
Reject(() => ScheduleRules.ValidateDutyStarted(new(2026, 12, 1), "noon", winterNoon.AddMinutes(-1)), "Winter noon duty cannot start before 11:45");
ScheduleRules.ValidateDutyStarted(new(2026, 12, 1), "noon", winterNoon.ToUniversalTime());
Check(true, "Winter noon duty respects seasonal and timezone boundary");
Reject(() => ScheduleRules.ValidateDutyStarted(new(2026, 11, 2), "morning", eveningStart), "Ordinary shift cannot receive duty-start confirmation");

var bulkMonday = new DateOnly(2026, 11, 2);
var fullWeek = ScheduleRules.ExpandWeek(bulkMonday, [0,1,2,3,4,5,6], ["morning","afternoon"]);
Check(fullWeek.Length == 14 && fullWeek.First() == (bulkMonday, "morning") && fullWeek.Last() == (bulkMonday.AddDays(6), "afternoon"), "Whole week creates fourteen regular assignments");
Check(ScheduleRules.ExpandWeek(bulkMonday, [0,2,6], ["noon","evening"]).Length == 6, "Selected days and duty shifts expanded only");
Check(ScheduleRules.ExpandWeek(new(2026,12,28), [6], ["morning"]).Single().Date == new DateOnly(2027,1,3), "Bulk dates cross year correctly");
Reject(() => ScheduleRules.ExpandWeek(bulkMonday, [], ["morning"]), "Bulk rejects empty days");
Reject(() => ScheduleRules.ExpandWeek(bulkMonday, [0], []), "Bulk rejects empty shifts");
Reject(() => ScheduleRules.ExpandWeek(bulkMonday, [0,0], ["morning"]), "Bulk rejects duplicate days");
Reject(() => ScheduleRules.ExpandWeek(bulkMonday, [0], ["morning","morning"]), "Bulk rejects duplicate shifts");
Reject(() => ScheduleRules.ExpandWeek(bulkMonday, [7], ["morning"]), "Bulk rejects dates outside week");
Reject(() => ScheduleRules.ExpandWeek(bulkMonday, [0], ["night"]), "Bulk rejects unknown shifts");
Reject(() => ScheduleRules.ExpandWeek(bulkMonday.AddDays(1), [0], ["morning"]), "Bulk requires Monday as week start");
Reject(() => ScheduleRules.ExpandWeek(bulkMonday, null, ["morning"]), "Bulk rejects missing days");
Reject(() => ScheduleRules.ExpandWeek(bulkMonday, [0], null), "Bulk rejects missing shifts");

var versionedAssignment = new ScheduleAssignment {
    Id = Guid.NewGuid(), WeekId = Guid.NewGuid(), StaffId = Guid.NewGuid(), CoverageId = Guid.NewGuid(),
    Date = new DateOnly(2026, 11, 2), Shift = "morning", Reason = "Phân công tuần", TransferConsent = "Trưởng khoa xác nhận"
};
var assignmentSnapshot = JsonSerializer.Serialize(versionedAssignment);
var versionToken = ScheduleRules.AssignmentVersion(versionedAssignment);
Check(versionToken.Length == 64 && versionToken == ScheduleRules.AssignmentVersion(versionedAssignment), "Assignment snapshot produces a deterministic SHA256 token");
ScheduleRules.CheckAssignmentVersion(versionedAssignment, versionToken);
Check(true, "Unchanged assignment accepts matching version token");
ScheduleRules.CheckAssignmentVersion(versionedAssignment, null);
Check(true, "Older API client may omit assignment version");
foreach (var change in new (string Name, Action<ScheduleAssignment> Apply)[] {
    ("staff", item => item.StaffId = Guid.NewGuid()),
    ("coverage", item => item.CoverageId = Guid.NewGuid()),
    ("date", item => item.Date = item.Date.AddDays(1)),
    ("shift", item => item.Shift = "afternoon"),
    ("reason", item => item.Reason = "Điều chỉnh nhân sự"),
    ("consent", item => item.TransferConsent = "Cơ sở nhận đã đồng ý"),
    ("cancellation", item => item.Cancelled = true),
    ("patient confirmation", item => item.PatientConfirmed = true),
    ("patient evidence", item => item.PatientEvidence = "PHIEU-DEMO"),
    ("actual end", item => item.ActualEndAt = new DateTimeOffset(2026, 11, 2, 19, 0, 0, TimeSpan.FromHours(7))),
    ("end note", item => item.EndNote = "Hết bệnh nhân")
}) {
    var changed = JsonSerializer.Deserialize<ScheduleAssignment>(assignmentSnapshot)!;
    change.Apply(changed);
    var staleRejected = false;
    try { ScheduleRules.CheckAssignmentVersion(changed, versionToken); }
    catch (AppException error) { staleRejected = error.StatusCode == 409; }
    Check(staleRejected, $"Stale token rejects changed assignment {change.Name} with 409");
}
var invalidTokenRejected = false;
try { ScheduleRules.CheckAssignmentVersion(versionedAssignment, "invalid-token"); }
catch (AppException error) { invalidTokenRejected = error.StatusCode == 409; }
Check(invalidTokenRejected, "Malformed or mismatched version token returns 409");
