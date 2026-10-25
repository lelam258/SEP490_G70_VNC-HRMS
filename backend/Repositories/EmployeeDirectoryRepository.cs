using Vnc.HRMS.Contracts;
using Vnc.HRMS.Repositories.Interfaces;

namespace Vnc.HRMS.Repositories;

// Account lists use only the staff fields needed for display and filtering.
public sealed class EmployeeDirectoryRepository(IEmployeeRepository employees) : IEmployeeDirectory
{
    public Task<AccountEmployeeOption[]> ListAccountOptionsAsync(CancellationToken ct) => employees.ListAccountOptionsAsync(ct);
}
