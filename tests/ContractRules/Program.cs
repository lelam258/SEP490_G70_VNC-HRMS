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

// ---- Access and data exposure ----
var authorize = typeof(ContractsController).GetCustomAttribute<AuthorizeAttribute>();
Check(authorize?.Policy == "HRManager", "Contract API restricted to HR Manager");
var listFields = typeof(ContractListItemDto).GetProperties().Select(p => p.Name).ToArray();
Check(!listFields.Any(n => n.Contains("Salary") && n != "SalaryType" || n.Contains("Rate") || n.Contains("Insurance")),
    "Contract list carries no salary amounts");

Console.WriteLine("All contract rule checks passed.");
