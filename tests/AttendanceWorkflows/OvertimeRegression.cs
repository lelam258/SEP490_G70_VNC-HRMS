using Vnc.HRMS.DTOs.Attendance;
using Vnc.HRMS.Models;
using Vnc.HRMS.Services.Rules;

internal static class OvertimeRegression
{
    public static void Run(Action<bool, string> check)
    {
        var date = new DateOnly(2026, 11, 20);
        AttendanceTimePair Pair(int sh, int sm, int eh, int em) => new(date.ToDateTime(new(sh, sm)), date.ToDateTime(new(eh, em)));
        check(AttendanceRules.WorkHours([Pair(7, 0, 17, 0)], date, "main") == 8m,
            "Main shift 07:00-17:00 excludes 11:30-13:30 lunch");
        check(AttendanceRules.WorkHours([Pair(7, 0, 11, 30), Pair(13, 30, 17, 0)], date, "main") == 8m,
            "Split punches do not subtract the lunch break twice");
        var machine = AttendanceRules.ImportWorkHours([Pair(6, 58, 17, 14)], date, "main", 8m);
        check(machine.Hours == 8m && machine.CalculatedHours == 8m,
            "Real machine 06:58-17:14 / Giờ=8 remains 8 work hours, not 10.27");
        check(AttendanceRules.ImportWorkHours([Pair(7, 0, 17, 0)], date, "main", 6m).Hours == 6m,
            "Machine hours are retained separately from a schedule discrepancy requiring HR review");
        check(AttendanceRules.ImportWorkHours([Pair(7, 0, 17, 0)], date, "main", 99m).Hours == 8m,
            "Implausible machine total cannot inflate recorded work hours");
        check(AttendanceRules.WorkHours([Pair(7, 0, 18, 26)], date, "main") == 8m
            && OvertimeRules.Hours(date, [Pair(7, 0, 18, 26)], false) == 1m,
            "18:26 checkout keeps 8 main hours and 1 separate rounded OT hour");
        check(AttendanceRules.WorkHours([Pair(11, 30, 13, 30)], date, "noon") == 2m,
            "Noon on-call duty is not reduced by the main shift lunch break");
        foreach (var (h, m, expected) in new[] { (17, 0, 0m), (17, 29, 0m), (17, 30, .5m), (17, 59, .5m), (18, 0, 1m), (18, 45, 1.5m), (19, 0, 2m), (20, 0, 2m) })
            check(OvertimeRules.Hours(date, [Pair(13, 30, h, m)], false) == expected, $"GB-12 checkout {h:D2}:{m:D2} yields {expected} OT hours");
        check(OvertimeRules.Hours(date, [Pair(7, 0, 19, 0)], true) == 0m, "GB-12 published night duty excludes OT");
        check(OvertimeRules.Hours(date, [Pair(17, 0, 17, 20), Pair(18, 40, 19, 0)], false) == .5m, "GB-12 counts actual intervals without paying punch gaps");
        check(OvertimeRules.Hours(date, [Pair(17, 0, 18, 0), Pair(17, 0, 18, 0), Pair(17, 30, 19, 0)], false) == 2m, "GB-12 merges duplicated and overlapping evidence before daily cap");
        var main = new AttendanceRecord { WorkDate = date, ShiftType = "main", ValidationStatus = "confirmed", CheckIn = date.ToDateTime(new(7, 0)), CheckOut = date.ToDateTime(new(18, 45)), ActualHours = 10.25m };
        var noon = new AttendanceRecord { WorkDate = date, ShiftType = "noon", ValidationStatus = "confirmed", CheckIn = date.ToDateTime(new(12, 0)), CheckOut = date.ToDateTime(new(13, 0)), ActualHours = 1m };
        check(OvertimeRules.ConfirmedHours([main, noon], []) == 1.5m, "GB-12 attendance separates noon duty from rounded overtime");
        check(OvertimeRules.ConfirmedHours([main], [], [date]) == 0m,
            "GB-12 attendance excludes roster-assigned night dates");
        main.ValidationStatus = "imported";
        check(OvertimeRules.ConfirmedHours([main], []) == 0m, "GB-12 imported evidence cannot enter payable OT before verification");
        main.ValidationStatus = "confirmed";
        check(OvertimeRules.ConfirmedHours([main], [new OnCallShift { ShiftDate = date, ShiftCategory = "evening", Status = "pending" }]) == 0m,
            "GB-12 even a pending night duty prevents double-counting as overtime");
        check(OvertimeRules.ConfirmedHours([main], [new OnCallShift { ShiftDate = date, ShiftCategory = "evening", Status = "cancelled" }]) == 1.5m,
            "GB-12 cancelled night duty does not suppress eligible OT");
    }
}
