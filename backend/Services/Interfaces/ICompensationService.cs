using Vnc.HRMS.DTOs.Payroll;

namespace Vnc.HRMS.Services.Interfaces;

public interface ICompensationService
{
    Task<ContractSummaryDto[]> ListContractsAsync(string? q, string? status, CancellationToken ct);
    Task<ContractCompensationDto> GetContractCompensationAsync(Guid contractId, CancellationToken ct);
    Task<ContractCompensationDto> UpdateContractCompensationAsync(Guid contractId, UpdateContractCompensationRequest request, CancellationToken ct);
    Task<StaffAllowanceDto[]> ListStaffAllowancesAsync(Guid contractId, CancellationToken ct);
    Task<StaffAllowanceDto> CreateStaffAllowanceAsync(Guid contractId, SaveStaffAllowanceRequest request, Guid? approverId, CancellationToken ct);
    Task<StaffAllowanceDto> UpdateStaffAllowanceAsync(Guid contractId, Guid staffAllowanceId, SaveStaffAllowanceRequest request, Guid? approverId, CancellationToken ct);
}
