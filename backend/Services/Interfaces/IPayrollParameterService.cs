using Vnc.HRMS.DTOs.Payroll;

namespace Vnc.HRMS.Services.Interfaces;

public interface IPayrollParameterService
{
    Task<AllowanceTypeDto[]> ListAllowancesAsync(PayrollParameterFilter filter, CancellationToken ct);
    Task<AllowanceTypeDto> GetAllowanceAsync(Guid id, CancellationToken ct);
    Task<AllowanceTypeDto> CreateAllowanceAsync(SaveAllowanceTypeRequest request, CancellationToken ct);
    Task<AllowanceTypeDto> UpdateAllowanceAsync(Guid id, SaveAllowanceTypeRequest request, CancellationToken ct);

    Task<InsuranceConfigDto[]> ListInsurancesAsync(PayrollParameterFilter filter, CancellationToken ct);
    Task<InsuranceConfigDto> GetInsuranceAsync(Guid id, CancellationToken ct);
    Task<InsuranceConfigDto> CreateInsuranceAsync(SaveInsuranceConfigRequest request, CancellationToken ct);
    Task<InsuranceConfigDto> UpdateInsuranceAsync(Guid id, SaveInsuranceConfigRequest request, CancellationToken ct);

    Task<TaxBracketDto[]> ListTaxBracketsAsync(PayrollParameterFilter filter, CancellationToken ct);
    Task<TaxBracketDto> GetTaxBracketAsync(Guid id, CancellationToken ct);
    Task<TaxBracketDto> CreateTaxBracketAsync(SaveTaxBracketRequest request, CancellationToken ct);
    Task<TaxBracketDto> UpdateTaxBracketAsync(Guid id, SaveTaxBracketRequest request, CancellationToken ct);
    Task<TaxDeductionPolicyDto> GetTaxDeductionPolicyAsync(CancellationToken ct);

    Task<CommissionRuleDto[]> ListCommissionRulesAsync(PayrollParameterFilter filter, CancellationToken ct);
    Task<CommissionRuleDto> GetCommissionRuleAsync(Guid id, CancellationToken ct);
    Task<CommissionRuleDto> CreateCommissionRuleAsync(SaveCommissionRuleRequest request, Guid? creatorId, CancellationToken ct);
    Task<CommissionRuleDto> UpdateCommissionRuleAsync(Guid id, SaveCommissionRuleRequest request, CancellationToken ct);
    Task<ProcedureServiceOptionDto[]> ListActiveProcedureServicesAsync(CancellationToken ct);
}
