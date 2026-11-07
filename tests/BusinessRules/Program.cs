using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Vnc.HRMS.Common.Exceptions;
using Vnc.HRMS.Controllers;
using Vnc.HRMS.DTOs.Certificates;
using Vnc.HRMS.DTOs.Cme;
using Vnc.HRMS.DTOs.Employees;
using Vnc.HRMS.DTOs.Files;
using Vnc.HRMS.DTOs.Organization;
using Vnc.HRMS.DTOs.Payroll;
using Vnc.HRMS.DTOs.SelfService;
using Vnc.HRMS.Models;
using Vnc.HRMS.Models.Employees;
using Vnc.HRMS.Models.Organization;
using Vnc.HRMS.Models.Users;
using Vnc.HRMS.Persistence;
using Vnc.HRMS.Repositories;
using Vnc.HRMS.Services;
using Vnc.HRMS.Services.Interfaces;

// Own an isolated database, following the existing integration test projects.
const string prefix = "VNC_BusinessRules_Test_";
var databaseName = prefix + Guid.NewGuid().ToString("N");
var connection = new SqlConnectionStringBuilder { DataSource = "localhost", InitialCatalog = databaseName,
    IntegratedSecurity = true, TrustServerCertificate = true, ConnectTimeout = 10 }.ConnectionString;
var options = new DbContextOptionsBuilder<AppDbContext>().UseSqlServer(connection).Options;
var created = false;
var ct = CancellationToken.None;
var today = ScheduleRules.Today;
var monday = ScheduleRules.Monday(today).AddDays(7);
var department = Guid.NewGuid(); var inactiveDepartment = Guid.NewGuid();
var actor = Guid.NewGuid(); var staff1 = Guid.NewGuid(); var staff2 = Guid.NewGuid(); var user1 = Guid.NewGuid(); var user2 = Guid.NewGuid();
var facility = Guid.NewGuid();
var procedureService = Guid.NewGuid();
var files = new TestFiles();
var passed = 0;
void Check(bool ok, string name) { if (!ok) throw new Exception(name); passed++; Console.WriteLine("PASS " + name); }
async Task<T> Run<T>(Func<AppDbContext, Task<T>> action) { await using var db = new AppDbContext(options); return await action(db); }
async Task Execute(Func<AppDbContext, Task> action) { await using var db = new AppDbContext(options); await action(db); }
async Task Reject(Func<AppDbContext, Task> action, int status, string name)
{
    try { await Execute(action); } catch (AppException e) when (e.StatusCode == status) { Check(true, name); return; }
    throw new Exception("Expected rejection: " + name);
}
AuditLogHelper Audit(AppDbContext db) => new(db, new HttpContextAccessor());
DepartmentService Departments(AppDbContext db) => new(new DepartmentRepository(db), new UnitOfWork(db));
EmployeeService Employees(AppDbContext db) => new(new EmployeeRepository(db), new DepartmentRepository(db),
    new UserRepository(db), new PasswordHasher<User>(), new UnitOfWork(db));
CmeRecordService Cme(AppDbContext db) => new(db, new UnitOfWork(db));
CertificateService Certificates(AppDbContext db) => new(db, new UnitOfWork(db));
LeaveRequestService Leave(AppDbContext db) => new(new SelfServiceRepository(db), new UnitOfWork(db), files, Audit(db));
PayrollPeriodService Periods(AppDbContext db) => new(new PayrollPeriodRepository(db), new UnitOfWork(db), Audit(db));
ProcedureSlipService Procedures(AppDbContext db) => new(db, new UnitOfWork(db), Audit(db));
SchedulesController Schedules(AppDbContext db) => new(db) { ControllerContext = new() { HttpContext = new DefaultHttpContext {
    User = new ClaimsPrincipal(new ClaimsIdentity([new Claim("sub", actor.ToString()), new Claim(ClaimTypes.Role, "hr_staff")], "test")) } } };
