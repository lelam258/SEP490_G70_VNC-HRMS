using Microsoft.EntityFrameworkCore;
using Vnc.HRMS.DTOs.Payroll;
using Vnc.HRMS.Models;
using Vnc.HRMS.Persistence;
using Vnc.HRMS.Repositories.Interfaces;

namespace Vnc.HRMS.Repositories;

public sealed class PayrollHistoryRepository(AppDbContext db) : IPayrollHistoryRepository
{
    public Task<List<PayrollLock>> ListLocksAsync(CancellationToken ct)
        => db.PayrollLocks.AsNoTracking()
            .OrderByDescending(x => x.PayMonth)
            .ToListAsync(ct);

    public Task<PayrollLock?> FindLockByMonthAsync(string payMonth, CancellationToken ct)
        => db.PayrollLocks.AsNoTracking().SingleOrDefaultAsync(x => x.PayMonth == payMonth, ct);

    public async Task<List<Payslip>> ListPayslipsByMonthsAsync(
        IEnumerable<string> months, Guid? departmentId, CancellationToken ct)
    {
        var monthList = months.Distinct().ToList();
        if (monthList.Count == 0) return [];

        var query = db.Payslips.AsNoTracking()
            .Where(p => monthList.Contains(p.PayMonth));

        if (departmentId.HasValue)
        {
            query = query.Where(p => p.DepartmentId == departmentId.Value);
        }

        return await query.ToListAsync(ct);
    }

    public Task<List<PayrollHistoryDepartmentOptionDto>> ListActiveDepartmentsAsync(CancellationToken ct)
        => db.Departments.AsNoTracking()
            .Where(d => d.Status == "active")
            .OrderBy(d => d.Name)
            .Select(d => new PayrollHistoryDepartmentOptionDto(d.DepartmentId, d.Name))
            .ToListAsync(ct);

    public Task<Dictionary<Guid, string>> GetDepartmentNamesAsync(CancellationToken ct)
        => db.Departments.AsNoTracking()
            .ToDictionaryAsync(d => d.DepartmentId, d => d.Name, ct);

    public async Task<Dictionary<Guid, string>> GetUserNamesAsync(IEnumerable<Guid> userIds, CancellationToken ct)
    {
        var ids = userIds.Where(id => id != Guid.Empty).Distinct().ToList();
        if (ids.Count == 0) return [];
        return await db.Users.AsNoTracking()
            .Where(u => ids.Contains(u.UserId))
            .ToDictionaryAsync(u => u.UserId, u => u.FullName ?? u.Username, ct);
    }

    public async Task<List<AuditLog>> ListPayrollLockLogsAsync(IEnumerable<Guid> lockIds, CancellationToken ct)
    {
        var ids = lockIds.Distinct().ToList();
        if (ids.Count == 0) return [];

        return await db.AuditLogs.AsNoTracking()
            .Where(a => a.EntityType == "PayrollLock" && a.EntityId.HasValue && ids.Contains(a.EntityId.Value))
            .OrderByDescending(a => a.CreatedAt)
            .ToListAsync(ct);
    }
}
