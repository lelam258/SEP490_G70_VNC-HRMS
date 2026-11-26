using Microsoft.EntityFrameworkCore;
using Vnc.HRMS.Persistence;
using Vnc.HRMS.Models;
namespace Vnc.HRMS.Repositories;
public sealed class ComplianceRepository(AppDbContext db)
{
    public async Task<object> CertificatesAsync(int page, int pageSize, Guid? departmentId, CancellationToken ct)
    {
        var query = db.Certificates.AsNoTracking().Where(c => c.IsActive);
        if (departmentId.HasValue)
        {
            var deptStaffIds = db.Staff.AsNoTracking()
                .Where(s => s.DepartmentId == departmentId.Value)
                .Select(s => s.StaffId);
            query = query.Where(c => c.DepartmentId == departmentId.Value || deptStaffIds.Contains(c.StaffId));
        }
        return new { total = await query.CountAsync(ct), page, pageSize, items = await query.OrderByDescending(x => x.ExpiryDate).ThenBy(x => x.CertificateId).Skip((page - 1) * pageSize).Take(pageSize).ToArrayAsync(ct) };
    }
    public async Task<object> CmeCyclesAsync(int page, int pageSize, Guid? departmentId, CancellationToken ct)
    {
        var query = db.CmeCycles.AsNoTracking();
        if (departmentId.HasValue)
        {
            var deptCertIds = from c in db.Certificates.AsNoTracking()
                              join s in db.Staff.AsNoTracking() on c.StaffId equals s.StaffId
                              where c.DepartmentId == departmentId.Value || s.DepartmentId == departmentId.Value
                              select c.CertificateId;
            query = query.Where(cy => deptCertIds.Contains(cy.CertificateId));
        }
        return new { total = await query.CountAsync(ct), page, pageSize, items = await query.OrderByDescending(x => x.CycleEnd).ThenBy(x => x.CycleId).Skip((page - 1) * pageSize).Take(pageSize).ToArrayAsync(ct) };
    }
    public async Task<object> CmeRecordsAsync(int page, int pageSize, Guid? departmentId, CancellationToken ct)
    {
        var query = db.CmeRecords.AsNoTracking();
        if (departmentId.HasValue)
        {
            var deptCertIds = from c in db.Certificates.AsNoTracking()
                              join s in db.Staff.AsNoTracking() on c.StaffId equals s.StaffId
                              where c.DepartmentId == departmentId.Value || s.DepartmentId == departmentId.Value
                              select c.CertificateId;
            query = query.Where(r => deptCertIds.Contains(r.CertificateId));
        }
        return new { total = await query.CountAsync(ct), page, pageSize, items = await query.OrderByDescending(x => x.CompletedDate).ThenBy(x => x.CmeId).Skip((page - 1) * pageSize).Take(pageSize).ToArrayAsync(ct) };
    }
    public async Task<object> ComplianceScansAsync(int page, int pageSize, Guid? departmentId, CancellationToken ct)
    {
        var query = db.ComplianceScans.AsNoTracking();
        if (departmentId.HasValue)
        {
            var deptStaffIds = db.Staff.AsNoTracking()
                .Where(s => s.DepartmentId == departmentId.Value)
                .Select(s => s.StaffId);
            query = query.Where(sc => sc.DepartmentId == departmentId.Value || deptStaffIds.Contains(sc.StaffId));
        }
        return new { total = await query.CountAsync(ct), page, pageSize, items = await query.OrderByDescending(x => x.ScanDate).ThenBy(x => x.ScanId).Skip((page - 1) * pageSize).Take(pageSize).ToArrayAsync(ct) };
    }
}
