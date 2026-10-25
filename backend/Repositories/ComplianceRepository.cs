using Microsoft.EntityFrameworkCore;
using Vnc.HRMS.Persistence;
using Vnc.HRMS.Models;
namespace Vnc.HRMS.Repositories;
public sealed class ComplianceRepository(AppDbContext db)
{
    public async Task<object> CertificatesAsync(int page, int pageSize, CancellationToken ct)
    {
        var query = db.Certificates.AsNoTracking();
        return new { total = await query.CountAsync(ct), page, pageSize, items = await query.OrderByDescending(x => x.ExpiryDate).ThenBy(x => x.CertificateId).Skip((page - 1) * pageSize).Take(pageSize).ToArrayAsync(ct) };
    }
    public async Task<object> CmeCyclesAsync(int page, int pageSize, CancellationToken ct)
    {
        var query = db.CmeCycles.AsNoTracking();
        return new { total = await query.CountAsync(ct), page, pageSize, items = await query.OrderByDescending(x => x.CycleEnd).ThenBy(x => x.CycleId).Skip((page - 1) * pageSize).Take(pageSize).ToArrayAsync(ct) };
    }
    public async Task<object> CmeRecordsAsync(int page, int pageSize, CancellationToken ct)
    {
        var query = db.CmeRecords.AsNoTracking();
        return new { total = await query.CountAsync(ct), page, pageSize, items = await query.OrderByDescending(x => x.CompletedDate).ThenBy(x => x.CmeId).Skip((page - 1) * pageSize).Take(pageSize).ToArrayAsync(ct) };
    }
    public async Task<object> ComplianceScansAsync(int page, int pageSize, CancellationToken ct)
    {
        var query = db.ComplianceScans.AsNoTracking();
        return new { total = await query.CountAsync(ct), page, pageSize, items = await query.OrderByDescending(x => x.ScanDate).ThenBy(x => x.ScanId).Skip((page - 1) * pageSize).Take(pageSize).ToArrayAsync(ct) };
    }
}
