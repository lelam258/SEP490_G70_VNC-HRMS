using System.Reflection;
using Microsoft.AspNetCore.Authorization;
using Vnc.HRMS.Common.Exceptions;
using Vnc.HRMS.Controllers;
using Vnc.HRMS.DTOs.Employees;
using Vnc.HRMS.Services.Rules;

static void Check(bool ok, string name) { if (!ok) throw new Exception(name); Console.WriteLine($"PASS {name}"); }
static void Reject(Action action, int status, string name)
{
    var rejected = false;
    try { action(); } catch (AppException e) { rejected = e.StatusCode == status; }
    Check(rejected, name);
}

var today = new DateOnly(2026, 11, 4);

// ---- Displayed status (task 20 list, task 22 detail) ----
Check(ContractRules.DisplayStatus("active", new(2025, 1, 1), null, today) == "active", "Indefinite contract stays active");
Check(ContractRules.DisplayStatus("active", new(2025, 1, 1), new(2026, 11, 3), today) == "expired", "Ended yesterday is expired");
Check(ContractRules.DisplayStatus("active", new(2025, 1, 1), today, today) == "expiring", "Ending today is expiring, not expired");
Check(ContractRules.DisplayStatus("active", new(2025, 1, 1), today.AddDays(30), today) == "expiring", "Ending in 30 days is expiring");
Check(ContractRules.DisplayStatus("active", new(2025, 1, 1), today.AddDays(31), today) == "active", "Ending in 31 days is active");
Check(ContractRules.DisplayStatus("active", today.AddDays(1), null, today) == "upcoming", "Starting tomorrow is upcoming");
Check(ContractRules.DisplayStatus("inactive", new(2025, 1, 1), null, today) == "inactive", "Stored inactive wins over dates");

// ---- Term vs contract type (tasks 21, 23) ----
ContractRules.EnsureTerm(ContractRules.Indefinite, new(2025, 1, 1), null);
Check(true, "Indefinite contract without end date accepted");
ContractRules.EnsureTerm("Hợp đồng xác định thời hạn (12 tháng)", new(2026, 1, 1), new(2026, 12, 31));
Check(true, "Legacy fixed-term label with end date accepted");
Reject(() => ContractRules.EnsureTerm(ContractRules.Indefinite, new(2025, 1, 1), new(2026, 1, 1)), 400, "Indefinite contract rejects end date");
Reject(() => ContractRules.EnsureTerm(ContractRules.FixedTerm, new(2025, 1, 1), null), 400, "Fixed-term contract requires end date");
Reject(() => ContractRules.EnsureTerm(ContractRules.Probation, new(2025, 2, 1), new(2025, 1, 1)), 400, "End before start rejected");
Reject(() => ContractRules.EnsureTerm(ContractRules.Indefinite, default, null), 400, "Missing start date rejected");

// ---- Salary derived from base salary (task 21) ----
Check(ContractRules.SalaryFromBase("monthly", 4_718_700m, 26m) == (181_488.46m, 4_718_700m), "Monthly base salary derives daily rate");
Check(ContractRules.SalaryFromBase("daily", 1_000_000m, 26m) == (1_000_000m, 26_000_000m), "Daily rate derives monthly salary");
Reject(() => ContractRules.SalaryFromBase("monthly", 0m, 26m), 400, "Zero base salary rejected");
Reject(() => ContractRules.SalaryFromBase("monthly", 5_000_000m, 0m), 400, "Zero standard working days rejected");
Reject(() => ContractRules.SalaryFromBase("monthly", 5_000_000m, 32m), 400, "More than 31 standard working days rejected");

// ---- Payroll rate parameter values (duty multiplier may exceed 100%) ----
PayrollParameterRules.EnsureRateConfigValue("percent", 150m, "Giá trị tham số");
Check(true, "After-hours duty multiplier 150% accepted");
PayrollParameterRules.EnsureRateConfigValue("percent", 500m, "Giá trị tham số");
Check(true, "Rate percent at 500% cap accepted");
Reject(() => PayrollParameterRules.EnsureRateConfigValue("percent", 500.1m, "Giá trị tham số"), 400, "Rate percent above 500% rejected");
Reject(() => PayrollParameterRules.EnsureRateConfigValue("percent", -1m, "Giá trị tham số"), 400, "Negative rate percent rejected");
PayrollParameterRules.EnsureRateConfigValue("vnd", 200_000m, "Giá trị tham số");
Check(true, "VND duty rate accepted");
Reject(() => PayrollParameterRules.EnsureTypedValue("percent", 150m, "Tỷ lệ"), 400, "Insurance/tax/allowance percent still capped at 100%");

