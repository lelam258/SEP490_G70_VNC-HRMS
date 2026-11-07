using Vnc.HRMS.DTOs.Employees;
using Vnc.HRMS.Models.Employees;

namespace Vnc.HRMS.Repositories.Interfaces;

public interface IEmployeeRepository
{
    Task<EmployeeDto[]> ListAsync(CancellationToken ct);
    Task<Vnc.HRMS.Contracts.AccountEmployeeOption[]> ListAccountOptionsAsync(CancellationToken ct);
    Task<Staff?> FindAsync(Guid id, CancellationToken ct);
    Task<bool> ExistsCodeAsync(string code, CancellationToken ct, Guid? excludeId = null);
    Task<bool> EmailExistsAsync(string email, Guid? excludeId, CancellationToken ct);
    Task<bool> IdCardExistsAsync(string idCard, Guid? excludeId, CancellationToken ct);
    void Add(Staff employee);
}
