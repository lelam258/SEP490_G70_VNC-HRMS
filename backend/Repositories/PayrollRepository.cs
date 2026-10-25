using Microsoft.EntityFrameworkCore;
using Vnc.HRMS.Persistence;
using Vnc.HRMS.Models;
namespace Vnc.HRMS.Repositories;
public sealed class PayrollRepository(AppDbContext db)
{
    public async Task<object> PayslipsAsync(int page, int pageSize, CancellationToken ct)
    {
        var query = db.Payslips.AsNoTracking();
        return new { total = await query.CountAsync(ct), page, pageSize, items = await query.OrderByDescending(x => x.PayMonth).ThenBy(x => x.PayslipId).Skip((page - 1) * pageSize).Take(pageSize).ToArrayAsync(ct) };
    }
    public async Task<object> AllowanceTypesAsync(int page, int pageSize, CancellationToken ct)
    {
        var query = db.AllowanceTypes.AsNoTracking();
        return new { total = await query.CountAsync(ct), page, pageSize, items = await query.OrderByDescending(x => x.Name).ThenBy(x => x.AllowanceId).Skip((page - 1) * pageSize).Take(pageSize).ToArrayAsync(ct) };
    }
    public async Task<object> StaffAllowancesAsync(int page, int pageSize, CancellationToken ct)
    {
        var query = db.StaffAllowances.AsNoTracking();
        return new { total = await query.CountAsync(ct), page, pageSize, items = await query.OrderByDescending(x => x.EffectiveFrom).ThenBy(x => x.StaffAllowanceId).Skip((page - 1) * pageSize).Take(pageSize).ToArrayAsync(ct) };
    }
    public async Task<object> ProcedureSlipsAsync(int page, int pageSize, CancellationToken ct)
    {
        var query = db.ProcedureSlips.AsNoTracking();
        return new { total = await query.CountAsync(ct), page, pageSize, items = await query.OrderByDescending(x => x.ProcedureDate).ThenBy(x => x.SlipId).Skip((page - 1) * pageSize).Take(pageSize).ToArrayAsync(ct) };
    }
    public async Task<object> ComplaintsAsync(int page, int pageSize, CancellationToken ct)
    {
        var query = db.Complaints.AsNoTracking();
        return new { total = await query.CountAsync(ct), page, pageSize, items = await query.OrderByDescending(x => x.SubmittedAt).ThenBy(x => x.ComplaintId).Skip((page - 1) * pageSize).Take(pageSize).ToArrayAsync(ct) };
    }
}
