using Microsoft.EntityFrameworkCore;
using Vnc.HRMS.DTOs.Employees;
using Vnc.HRMS.Models.Employees;
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
    public Task<EmployeeDto[]> ListAsync(CancellationToken ct) => (from employee in db.Staff.AsNoTracking()
                                                                   join department in db.Departments.AsNoTracking() on employee.DepartmentId equals department.DepartmentId into departments
                                                                   from department in departments.DefaultIfEmpty()
                                                                   orderby employee.StaffCode
                                                                   select new EmployeeDto(employee.StaffId, employee.StaffCode, employee.FullName, employee.DepartmentId,
                                                                       department == null ? "Chưa phân khoa" : department.Name, employee.Email, employee.Status, employee.DateJoined, employee.AvatarUrl)).ToArrayAsync(ct);
    public Task<Staff?> FindAsync(Guid id, CancellationToken ct) => db.Staff.SingleOrDefaultAsync(x => x.StaffId == id, ct);
    public Task<Staff?> FindForRegistrationAsync(string code, string email, CancellationToken ct)
    {
        var normalizedCode = code.Trim().ToUpperInvariant();
        var address = email.Trim().ToLowerInvariant();
        return db.Staff.AsNoTracking().SingleOrDefaultAsync(x => x.StaffCode == normalizedCode && x.Email == address && x.Status == "active", ct);
    }
    public void Add(Staff employee) => db.Staff.Add(employee);
}
