using System.Text.Json;
using Vnc.HRMS.DTOs.Attendance;
using Vnc.HRMS.Models;

namespace Vnc.HRMS.Services.Rules;

public static class OvertimeRules
{
    // GB-12: merge actual evidence before rounding; never turn a gap between punches into OT.
    public static decimal Hours(DateOnly date, IEnumerable<AttendanceTimePair> pairs, bool nightOnCall)
    {
        if (nightOnCall) return 0m;
        var start = date.ToDateTime(new TimeOnly(17, 0));
        var end = date.ToDateTime(new TimeOnly(19, 0));
        var intervals = pairs.Where(p => p.In.HasValue && p.Out.HasValue && p.Out > p.In
                && DateOnly.FromDateTime(p.In.Value) == date && DateOnly.FromDateTime(p.Out.Value) == date)
            .Select(p => (Start: p.In!.Value > start ? p.In.Value : start, End: p.Out!.Value < end ? p.Out.Value : end))
            .Where(p => p.End > p.Start).OrderBy(p => p.Start).ToArray();
        long ticks = 0;
        DateTime? from = null, to = null;
        foreach (var interval in intervals) {
            if (to.HasValue && interval.Start > to.Value) { ticks += (to.Value - from!.Value).Ticks; from = null; }
            from ??= interval.Start;
            if (!to.HasValue || interval.End > to.Value) to = interval.End;
        }
        if (from.HasValue) ticks += (to!.Value - from.Value).Ticks;
        return Math.Min(2m, ticks / TimeSpan.FromMinutes(30).Ticks * 0.5m);
    }

    public static AttendanceTimePair[] Pairs(AttendanceRecord record) => record.TimePairsJson is null
        ? [new(record.CheckIn, record.CheckOut)]
        : JsonSerializer.Deserialize<AttendanceTimePair[]>(record.TimePairsJson) ?? [];

    public static decimal ConfirmedHours(IEnumerable<AttendanceRecord> records, IEnumerable<OnCallShift> duties,
        IEnumerable<DateOnly>? scheduledNightDates = null)
    {
        var recordList = records.ToArray();
        var dutyList = duties.ToArray();
        var blocked = (scheduledNightDates ?? []).Concat(recordList.Where(r => r.ShiftType == "evening").Select(r => r.WorkDate))
            .Concat(dutyList.Where(d => d.ShiftCategory == "evening" && d.Status is not ("cancelled" or "rejected")).Select(d => d.ShiftDate)).ToHashSet();
        var evidence = recordList.Where(r => r.ValidationStatus == "confirmed" && (r.ShiftType is "main" or "overtime" || string.IsNullOrEmpty(r.ShiftType)))
            .SelectMany(r => Pairs(r).Select(p => (Date: r.WorkDate, Pair: p)))
            .Concat(dutyList.Where(d => d.Status == "confirmed" && d.ShiftCategory == "overtime")
                .Select(d => (Date: d.ShiftDate, Pair: new AttendanceTimePair(d.ShiftStart, d.ShiftEnd))));
        return evidence.GroupBy(x => x.Date).Sum(g => Hours(g.Key, g.Select(x => x.Pair), blocked.Contains(g.Key)));
    }
}
