using Microsoft.EntityFrameworkCore;
using Vnc.HRMS.Persistence;
using Vnc.HRMS.Models;
namespace Vnc.HRMS.Repositories;
public sealed class AttendanceRepository(AttendanceDbContext db)
{
    public async Task<object> AttendanceRecordsAsync(int page, int pageSize, CancellationToken ct)
    {
        var query = db.AttendanceRecords.AsNoTracking();
        return new { total = await query.CountAsync(ct), page, pageSize, items = await query.OrderByDescending(x => x.WorkDate).ThenBy(x => x.AttendanceId).Skip((page - 1) * pageSize).Take(pageSize).ToArrayAsync(ct) };
    }
    public async Task<object> AttendanceImportsAsync(int page, int pageSize, CancellationToken ct)
    {
        var query = db.AttendanceImports.AsNoTracking();
        return new { total = await query.CountAsync(ct), page, pageSize, items = await query.OrderByDescending(x => x.ImportDate).ThenBy(x => x.ImportId).Skip((page - 1) * pageSize).Take(pageSize).ToArrayAsync(ct) };
    }
    public async Task<object> LeaveRequestsAsync(int page, int pageSize, CancellationToken ct)
    {
        var query = db.LeaveRequests.AsNoTracking();
        return new { total = await query.CountAsync(ct), page, pageSize, items = await query.OrderByDescending(x => x.CreatedAt).ThenBy(x => x.RequestId).Skip((page - 1) * pageSize).Take(pageSize).ToArrayAsync(ct) };
    }
    public async Task<object> OnCallShiftsAsync(int page, int pageSize, CancellationToken ct)
    {
        var query = db.OnCallShifts.AsNoTracking();
        return new { total = await query.CountAsync(ct), page, pageSize, items = await query.OrderByDescending(x => x.ShiftDate).ThenBy(x => x.ShiftId).Skip((page - 1) * pageSize).Take(pageSize).ToArrayAsync(ct) };
    }
    public async Task<object> MonthlyTimesheetsAsync(int page, int pageSize, CancellationToken ct)
    {
        var query = db.MonthlyTimesheets.AsNoTracking();
        return new { total = await query.CountAsync(ct), page, pageSize, items = await query.OrderByDescending(x => x.PayMonth).ThenBy(x => x.TimesheetId).Skip((page - 1) * pageSize).Take(pageSize).ToArrayAsync(ct) };
    }
}
