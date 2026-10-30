using Vnc.HRMS.DTOs.Payroll;
using Vnc.HRMS.Models.Employees;

namespace Vnc.HRMS.Services.Rules;

/// <summary>
/// Pure rules over a contract's salary history. The history is the source of truth for
/// what salary applies on a given date; contract fields only cache the value in force today.
/// </summary>
public static class ContractSalaryRules
{
    /// <summary>The history entry in force on <paramref name="date"/>, or null if none covers it.</summary>
    public static ContractSalaryHistory? EntryOn(IEnumerable<ContractSalaryHistory> histories, DateOnly date)
        => histories
            .Where(h => h.EffectiveFrom <= date && (h.EffectiveTo == null || h.EffectiveTo >= date))
            .OrderByDescending(h => h.EffectiveFrom)
            .ThenByDescending(h => h.CreatedAt)
            .FirstOrDefault();

    /// <summary>The earliest entry starting after <paramref name="date"/> (a scheduled salary change), or null.</summary>
    public static ContractSalaryHistory? NextAfter(IEnumerable<ContractSalaryHistory> histories, DateOnly date)
        => histories
            .Where(h => h.EffectiveFrom > date)
            .OrderBy(h => h.EffectiveFrom)
            .ThenByDescending(h => h.CreatedAt)
            .FirstOrDefault();

    /// <summary>
    /// Salary segments covering [from, to], clipped to that range and ordered by date.
    /// Days not covered by any history entry fall back to the contract's own values,
    /// limited to the contract period, so contracts without history still resolve.
    /// </summary>
    public static ContractSalarySegmentDto[] SegmentsFor(
        Contract contract, IEnumerable<ContractSalaryHistory> histories, DateOnly from, DateOnly to)
    {
        if (to < from) throw new ArgumentException("Range end must not be before its start.", nameof(to));

        var segments = new List<ContractSalarySegmentDto>();
        var ordered = histories
            .Where(h => PayrollParameterRules.PeriodsOverlap(h.EffectiveFrom, h.EffectiveTo, from, to))
            .OrderBy(h => h.EffectiveFrom)
            .ThenBy(h => h.CreatedAt)
            .ToArray();

        // Contract period clipped to the requested range; nothing applies outside it.
        var start = Max(from, contract.EffectiveFrom);
        var end = contract.EffectiveTo is { } contractEnd && contractEnd < to ? contractEnd : to;
        var cursor = start;

        foreach (var h in ordered)
        {
            if (cursor > end) break;
            var segFrom = Max(cursor, h.EffectiveFrom);
            var segTo = h.EffectiveTo is { } hEnd && hEnd < end ? hEnd : end;
            if (segTo < segFrom) continue;

            if (segFrom > cursor) segments.Add(FromContract(contract, cursor, segFrom.AddDays(-1)));
            segments.Add(new ContractSalarySegmentDto(
                segFrom, segTo, h.SalaryType, h.DailyRate, h.MonthlySalary, h.StandardWorkingDays,
                h.IsInsuranceEligible ? h.InsuranceSalaryBasis : null, h.TaxMethod, h.HistoryId));
            cursor = segTo.AddDays(1);
        }

        if (cursor <= end) segments.Add(FromContract(contract, cursor, end));
        return segments.ToArray();
    }

    private static ContractSalarySegmentDto FromContract(Contract c, DateOnly from, DateOnly to)
        => new(from, to, c.SalaryType ?? "daily", c.DailyRate, c.MonthlySalary, c.StandardWorkingDays,
            c.IsInsuranceEligible ? c.InsuranceSalaryBasis : null, c.TaxMethod ?? "progressive", null);

    private static DateOnly Max(DateOnly a, DateOnly b) => a > b ? a : b;
}
