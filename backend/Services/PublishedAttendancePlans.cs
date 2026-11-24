using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Vnc.HRMS.DTOs.Schedules;
using Vnc.HRMS.Persistence;

namespace Vnc.HRMS.Services;

internal static class PublishedAttendancePlans
{
    internal static async Task<(Guid Id, Guid StaffId, Guid FacilityId, DateOnly Date, string Shift)[]> Load(
        AppDbContext db, DateOnly start, DateOnly end, CancellationToken ct)
    {
        var live = await (from a in db.ScheduleAssignments.AsNoTracking() join w in db.ScheduleWeeks on a.WeekId equals w.Id
            join c in db.ScheduleCoverage on a.CoverageId equals c.Id
            where w.Published && !a.Cancelled && a.Date >= start && a.Date <= end
            select new { a.Id, a.StaffId, c.FacilityId, a.Date, a.Shift }).ToArrayAsync(ct);
        var snapshots = await db.ScheduleWeeks.AsNoTracking().Where(w => !w.Published && w.PublishedSnapshot != null
            && w.Monday <= end && w.Monday >= start.AddDays(-6)).Select(w => w.PublishedSnapshot!).ToArrayAsync(ct);
        return live.Select(a => (a.Id, a.StaffId, a.FacilityId, a.Date, a.Shift)).Concat(snapshots
            .SelectMany(json => JsonSerializer.Deserialize<ScheduleRosterRow[]>(json) ?? [])
            .Where(x => !x.Assignment.Cancelled && x.Assignment.Date >= start && x.Assignment.Date <= end)
            .Select(x => (x.Assignment.Id, x.Assignment.StaffId, x.FacilityId, x.Assignment.Date, x.Assignment.Shift))).ToArray();
    }
}
