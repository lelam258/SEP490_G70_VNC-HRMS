using Vnc.HRMS.DTOs.Employees;
using Vnc.HRMS.Models.Employees;

namespace Vnc.HRMS.Repositories.Interfaces;

public interface IContractRepository
{
    Task<ContractListItemDto[]> ListAsync(CancellationToken ct);
    Task<ContractDetailDto?> GetDetailAsync(Guid contractId, CancellationToken ct);
    Task<Contract?> FindAsync(Guid contractId, CancellationToken ct);
    Task<Staff?> FindStaffAsync(Guid staffId, CancellationToken ct);
    Task<bool> CodeExistsAsync(string code, Guid? excludeContractId, CancellationToken ct);
    Task<bool> HasOverlappingActiveAsync(Guid staffId, DateOnly from, DateOnly? to, Guid? excludeContractId, CancellationToken ct);
    Task<ContractSalaryHistory[]> ListSalaryHistoriesAsync(Guid contractId, CancellationToken ct);
    void Add(Contract contract);
}
