using Vnc.HRMS.Models.Employees;

namespace Vnc.HRMS.Repositories.Interfaces;

public interface IEmployeeRepository
{
    Task<Vnc.HRMS.Contracts.AccountEmployeeOption[]> ListAccountOptionsAsync(CancellationToken ct);
    Task<Staff?> FindAsync(Guid id, CancellationToken ct);
}
