using Vnc.HRMS.DTOs.Payroll;
using Vnc.HRMS.Models;
using Vnc.HRMS.Models.Organization;

namespace Vnc.HRMS.Services.Rules;

/// <summary>
/// Business rules for payroll periods consolidation, calculation, review, locking, and reopening.
/// Implements GB-52 (Consolidation and lock schedule) and GB-26 (Controlled corrections / reopen).
/// </summary>
public static class PayrollPeriodRules
{
    public static readonly string[] ValidReviewStatuses =
    [
        "pending",
        "reviewed",
        "needs_hr",
        "needs_attendance",
        "needs_procedure"
    ];

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

    /// <summary>
    /// Decodes per-payslip accountant review state stored in DeptApprovedAt / DeptRejectedReason.
    /// </summary>
    public static (string ReviewStatus, string? ReviewNote) ParseReviewState(
        string? payslipStatus,
        DateTime? deptApprovedAt,
        string? deptRejectedReason)
    {
        if (!string.IsNullOrWhiteSpace(deptRejectedReason))
        {
            var trimmed = deptRejectedReason.Trim();
            foreach (var status in ValidReviewStatuses)
            {
                var prefix = $"[{status}]";
                if (trimmed.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
                {
                    var note = trimmed[prefix.Length..].Trim();
                    return (status, string.IsNullOrWhiteSpace(note) ? null : note);
                }
            }
            return ("needs_hr", trimmed);
        }

        if (deptApprovedAt.HasValue)
        {
            return ("reviewed", null);
        }

        var norm = payslipStatus?.Trim().ToLowerInvariant();
        if (norm is "approved" or "finalized" or "locked")
        {
            return ("reviewed", null);
        }

        return ("pending", null);
    }

    public static string? EncodeReviewReason(string reviewStatus, string? note)
    {
        var trimmed = string.IsNullOrWhiteSpace(note) ? null : note.Trim();
        if (reviewStatus == "reviewed")
        {
            return trimmed is null ? null : $"[reviewed] {trimmed}";
        }
        return trimmed is null ? $"[{reviewStatus}]" : $"[{reviewStatus}] {trimmed}";
    }

    public sealed record StaffAttendanceCalculationMetrics(
        decimal MainWorkDays,
        decimal PaidLeaveDays,
        decimal UnpaidLeaveDays,
        decimal TotalWorkDays,
        decimal NoonDutyCount,
        decimal EveningDutyCount,
        decimal OvertimeHours,
        decimal OnCallDays,
        bool HasUnconfirmedAttendance
    );

    /// <summary>
    /// Aggregates confirmed workdays, duties, overtime hours, and approved leave for a single staff member in a month.
    /// Implements GB-09 / GB-16: only confirmed attendance/on-call records and approved leaves count toward payroll.
    /// </summary>
    public static StaffAttendanceCalculationMetrics ComputeStaffAttendanceMetrics(
        DateOnly monthStart,
        DateOnly monthEnd,
        IEnumerable<AttendanceRecord> records,
        IEnumerable<OnCallShift> onCallShifts,
        IEnumerable<LeaveRequest> approvedLeaves,
        IReadOnlyDictionary<string, bool> leaveTypesIsPaid)
    {
        var recList = records as IReadOnlyList<AttendanceRecord> ?? records.ToArray();
        var shiftList = onCallShifts as IReadOnlyList<OnCallShift> ?? onCallShifts.ToArray();

        var confirmedMain = recList
            .Where(r => r.ValidationStatus == "confirmed" && (string.IsNullOrEmpty(r.ShiftType) || r.ShiftType == "main"))
            .ToArray();

        decimal mainWorkDays = 0m;
        decimal overtimeFromMain = 0m;
        var mainDates = new HashSet<DateOnly>();

        foreach (var dayGroup in confirmedMain.GroupBy(r => r.WorkDate))
        {
            mainDates.Add(dayGroup.Key);
            var dayHours = dayGroup.Sum(x => x.ActualHours ?? 8m);
            mainWorkDays += (dayHours > 0m && dayHours <= 4.5m) ? 0.5m : 1.0m;
            if (dayHours > 8m)
            {
                overtimeFromMain += dayHours - 8m;
            }
        }

        var leaveDates = new HashSet<DateOnly>();
        decimal paidLeaveDays = 0m;
        decimal unpaidLeaveDays = 0m;
        foreach (var lv in approvedLeaves)
        {
            var isPaid = !leaveTypesIsPaid.TryGetValue(lv.LeaveType, out var paidFlag) || paidFlag;
            var from = lv.StartDate < monthStart ? monthStart : lv.StartDate;
            var to = lv.EndDate > monthEnd ? monthEnd : lv.EndDate;
            var singleHalfDay = lv.StartDate == lv.EndDate
                && lv.TotalDays.HasValue && lv.TotalDays.Value > 0m && lv.TotalDays.Value < 1m
                ? lv.TotalDays.Value
                : 1.0m;

            for (var d = from; d <= to; d = d.AddDays(1))
            {
                if (d.DayOfWeek == DayOfWeek.Sunday) continue;
                if (!leaveDates.Add(d)) continue;

                if (isPaid)
                {
                    if (!mainDates.Contains(d))
                    {
                        paidLeaveDays += singleHalfDay;
                    }
                }
                else
                {
                    unpaidLeaveDays += singleHalfDay;
                }
            }
        }

        var noonDates = recList
            .Where(r => r.ValidationStatus == "confirmed" && r.ShiftType == "noon")
            .Select(r => r.WorkDate)
            .Concat(shiftList.Where(o => o.Status == "confirmed" && o.ShiftCategory == "noon").Select(o => o.ShiftDate))
            .Distinct()
            .Count();

        var eveningDates = recList
            .Where(r => r.ValidationStatus == "confirmed" && r.ShiftType == "evening")
            .Select(r => r.WorkDate)
            .Concat(shiftList.Where(o => o.Status == "confirmed" && o.ShiftCategory == "evening").Select(o => o.ShiftDate))
            .Distinct()
            .Count();

        var overtimeFromExtraRecords = recList
            .Where(r => r.ValidationStatus == "confirmed" && r.ShiftType == "overtime")
            .Sum(r => r.ActualHours ?? 0m);

        var overtimeFromShifts = shiftList
            .Where(o => o.Status == "confirmed" && o.ShiftCategory == "overtime" && o.ShiftStart.HasValue && o.ShiftEnd.HasValue)
            .Sum(o => Math.Round((decimal)(o.ShiftEnd!.Value - o.ShiftStart!.Value).TotalHours, 2, MidpointRounding.AwayFromZero));

        decimal totalOvertimeHours = Math.Round(overtimeFromMain + overtimeFromExtraRecords + overtimeFromShifts, 2, MidpointRounding.AwayFromZero);
        decimal totalWorkDays = mainWorkDays + paidLeaveDays;
        decimal onCallDays = noonDates + eveningDates;
        bool hasUnconfirmed = recList.Any(r => r.ValidationStatus != "confirmed")
            || shiftList.Any(o => o.Status != "confirmed");

        return new StaffAttendanceCalculationMetrics(
            MainWorkDays: mainWorkDays,
            PaidLeaveDays: paidLeaveDays,
            UnpaidLeaveDays: unpaidLeaveDays,
            TotalWorkDays: totalWorkDays,
            NoonDutyCount: noonDates,
            EveningDutyCount: eveningDates,
            OvertimeHours: totalOvertimeHours,
            OnCallDays: onCallDays,
            HasUnconfirmedAttendance: hasUnconfirmed
        );
    }

    public sealed record AllowanceSplitResult(
        decimal NoonDutyPay,
        decimal EveningDutyPay,
        decimal OvertimePay,
        decimal OnCallPay,
        decimal PureAllowanceTotal,
        List<PayslipAllowanceItemDto> PureAllowances,
        decimal NoonDutyCount = 0m,
        decimal EveningDutyCount = 0m
    );

    public static decimal ParseDutyCountFromName(string lineName)
    {
        var openIdx = lineName.LastIndexOf('(');
        var closeIdx = lineName.LastIndexOf(')');
        if (openIdx < 0 || closeIdx <= openIdx) return 0m;

        var inner = lineName[(openIdx + 1)..closeIdx].Trim();
        var numPart = inner.Split(' ', StringSplitOptions.RemoveEmptyEntries).FirstOrDefault();
        if (string.IsNullOrWhiteSpace(numPart)) return 0m;

        return decimal.TryParse(
            numPart.Replace(',', '.'),
            System.Globalization.NumberStyles.Number,
            System.Globalization.CultureInfo.InvariantCulture,
            out var count) && count >= 0m
            ? count
            : 0m;
    }

    public static AllowanceSplitResult SplitPayslipAllowances(
        IEnumerable<PayslipAllowance> lines,
        decimal storedAllowanceTotal)
    {
        decimal noonPay = 0m;
        decimal eveningPay = 0m;
        decimal overtimePay = 0m;
        decimal noonCount = 0m;
        decimal eveningCount = 0m;
        var pureItems = new List<PayslipAllowanceItemDto>();

        foreach (var line in lines)
        {
            if (line.AllowanceId is null && line.Name.StartsWith("Tiền trực tối", StringComparison.OrdinalIgnoreCase))
            {
                eveningPay += line.Amount;
                eveningCount += ParseDutyCountFromName(line.Name);
            }
            else if (line.AllowanceId is null && line.Name.StartsWith("Tiền trực trưa", StringComparison.OrdinalIgnoreCase))
            {
                noonPay += line.Amount;
                noonCount += ParseDutyCountFromName(line.Name);
            }
            else if (line.AllowanceId is null
                && (line.Name.StartsWith("Tiền trực ngoài giờ", StringComparison.OrdinalIgnoreCase)
                    || line.Name.StartsWith("Tiền làm thêm giờ", StringComparison.OrdinalIgnoreCase)))
            {
                overtimePay += line.Amount;
            }
            else
            {
                pureItems.Add(new PayslipAllowanceItemDto(line.Id, line.AllowanceId, line.Name, line.Amount));
            }
        }

        decimal onCallPay = noonPay + eveningPay;
        decimal pureTotal = pureItems.Count > 0
            ? pureItems.Sum(x => x.Amount)
            : Math.Max(0m, storedAllowanceTotal - onCallPay - overtimePay);

        return new AllowanceSplitResult(
            noonPay, eveningPay, overtimePay, onCallPay, pureTotal, pureItems, noonCount, eveningCount);
    }

    public static bool IsDoctorPosition(Position? position)
        => position is not null
            && (string.Equals(position.ScopeTag, "doctor", StringComparison.OrdinalIgnoreCase)
                || position.Name.Contains("Bác sĩ", StringComparison.OrdinalIgnoreCase)
                || position.Name.Contains("Giám đốc", StringComparison.OrdinalIgnoreCase));

    public static decimal ResolveRate(
        IReadOnlyList<PayrollRateConfig> configs,
        string code,
        Guid staffId,
        Guid? positionId,
        IReadOnlyDictionary<Guid, Position> positionsById,
        bool isDoctorPosition,
        decimal fallback)
    {
        var matching = configs
            .Where(r => string.Equals(r.Code, code, StringComparison.OrdinalIgnoreCase))
            .OrderByDescending(r => r.EffectiveFrom)
            .ToArray();

        if (matching.Length == 0) return fallback;

        var byStaff = matching.FirstOrDefault(r => r.StaffId == staffId);
        if (byStaff is not null) return byStaff.Value;

        if (positionId.HasValue)
        {
            var byPos = matching.FirstOrDefault(r => r.StaffId == null && r.PositionId == positionId.Value);
            if (byPos is not null) return byPos.Value;
        }

        if (isDoctorPosition)
        {
            var byDoctorPos = matching.FirstOrDefault(r =>
                r.StaffId == null && r.PositionId.HasValue
                && positionsById.TryGetValue(r.PositionId.Value, out var pos)
                && (string.Equals(pos.ScopeTag, "doctor", StringComparison.OrdinalIgnoreCase)
                    || pos.Name.Contains("Bác sĩ", StringComparison.OrdinalIgnoreCase)));
            if (byDoctorPos is not null) return byDoctorPos.Value;
            if (string.Equals(code, "duty_night", StringComparison.OrdinalIgnoreCase)) return 200_000m;
        }

        var globalConfig = matching.FirstOrDefault(r => r.StaffId == null && r.PositionId == null);
        return globalConfig?.Value ?? fallback;
    }
}
