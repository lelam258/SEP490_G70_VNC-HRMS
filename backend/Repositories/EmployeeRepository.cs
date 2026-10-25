using Microsoft.EntityFrameworkCore;
using Vnc.HRMS.Persistence;
using Vnc.HRMS.Repositories.Interfaces;

namespace Vnc.HRMS.Repositories;

public sealed class EmployeeRepository(AppDbContext db) : IEmployeeRepository
{
    public Task<Vnc.HRMS.Contracts.AccountEmployeeOption[]> ListAccountOptionsAsync(CancellationToken ct) =>
        (from staff in db.Staff.AsNoTracking()
         join department in db.Departments.AsNoTracking() on staff.DepartmentId equals department.DepartmentId into departments
         from department in departments.DefaultIfEmpty()
         orderby staff.StaffCode
         select new Vnc.HRMS.Contracts.AccountEmployeeOption(staff.StaffId, staff.StaffCode, staff.FullName,
             department == null ? "Chưa phân khoa" : department.Name, staff.DepartmentId, staff.Email, staff.Status)).ToArrayAsync(ct);
}
