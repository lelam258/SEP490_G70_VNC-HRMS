using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Vnc.HRMS.Common.Exceptions;
using Vnc.HRMS.DTOs.Employees;
using Vnc.HRMS.Models;
using Vnc.HRMS.Models.Employees;
using Vnc.HRMS.Models.Organization;
using Vnc.HRMS.Models.Users;
using Vnc.HRMS.Persistence;
using Vnc.HRMS.Repositories;
using Vnc.HRMS.Services;
using Vnc.HRMS.Services.Rules;

// This test owns a new, uniquely named database. It never uses the application database.
var databaseName = "VNC_Contract_Test_" + Guid.NewGuid().ToString("N");
var connection = new SqlConnectionStringBuilder { DataSource = "localhost", InitialCatalog = databaseName, IntegratedSecurity = true, TrustServerCertificate = true }.ConnectionString;
var options = new DbContextOptionsBuilder<AppDbContext>().UseSqlServer(connection).Options;
var created = false;
var ct = CancellationToken.None;
var today = PayrollParameterRules.TodayVn();
var hrUser = Guid.NewGuid(); var user1 = Guid.NewGuid(); var user2 = Guid.NewGuid(); var user3 = Guid.NewGuid();
var staff1 = Guid.NewGuid(); var staff2 = Guid.NewGuid(); var leftStaff = Guid.NewGuid(); var department = Guid.NewGuid();

static void Check(bool ok, string name) { if (!ok) throw new Exception(name); Console.WriteLine("PASS " + name); }
async Task<T> Run<T>(Func<ContractService, Task<T>> action)
{
    await using var db = new AppDbContext(options);
    var service = new ContractService(new ContractRepository(db), new PayrollParameterRepository(db), new UnitOfWork(db),
        new AuditLogHelper(db, new HttpContextAccessor()));
    return await action(service);
}
async Task Reject<T>(Func<ContractService, Task<T>> action, int status, string name)
{
    try { await Run(action); } catch (AppException e) when (e.StatusCode == status) { Check(true, name); return; }
    throw new Exception("Expected rejection: " + name);
}
CreateContractRequest NewContract(Guid staff, string code, string type, DateOnly from, DateOnly? to, decimal salary = 4_718_700m, string salaryType = "monthly")
    => new(staff, code, type, salaryType, salary, 26m, from, to, null);

