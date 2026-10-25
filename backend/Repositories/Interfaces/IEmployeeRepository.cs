namespace Vnc.HRMS.Repositories.Interfaces;

public interface IEmployeeRepository
{
    Task<Vnc.HRMS.Contracts.AccountEmployeeOption[]> ListAccountOptionsAsync(CancellationToken ct);
}
