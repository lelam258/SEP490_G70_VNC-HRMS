using Microsoft.EntityFrameworkCore;
using Vnc.HRMS.DTOs.Organization;
using Vnc.HRMS.Models.Organization;
using Vnc.HRMS.Persistence;
using Vnc.HRMS.Repositories.Interfaces;

namespace Vnc.HRMS.Repositories;

public sealed class DepartmentRepository(HrDbContext db) : IDepartmentRepository
{
    public Task<DepartmentDto[]> ListAsync(CancellationToken ct) => db.Departments.AsNoTracking().OrderBy(x => x.Name)
        .Select(x => new DepartmentDto(x.DepartmentId, x.DeptCode, x.Name, x.Status)).ToArrayAsync(ct);
    public Task<Department?> FindAsync(Guid id, CancellationToken ct) => db.Departments.SingleOrDefaultAsync(x => x.DepartmentId == id, ct);
    public void Add(Department department) => db.Departments.Add(department);
}