// ---- Approved leave is unpaid unless its leave type is configured as paid ----
var octStart = new DateOnly(2026, 10, 1); var octEnd = new DateOnly(2026, 10, 31);
Vnc.HRMS.Models.LeaveRequest Leave(string type) => new()
{
    RequestId = Guid.NewGuid(), StaffId = Guid.NewGuid(), LeaveType = type,
    StartDate = new(2026, 10, 5), EndDate = new(2026, 10, 5), TotalDays = 1m, Status = "approved"
};
PayrollPeriodRules.StaffAttendanceCalculationMetrics LeaveMetrics(string type, Dictionary<string, bool> isPaid)
    => PayrollPeriodRules.ComputeStaffAttendanceMetrics(octStart, octEnd, [], [], [Leave(type)], isPaid);
var unknownType = LeaveMetrics("legacy_type", new() { ["unpaid"] = false });
Check(unknownType.PaidLeaveDays == 0m && unknownType.UnpaidLeaveDays == 1m && unknownType.TotalWorkDays == 0m,
    "Leave type missing from the catalogue is unpaid");
var unpaidType = LeaveMetrics("unpaid", new() { ["unpaid"] = false });
Check(unpaidType.PaidLeaveDays == 0m && unpaidType.TotalWorkDays == 0m, "Leave type configured as unpaid earns no workday");
var paidType = LeaveMetrics("personal_paid", new() { ["personal_paid"] = true });
Check(paidType.PaidLeaveDays == 1m && paidType.TotalWorkDays == 1m, "Leave type configured as paid still counts as a workday");

// ---- Expired / inactive contracts cannot receive salary or allowance changes ----
var nov = new DateOnly(2026, 11, 28);
Reject(() => ContractRules.EnsureCompensationEditable("active", new(2025, 7, 1), new(2026, 6, 30), nov), 400, "Expired contract blocks salary/allowance changes");
Reject(() => ContractRules.EnsureCompensationEditable("inactive", new(2026, 1, 1), null, nov), 400, "Inactive contract blocks salary/allowance changes");
ContractRules.EnsureCompensationEditable("active", new(2026, 1, 1), new(2026, 11, 28), nov);
Check(true, "Contract ending today can still be edited");
ContractRules.EnsureCompensationEditable("active", new(2026, 12, 1), null, nov);
Check(true, "Upcoming contract can be set up before it starts");

// ---- Only finalized/locked/exported periods are locked; approved stays editable ----
Check(PayrollPeriodRules.IsLockedStatus("finalized") && PayrollPeriodRules.IsLockedStatus(" Locked ") && PayrollPeriodRules.IsLockedStatus("exported"),
    "Finalized, locked and exported periods are locked");
Check(!PayrollPeriodRules.IsLockedStatus("approved") && !PayrollPeriodRules.IsLockedStatus("draft") && !PayrollPeriodRules.IsLockedStatus(null),
    "Approved and draft periods stay editable");

// ---- Base pay follows the salary history in force on each worked day ----
var octDays = Enumerable.Range(1, 31).Select(d => new DateOnly(2026, 10, d)).Where(d => d.DayOfWeek != DayOfWeek.Sunday).ToList();
Vnc.HRMS.Models.AttendanceRecord Worked(DateOnly d) => new() { AttendanceId = Guid.NewGuid(), WorkDate = d, ShiftType = "main", ActualHours = 8m, ValidationStatus = "confirmed" };
var worked = octDays.Where(d => d.Day <= 12).Take(10).Concat(octDays.Where(d => d.Day >= 16).Take(10)).Select(Worked).ToList();
Vnc.HRMS.DTOs.Payroll.ContractSalarySegmentDto Seg(int from, int to, decimal monthly)
    => new(new(2026, 10, from), new(2026, 10, to), "monthly", 0m, monthly, 26m, null, "progressive", null);
var raised = PayrollPeriodRules.BasePayBySegments([Seg(1, 15, 13_000_000m), Seg(16, 31, 15_600_000m)], 26m, worked, [], new Dictionary<string, bool>());
Check(raised == 11_000_000m, $"Mid-month raise pays 10 days x 500,000 + 10 days x 600,000 (got {raised:N0})");
var unchanged = PayrollPeriodRules.BasePayBySegments([Seg(1, 31, 13_000_000m)], 26m, worked, [], new Dictionary<string, bool>());
Check(unchanged == 10_000_000m, "Without a raise all 20 days use the same rate");
var lateStart = PayrollPeriodRules.BasePayBySegments([Seg(16, 31, 13_000_000m)], 26m, worked, [], new Dictionary<string, bool>());
Check(lateStart == 5_000_000m, "Days worked before the contract starts are not paid");
Check(PayrollPeriodRules.BasePayBySegments([], 26m, worked, [], new Dictionary<string, bool>()) == 0m, "No contract in force means no base pay");

// ---- Access and data exposure ----
var authorize = typeof(ContractsController).GetCustomAttribute<AuthorizeAttribute>();
Check(authorize?.Policy == "HRManager", "Contract API restricted to HR Manager");
var listFields = typeof(ContractListItemDto).GetProperties().Select(p => p.Name).ToArray();
Check(!listFields.Any(n => n.Contains("Salary") && n != "SalaryType" || n.Contains("Rate") || n.Contains("Insurance")),
    "Contract list carries no salary amounts");

Console.WriteLine("All contract rule checks passed.");