UpdateEmployeeRequest Edit(string code = "BR01", string? email = "one@test.invalid", string? phone = null,
    DateOnly? dob = null, string? gender = null, string? idCard = null, DateOnly? joined = null, DateOnly? left = null, int? dependents = 0)
    => new(code, "Nguyễn An", email, phone, dob, gender, idCard, null, department, null, joined ?? today.AddYears(-2), left, dependents, "active");
SaveCertificateRequest NewCert(string name, string category = "certificate", decimal? credits = 1m, string status = "active")
    => new(staff1, null, category, name, null, today.AddYears(-1), null, null, category == "degree" ? null : 24, credits, status, null, department);
CreateLeaveRequestInput NewLeave(DateOnly date) => new() { LeaveType = "annual", StartDate = date, EndDate = date, Reason = "Nghỉ phép kiểm thử nghiệp vụ" };
SchedulesController.AssignmentRequest Assignment(DateOnly date) => new(staff1, Guid.Empty, date, "morning", null, null, FacilityId: facility);

try
{
    await using (var db = new AppDbContext(options))
    {
        created = await db.Database.EnsureCreatedAsync();
        if (!created) throw new Exception("Refusing to use an existing database.");
        db.Users.AddRange(new User { UserId = actor, Username = "hr", NormalizedUsername = "HR", Role = "hr_staff" },
            new User { UserId = user1, Username = "one", NormalizedUsername = "ONE", Role = "employee" },
            new User { UserId = user2, Username = "two", NormalizedUsername = "TWO", Role = "employee" });
        db.Departments.AddRange(new Department { DepartmentId = department, DeptCode = "BR", Name = "Khoa kiểm thử" },
            new Department { DepartmentId = inactiveDepartment, DeptCode = "OFF", Name = "Khoa đã ngừng", Status = "inactive" });
        db.Staff.AddRange(new Staff { StaffId = staff1, UserId = user1, StaffCode = "BR01", FullName = "Nguyễn An", Email = "one@test.invalid", DepartmentId = department, DateJoined = today.AddYears(-2) },
            new Staff { StaffId = staff2, UserId = user2, StaffCode = "BR02", FullName = "Trần Bình", Email = "two@test.invalid", IdCardNumber = "012345678901", DepartmentId = department, DateJoined = today.AddYears(-2) });
        db.LeaveTypes.Add(new LeaveType { LeaveTypeId = Guid.NewGuid(), Code = "annual", Name = "Nghỉ phép năm" });
        db.ScheduleFacilities.Add(new ScheduleFacility { Id = facility, Name = "Cơ sở kiểm thử" });
        db.ProcedureServices.Add(new ProcedureService { ServiceId = procedureService, ServiceCode = "BR-PROC", ServiceName = "Thủ thuật kiểm thử", Status = "active" });
        db.ProcedureServices.Add(new ProcedureService { ServiceId = Guid.NewGuid(), ServiceCode = "TT-MAU-01", ServiceName = "Dịch vụ đã tắt", Status = "inactive" });
        await db.SaveChangesAsync();
    }

    await Reject(db => Departments(db).CreateAsync(new(" br ", "Khoa khác"), ct), 409, "Department creation rejects normalized duplicate code");
    await Reject(db => Departments(db).CreateAsync(new("NEW", " Khoa kiểm thử "), ct), 409, "Department creation rejects duplicate name");
    await Reject(db => Departments(db).UpdateAsync(department, new("OFF", "Khoa kiểm thử", "active"), ct), 409, "Department edit rejects another department's code");
    var unchanged = await Run(db => Departments(db).UpdateAsync(department, new(" br ", "Khoa kiểm thử", "active"), ct));
    Check(unchanged.Code == "BR", "Department accepts its own code and name");
    await Reject(db => Departments(db).CreateAsync(new(" ", "Khoa mới"), ct), 400, "Department rejects whitespace code");

    await Reject(db => Employees(db).UpdateAsync(staff1, Edit(code: "br02"), ct), 409, "Employee edit rejects normalized duplicate code");
    await Reject(db => Employees(db).CreateAsync(new("NEW", "Nhân viên Mới", "TWO@test.invalid", department, today), ct), 409, "Employee creation rejects duplicate email");
    await Reject(db => Employees(db).UpdateAsync(staff1, Edit(email: "two@test.invalid"), ct), 409, "Employee edit rejects duplicate email");
    await Reject(db => Employees(db).UpdateAsync(staff1, Edit(idCard: "012345678901"), ct), 409, "Employee edit rejects duplicate CCCD");
    await Reject(db => Employees(db).UpdateAsync(staff1, Edit(phone: "123"), ct), 400, "Employee edit shares phone rule with self service");
    await Reject(db => Employees(db).UpdateAsync(staff1, Edit(dob: today.AddYears(-17)), ct), 400, "Employee edit shares adult age rule with self service");
    await Reject(db => Employees(db).UpdateAsync(staff1, Edit(idCard: "12345"), ct), 400, "Employee edit rejects malformed CCCD");
    await Reject(db => Employees(db).UpdateAsync(staff1, Edit(gender: "unknown"), ct), 400, "Employee edit rejects unknown gender");
    await Reject(db => Employees(db).UpdateAsync(staff1, Edit(dependents: -1), ct), 400, "Negative dependent count is rejected instead of ignored");
    await Reject(db => Employees(db).UpdateAsync(staff1, Edit(left: today.AddYears(-3)), ct), 400, "Departure before joining is a business error");
    var validEmployee = await Run(db => Employees(db).UpdateAsync(staff1, Edit(phone: "0912345678", idCard: "012345678902"), ct));
    Check(validEmployee.Id == staff1 && validEmployee.Phone == "0912345678", "Valid employee edit accepts own unique fields and optional fields");

    var pdf = new FormFile(new MemoryStream("%PDF-test"u8.ToArray()), 0, 9, "file", "avatar.pdf") { Headers = new HeaderDictionary(), ContentType = "application/pdf" };
    await Reject(db => new SelfServiceProfileService(new SelfServiceRepository(db), new UnitOfWork(db), files, Audit(db)).UploadAvatarAsync(user1, pdf, ct), 400, "Avatar rejects PDFs accepted by general attachments");
    Check(files.Calls == 0, "Invalid avatar is rejected before upload");

    await Reject(db => Periods(db).CreatePeriodAsync(actor, new("0000-01"), ct), 400, "Payroll rejects year zero");
    await Reject(db => Periods(db).GetPeriodDetailAsync("0000-01", ct), 400, "Payroll detail also rejects year zero");
    var period = await Run(db => Periods(db).CreatePeriodAsync(actor, new(" 2026-12 "), ct));
    Check(period.PayMonth == "2026-12" && period.Status == "draft", "Valid payroll month is normalized");
    await Reject(db => Periods(db).CreatePeriodAsync(actor, new("2026-12"), ct), 409, "Payroll rejects duplicate month");

    await Execute(async db => { var staff = await db.Staff.FindAsync(staff1); staff!.DateJoined = monday.AddDays(1); await db.SaveChangesAsync(); });
    var leaveDay = today.DayOfWeek == DayOfWeek.Sunday ? today.AddDays(1) : today;
    await Reject(db => Leave(db).CreateLeaveRequestAsync(user1, NewLeave(leaveDay), ct), 400, "Leave cannot precede joining date");
    await Reject(db => Schedules(db).Create(Assignment(monday), ct), 400, "Schedule cannot precede joining date");
    await Execute(async db => { var staff = await db.Staff.FindAsync(staff1); staff!.DateJoined = today.AddYears(-2); staff.DateLeft = today.AddDays(1); await db.SaveChangesAsync(); });
    await Reject(db => Leave(db).CreateLeaveRequestAsync(user1, NewLeave(today.AddDays(7)), ct), 400, "Leave cannot follow departure date");
    await Execute(async db => { var staff = await db.Staff.FindAsync(staff1); staff!.DateLeft = null; staff.DepartmentId = inactiveDepartment; await db.SaveChangesAsync(); });
    await Reject(db => Leave(db).CreateLeaveRequestAsync(user1, NewLeave(leaveDay), ct), 400, "Leave requires an active department");
    await Reject(db => Schedules(db).Create(Assignment(monday), ct), 400, "Schedule requires an active department");
    await Execute(async db => { var staff = await db.Staff.FindAsync(staff1); staff!.DepartmentId = department; await db.SaveChangesAsync(); });
    var leave = await Run(db => Leave(db).CreateLeaveRequestAsync(user1, NewLeave(leaveDay), ct));
    Check(leave.Status == "pending", "Valid leave still creates a pending request");
    await Run(db => Leave(db).WithdrawLeaveRequestAsync(user1, leave.RequestId, ct));
    await Reject(db => Leave(db).WithdrawLeaveRequestAsync(user1, leave.RequestId, ct), 409, "Leave can only be withdrawn once while pending");
    await Run(db => Schedules(db).Create(Assignment(monday), ct));
    await Execute(async db => { var staff = await db.Staff.FindAsync(staff1); staff!.DateJoined = monday.AddDays(1); await db.SaveChangesAsync(); });
    await Reject(db => Schedules(db).Publish(monday, ct), 400, "Publishing rechecks joining date changed after assignment");
    await Execute(async db => { var staff = await db.Staff.FindAsync(staff1); staff!.DateJoined = today.AddYears(-2); var dept = await db.Departments.FindAsync(department); dept!.Status = "inactive"; await db.SaveChangesAsync(); });
    await Reject(db => Schedules(db).Publish(monday, ct), 400, "Publishing rechecks department status changed after assignment");
    await Execute(async db => { var dept = await db.Departments.FindAsync(department); dept!.Status = "active"; await db.SaveChangesAsync(); });
    await Run(db => Schedules(db).Publish(monday, ct));

    var degree = await Run(db => Certificates(db).CreateAsync(NewCert("Chuyên ngành", "degree", null, "unverified"), actor, ct));
    Check(degree.Category == "degree" && degree.Status == "unverified" && degree.CmeCycleMonths == null, "Explicit degree category wins over name heuristics");
    var cert = await Run(db => Certificates(db).CreateAsync(NewCert("Chứng chỉ bác sĩ"), actor, ct));
    Check(cert.Category == "certificate", "Explicit certificate category wins over doctor-name heuristic");
    await Reject(db => Certificates(db).CreateAsync(NewCert("Invalid") with { Category = "unknown" }, actor, ct), 400, "Certificate rejects unknown category");
    await Reject(db => Certificates(db).CreateAsync(NewCert("Invalid") with { Status = "unknown" }, actor, ct), 400, "Certificate rejects unknown status");
    await Reject(db => Certificates(db).CreateAsync(NewCert("Invalid") with { CmeCycleMonths = -1 }, actor, ct), 400, "Certificate rejects negative cycle duration");
    await Reject(db => Certificates(db).CreateAsync(NewCert("Invalid") with { CmeRequiredCredits = -1 }, actor, ct), 400, "Certificate rejects negative required credits");
    await Reject(db => Certificates(db).CreateAsync(NewCert("Invalid") with { Notes = new string('a', 250), Category = "degree", Status = "unverified" }, actor, ct), 400, "Oversized certificate metadata is rejected without truncating JSON");
    await Run(db => Certificates(db).ReviewAsync(degree.CertificateId, new("approve", null), actor, ct));
    await Reject(db => Certificates(db).ReviewAsync(degree.CertificateId, new("reject", "Changed decision"), actor, ct), 409, "Review cannot overwrite an already reviewed certificate");

    var cycle = await Run(db => Cme(db).CreateNewCycleAsync(cert.CertificateId, new(today.AddMonths(-1), today.AddMonths(1)), ct));
    var otherCert = await Run(db => Certificates(db).CreateAsync(NewCert("Chứng chỉ thứ hai"), actor, ct));
    var otherCycle = await Run(db => Cme(db).CreateNewCycleAsync(otherCert.CertificateId, new(today.AddMonths(-1), today.AddMonths(1)), ct));
    await Reject(db => Cme(db).UpdateCycleDatesAsync(cert.CertificateId, new(default, today), ct), 400, "Cycle date update rejects omitted start date");
    await Reject(db => Cme(db).CreateNewCycleAsync(cert.CertificateId, new(default(DateOnly), today), ct), 400, "New cycle rejects default start date");
    SaveCmeRecordRequest Record(decimal credits = 1m, bool verified = false, Guid? cycleId = null) => new(cert.CertificateId, "Đào tạo nghiệp vụ", "VNC", today, credits, null, verified, cycleId ?? cycle.CycleId);
    await Reject(db => Cme(db).CreateAsync(Record(cycleId: otherCycle.CycleId), actor, ct), 400, "CME cannot reference another certificate's cycle");
    await Reject(db => Cme(db).CreateAsync(Record(cycleId: Guid.NewGuid()), actor, ct), 400, "Invalid explicit CME cycle does not silently select latest");
    await Reject(db => Cme(db).CreateAsync(Record(0.499m), actor, ct), 400, "Fractional credit is validated before rounding");
    await Reject(db => Cme(db).CreateAsync(Record() with { CompletedDate = default }, actor, ct), 400, "CME rejects omitted completion date");
    await Reject(db => Cme(db).UpdateCycleDatesAsync(cert.CertificateId, new(today.AddDays(-1), today.AddDays(1), otherCycle.CycleId), ct), 400, "Cycle date edit rejects foreign cycle ID");
    await Reject(db => Cme(db).CompleteCycleAsync(cert.CertificateId, otherCycle.CycleId, ct), 400, "Cycle locking rejects foreign cycle ID");
    var record = await Run(db => Cme(db).CreateAsync(Record(), actor, ct));
    await Reject(db => Cme(db).CompleteCycleAsync(cert.CertificateId, cycle.CycleId, ct), 400, "Pending CME credits cannot satisfy cycle locking");
    var dates = await Run(db => Cme(db).UpdateCycleDatesAsync(cert.CertificateId, new(today.AddMonths(-2), today.AddMonths(2), cycle.CycleId), ct));
    Check(dates.EarnedCredits == 0, "Changing cycle dates does not count pending credits");
    await Run(db => Cme(db).VerifyAsync(record.CmeId, true, actor, ct));
    var locked = await Run(db => Cme(db).CompleteCycleAsync(cert.CertificateId, cycle.CycleId, ct));
    Check(locked.CycleStatus == "locked" && locked.EarnedCredits == 1m, "Verified credits allow locking");
    await Reject(db => Cme(db).VerifyAsync(record.CmeId, false, actor, ct), 400, "Locked CME cannot be unverified");
    await Reject(db => Cme(db).UpdateAsync(record.CmeId, new(otherCert.CertificateId, "Di chuyển", null, today, 1m, null, null, otherCycle.CycleId), actor, ct), 400, "Moving CME cannot bypass source cycle lock");
    await Reject(db => Cme(db).DeleteAsync(record.CmeId, ct), 400, "Locked CME cannot be deleted");
    await Reject(db => Certificates(db).DeleteAsync(cert.CertificateId, ct), 409, "Deleting parent certificate cannot erase locked CME history");
    var updateCert = new UpdateCertificateRequest(null, "certificate", "Chứng chỉ bác sĩ", null, cert.IssueDate, null, null, 24, 2m, "active", null, department);
    await Reject(db => Certificates(db).UpdateAsync(cert.CertificateId, updateCert, ct), 409, "Locked cycle requirements cannot be changed through parent certificate");
    Check(await Run(db => db.CmeRecords.CountAsync(r => r.CertificateId == cert.CertificateId)) == 1, "Rejected mutations preserve locked CME records");

    SaveProcedureSlipRequest Procedure(IReadOnlyList<SaveProcedureAssignmentInput>? assignments = null) => new(
        procedureService, department, "BR-SLIP", today, null, 100_000m, 10_000m, false, 1m, null,
        assignments ?? [new(staff1, "performing", 1000m)]);
    var lookups = await Run(db => Procedures(db).GetLookupsAsync(user1, ct));
    Check(lookups.Services.Count == 1, "Procedure form lists configured active services beyond demo codes");
    Check(await Run(db => db.ProcedureServices.CountAsync()) == 2 && await Run(db => db.CommissionRules.CountAsync()) == 0,
        "Opening procedure form never inserts demo services or commission rules");
    Check(await Run(db => db.ProcedureServices.Where(s => s.ServiceCode == "TT-MAU-01").Select(s => s.Status).SingleAsync()) == "inactive",
        "Opening procedure form never reactivates an inactive service");
    await Reject(db => Procedures(db).CreateSlipAsync(user1, "employee", Procedure([new(staff1, "performing"), new(staff1, "PERFORMING")]), ct), 400, "Procedure rejects repeated staff and role before duplicate payout");
    await Execute(async db => { var staff = await db.Staff.FindAsync(staff2); staff!.Status = "inactive"; await db.SaveChangesAsync(); });
    await Reject(db => Procedures(db).CreateSlipAsync(user1, "employee", Procedure([new(staff2, "performing")]), ct), 400, "Procedure rejects inactive participants");
    await Execute(async db => { var staff = await db.Staff.FindAsync(staff2); staff!.Status = "active"; staff.DateJoined = today.AddDays(1); await db.SaveChangesAsync(); });
    await Reject(db => Procedures(db).CreateSlipAsync(user1, "employee", Procedure([new(staff2, "performing")]), ct), 400, "Procedure rejects work before participant's joining date");
    var slip = await Run(db => Procedures(db).CreateSlipAsync(user1, "employee", Procedure(), ct));
    Check(slip.Status == "pending" && slip.Assignments.Count == 1, "Valid procedure creates pending assignments");
    await Reject(db => Procedures(db).VerifySlipAsync(actor, "accountant", slip.SlipId, new("approve"), ct), 409, "Accountant cannot bypass HR approval");
    var hrChecked = await Run(db => Procedures(db).HrCheckSlipAsync(actor, "hr_staff", slip.SlipId, new("approve"), ct));
    Check(hrChecked.Status == "hr_checked", "HR approval advances procedure to accountant stage");
    await Reject(db => Procedures(db).UpdateSlipAsync(user1, "employee", slip.SlipId, Procedure(), ct), 409, "Creator cannot edit after HR approval");
    var verified = await Run(db => Procedures(db).VerifySlipAsync(actor, "accountant", slip.SlipId, new("approve"), ct));
    Check(verified.Status == "verified", "Accountant can approve after HR stage");
    await Reject(db => Procedures(db).VerifySlipAsync(actor, "accountant", slip.SlipId, new("reject", "Test rejection"), ct), 409, "Reviewed procedure cannot be overwritten by a repeated decision");
    await Reject(db => Procedures(db).CalculateMonthlyCommissionAsync(actor, new("0000-01"), ct), 400, "Commission calculation rejects year zero");
    var maxMonth = await Run(db => Procedures(db).CalculateMonthlyCommissionAsync(actor, new("9999-12"), ct));
    Check(maxMonth.AssignmentCount == 0, "Last valid calendar month does not overflow during commission calculation");
    Console.WriteLine($"Passed {passed} business rule checks.");
}
finally
{
    if (created && databaseName.StartsWith(prefix, StringComparison.Ordinal) && databaseName.Length == prefix.Length + 32)
    {
        await using var cleanup = new AppDbContext(options);
        await cleanup.Database.EnsureDeletedAsync();
        Console.WriteLine("Removed owned test database.");
    }
}

sealed class TestFiles : IFileService
{
    public int Calls { get; private set; }
    public Task<UploadFileResponse> UploadAsync(Stream stream, string fileName, string contentType, long length, CancellationToken ct)
    {
        Calls++;
        return Task.FromResult(new UploadFileResponse("test", "/api/files/test.png", "image", length));
    }
}
