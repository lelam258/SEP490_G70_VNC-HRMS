using Vnc.HRMS.DTOs.Payroll;
using Vnc.HRMS.Models;
using Vnc.HRMS.Models.Employees;

namespace Vnc.HRMS.Repositories.Interfaces;

public interface ICompensationRepository
{
    Task<ContractSummaryDto[]> ListContractsAsync(string? q, string? status, CancellationToken ct);
    Task<Contract?> FindContractAsync(Guid contractId, CancellationToken ct);
    Task<ContractCompensationDto?> GetContractCompensationAsync(Guid contractId, CancellationToken ct);
    Task<Staff?> FindStaffAsync(Guid staffId, CancellationToken ct);
    Task<StaffAllowanceDto[]> ListStaffAllowancesAsync(Guid staffId, CancellationToken ct);
    Task<StaffAllowance?> FindStaffAllowanceAsync(Guid staffAllowanceId, CancellationToken ct);
    Task<StaffAllowance[]> GetOverlappingStaffAllowancesAsync(Guid staffId, Guid allowanceId, DateOnly from, DateOnly? to, Guid? excludeId, CancellationToken ct);
    void AddStaffAllowance(StaffAllowance staffAllowance);
    Task<bool> AllowanceExistsAndActiveAsync(Guid allowanceId, CancellationToken ct);
    Task<ContractSalaryHistoryDto[]> ListContractSalaryHistoriesAsync(Guid contractId, CancellationToken ct);
    Task<ContractSalaryHistory?> GetLatestSalaryHistoryAsync(Guid contractId, CancellationToken ct);
    void AddContractSalaryHistory(ContractSalaryHistory history);
    Task<ContractSalaryHistory[]> ListSalaryHistoryEntriesAsync(Guid contractId, CancellationToken ct);
}
