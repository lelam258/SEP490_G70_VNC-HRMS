namespace Vnc.HRMS.Services.Rules;

/// <summary>
/// Business rules for payroll periods consolidation, locking, and reopening.
/// Implements GB-52 (Consolidation and lock schedule) and GB-26 (Controlled corrections / reopen).
/// </summary>
public static class PayrollPeriodRules
{
    public static (int Year, int Month) ParsePayMonth(string payMonth)
    {
        var parts = payMonth.Trim().Split('-');
        return (int.Parse(parts[0]), int.Parse(parts[1]));
    }

    /// <summary>
    /// GB-52: Consolidation opens 2 calendar days before month-end.
    /// E.g. For March (31 days), opens March 29.
    /// </summary>
    public static DateOnly GetConsolidationOpenDate(int year, int month)
    {
        var daysInMonth = DateTime.DaysInMonth(year, month);
        return new DateOnly(year, month, daysInMonth).AddDays(-2);
    }

    /// <summary>
    /// GB-52: Routine editing locks at the end of day 5 of the following month.
    /// E.g. For March 2026, locks at end of April 5, 2026.
    /// </summary>
    public static DateOnly GetStandardLockDate(int year, int month)
    {
        var nextMonth = new DateOnly(year, month, 1).AddMonths(1);
        return new DateOnly(nextMonth.Year, nextMonth.Month, 5);
    }

    /// <summary>
    /// GB-26: Correction deadline is through the end of day 12 of the following month.
    /// E.g. For March 2026, correction deadline is April 12, 2026.
    /// </summary>
    public static DateOnly GetCorrectionDeadline(int year, int month)
    {
        var nextMonth = new DateOnly(year, month, 1).AddMonths(1);
        return new DateOnly(nextMonth.Year, nextMonth.Month, 12);
    }

    /// <summary>
    /// GB-26: Correction window is open from day 6 through end of day 12 of following month.
    /// </summary>
    public static bool IsWithinCorrectionWindow(int year, int month, DateOnly today)
    {
        var nextMonth = new DateOnly(year, month, 1).AddMonths(1);
        var day6 = new DateOnly(nextMonth.Year, nextMonth.Month, 6);
        var day12 = new DateOnly(nextMonth.Year, nextMonth.Month, 12);
        return today >= day6 && today <= day12;
    }

    /// <summary>
    /// GB-26 / MSG48: Returns true if the date is strictly past the correction deadline (day 12 of following month).
    /// </summary>
    public static bool IsAfterCorrectionDeadline(int year, int month, DateOnly today)
    {
        var deadline = GetCorrectionDeadline(year, month);
        return today > deadline;
    }
}

