using Vnc.HRMS.DTOs.Employees;

namespace Vnc.HRMS.Services.Interfaces;

public interface IContractService
{
    Task<ContractListItemDto[]> ListAsync(CancellationToken ct);
    Task<ContractDetailDto> GetAsync(Guid contractId, CancellationToken ct);
    Task<ContractDetailDto> CreateAsync(CreateContractRequest request, CancellationToken ct);
    Task<ContractDetailDto> UpdateAsync(Guid contractId, UpdateContractRequest request, CancellationToken ct);
}
