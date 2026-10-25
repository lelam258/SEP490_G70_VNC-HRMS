using Vnc.HRMS.Contracts;
using Vnc.HRMS.Models.Employees;
using Vnc.HRMS.Repositories.Interfaces;
namespace Vnc.HRMS.Repositories;

// Account management reads only the minimum fields needed to link a user to a staff record.
public sealed class EmployeeDirectoryRepository(IEmployeeRepository employees) : IEmployeeDirectory
{
    public Task<AccountEmployeeOption[]> ListAccountOptionsAsync(CancellationToken ct) => employees.ListAccountOptionsAsync(ct);
    public async Task<EmployeeIdentity?> FindAsync(Guid id, CancellationToken ct) => Identity(await employees.FindAsync(id, ct));
    public async Task<EmployeeIdentity?> FindForRegistrationAsync(string code, string email, CancellationToken ct) => Identity(await employees.FindForRegistrationAsync(code, email, ct));
    private static EmployeeIdentity? Identity(Staff? staff) => staff is null ? null : new(staff.StaffId, staff.FullName, staff.Email, staff.Status);
}