try
{
    await using (var seed = new AppDbContext(options))
    {
        created = await seed.Database.EnsureCreatedAsync();
        if (!created) throw new Exception("Refusing to use an existing database.");
        seed.Users.AddRange(
            new User { UserId = hrUser, Username = "hr.test", NormalizedUsername = "HR.TEST", Role = "hr_manager", Email = "hr@test.invalid" },
            new User { UserId = user1, Username = "s1.test", NormalizedUsername = "S1.TEST", Role = "employee", Email = "s1@test.invalid" },
            new User { UserId = user2, Username = "s2.test", NormalizedUsername = "S2.TEST", Role = "employee", Email = "s2@test.invalid" },
            new User { UserId = user3, Username = "s3.test", NormalizedUsername = "S3.TEST", Role = "employee", Email = "s3@test.invalid" });
        seed.Departments.Add(new Department { DepartmentId = department, DeptCode = "XN", Name = "Xét nghiệm" });
        seed.Staff.AddRange(
            new Staff { StaffId = staff1, UserId = user1, StaffCode = "T01", FullName = "Nhân viên Một", DepartmentId = department, DateJoined = new(2024, 1, 1) },
            new Staff { StaffId = staff2, UserId = user2, StaffCode = "T02", FullName = "Nhân viên Hai", DepartmentId = department, DateJoined = new(2024, 1, 1) },
            new Staff { StaffId = leftStaff, UserId = user3, StaffCode = "T03", FullName = "Nhân viên Đã nghỉ", DateJoined = new(2024, 1, 1), Status = "inactive" });
        seed.PayrollLocks.Add(new PayrollLock { LockId = Guid.NewGuid(), PayMonth = "2025-03", Status = "finalized", LockedBy = hrUser, LockedAt = DateTime.UtcNow });
        await seed.SaveChangesAsync();
    }

    // ---- Task 21: create ----
    var indefinite = await Run(s => s.CreateAsync(NewContract(staff1, "0925/hđlđ-vn", ContractRules.Indefinite, new(2025, 1, 1), null), ct));
    Check(indefinite.ContractCode == "0925/HĐLĐ-VN" && indefinite.EffectiveTo is null && indefinite.DisplayStatus == "active", "Indefinite monthly contract created with normalized code");
    Check(indefinite.MonthlySalary == 4_718_700m && indefinite.DailyRate == 181_488.46m && indefinite.InsuranceSalaryBasis == 4_718_700m, "Daily rate and insurance basis derived from base salary");
    await Reject(s => s.CreateAsync(NewContract(staff2, "0925/HĐLĐ-VN", ContractRules.Indefinite, new(2025, 1, 1), null), ct), 409, "Duplicate contract code rejected");
    await Reject(s => s.CreateAsync(NewContract(staff1, "HD-OVERLAP", ContractRules.FixedTerm, today, today.AddMonths(6)), ct), 409, "Overlapping active contract for same staff rejected");
    await Reject(s => s.CreateAsync(NewContract(leftStaff, "HD-LEFT", ContractRules.Indefinite, today, null), ct), 400, "Contract for inactive staff rejected");
    await Reject(s => s.CreateAsync(NewContract(Guid.NewGuid(), "HD-NONE", ContractRules.Indefinite, today, null), ct), 404, "Contract for unknown staff rejected");
    await Reject(s => s.CreateAsync(NewContract(staff2, "HD-NOEND", ContractRules.FixedTerm, today, null), ct), 400, "Fixed-term contract without end date rejected");
    await Reject(s => s.CreateAsync(NewContract(staff2, "HD-ZERO", ContractRules.Indefinite, today, null, 0m), ct), 400, "Zero salary rejected");

    var fixedTerm = await Run(s => s.CreateAsync(NewContract(staff2, "HD-2025/T02", ContractRules.FixedTerm, new(2025, 1, 1), new(2025, 6, 30), 1_000_000m, "daily"), ct));
    Check(fixedTerm.DisplayStatus == "expired" && fixedTerm.DailyRate == 1_000_000m && fixedTerm.MonthlySalary == 26_000_000m, "Past fixed-term daily contract shows expired");

    // ---- Task 20: list ----
    var list = await Run(s => s.ListAsync(ct));
    Check(list.Length == 2 && list.Any(x => x.ContractCode == "0925/HĐLĐ-VN" && x.DepartmentName == "Xét nghiệm" && x.DisplayStatus == "active"), "List returns contracts with department and derived status");
    var json = JsonSerializer.Serialize(list);
    Check(!json.Contains("4718700") && !json.Contains("DailyRate") && !json.Contains("MonthlySalary"), "List response contains no salary amounts");

    // ---- Task 22: detail ----
    var detail = await Run(s => s.GetAsync(indefinite.ContractId, ct));
    Check(detail.StaffCode == "T01" && detail.SalaryType == "monthly" && detail.MonthlySalary == 4_718_700m, "Detail returns staff and salary terms");
    await Reject(s => s.GetAsync(Guid.NewGuid(), ct), 404, "Unknown contract returns 404");

    // ---- Task 23: edit ----
    UpdateContractRequest Edit(ContractDetailDto c, DateOnly from, DateOnly? to, string status = "active", string? code = null, string? type = null)
        => new(code ?? c.ContractCode, type ?? c.ContractType, from, to, status, "https://files.test/hd.pdf");
    var edited = await Run(s => s.UpdateAsync(indefinite.ContractId, Edit(indefinite, indefinite.EffectiveFrom, null, code: "0925/HĐLĐ-VN-01"), ct));
    Check(edited.ContractCode == "0925/HĐLĐ-VN-01" && edited.FileUrl == "https://files.test/hd.pdf" && edited.MonthlySalary == 4_718_700m, "Edit updates code and file without touching salary");
    await Reject(s => s.UpdateAsync(indefinite.ContractId, Edit(edited, edited.EffectiveFrom, null, code: "HD-2025/T02"), ct), 409, "Edit rejects another contract's code");
    await Reject(s => s.UpdateAsync(indefinite.ContractId, Edit(edited, edited.EffectiveFrom, today, type: ContractRules.Indefinite), ct), 400, "Indefinite contract cannot get an end date");

    // Locked month 2025-03 is covered by the fixed-term contract.
    await Reject(s => s.UpdateAsync(fixedTerm.ContractId, Edit(fixedTerm, new(2025, 2, 1), fixedTerm.EffectiveTo), ct), 409, "Start date cannot move once a locked month is paid");
    await Reject(s => s.UpdateAsync(fixedTerm.ContractId, Edit(fixedTerm, fixedTerm.EffectiveFrom, new(2025, 2, 28)), ct), 409, "End date cannot cut into a locked month");

    await using (var db = new AppDbContext(options))
    {
        db.ContractSalaryHistories.Add(new ContractSalaryHistory { HistoryId = Guid.NewGuid(), ContractId = fixedTerm.ContractId, SalaryType = "daily", DailyRate = 1_100_000m,
            StandardWorkingDays = 26m, EffectiveFrom = new(2025, 5, 1), EffectiveTo = new(2025, 6, 30), Note = "test" });
        await db.SaveChangesAsync();
    }
    var extended = await Run(s => s.UpdateAsync(fixedTerm.ContractId, Edit(fixedTerm, fixedTerm.EffectiveFrom, new(2025, 12, 31)), ct));
    await using (var db = new AppDbContext(options))
    {
        var history = await db.ContractSalaryHistories.SingleAsync(h => h.ContractId == fixedTerm.ContractId);
        Check(extended.EffectiveTo == new DateOnly(2025, 12, 31) && history.EffectiveTo == new DateOnly(2025, 12, 31), "Extending the contract extends its open salary history");
    }
    await Reject(s => s.UpdateAsync(fixedTerm.ContractId, Edit(extended, extended.EffectiveFrom, new(2025, 4, 30)), ct), 409, "Shortening before a recorded salary change rejected");

    var deactivated = await Run(s => s.UpdateAsync(indefinite.ContractId, Edit(edited, edited.EffectiveFrom, null, status: "inactive"), ct));
    Check(deactivated.DisplayStatus == "inactive", "Contract can be deactivated");
    var replacement = await Run(s => s.CreateAsync(NewContract(staff1, "HD-NEW/T01", ContractRules.Indefinite, today, null), ct));
    Check(replacement.DisplayStatus == "active", "New contract allowed once the previous one is inactive");
    await Reject(s => s.UpdateAsync(indefinite.ContractId, Edit(deactivated, deactivated.EffectiveFrom, null), ct), 409, "Reactivating would overlap the new contract and is rejected");

    await using (var db = new AppDbContext(options))
        Check(await db.AuditLogs.CountAsync(a => a.EntityType == "Contract") >= 6, "Create and update are audited");
}
finally
{
    if (created && databaseName.StartsWith("VNC_Contract_Test_") && databaseName.Length == 50)
    {
        await using var cleanup = new AppDbContext(options);
        await cleanup.Database.EnsureDeletedAsync();
        Console.WriteLine("Removed owned test database.");
    }
}
