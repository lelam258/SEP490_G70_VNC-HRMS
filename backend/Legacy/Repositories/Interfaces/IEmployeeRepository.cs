using Vnc.HRMS.DTOs.Employees;
using Vnc.HRMS.Models.Employees;

namespace Vnc.HRMS.Repositories.Interfaces;

public interface IEmployeeRepository
{
    Task<EmployeeDto[]> ListAsync(CancellationToken ct);
    Task<Staff?> FindAsync(Guid id, CancellationToken ct);
    Task<Staff?> FindForRegistrationAsync(string code, string email, CancellationToken ct);
    void Add(Staff employee);
}
