using Vnc.HRMS.DTOs.Payroll;

namespace Vnc.HRMS.Services.Interfaces;

public interface IPayrollParameterService
{
    Task<PayrollParametersSummaryDto> GetSummaryAsync(CancellationToken ct);

    // Allowances
    Task<AllowanceTypeDto[]> ListAllowancesAsync(CancellationToken ct);
    Task<AllowanceTypeDto> GetAllowanceAsync(Guid id, CancellationToken ct);
    Task<AllowanceTypeDto> CreateAllowanceAsync(SaveAllowanceTypeRequest request, CancellationToken ct);
    Task<AllowanceTypeDto> UpdateAllowanceAsync(Guid id, SaveAllowanceTypeRequest request, CancellationToken ct);

    // Insurances
    Task<InsuranceConfigDto[]> ListInsurancesAsync(CancellationToken ct);
    Task<InsuranceConfigDto> GetInsuranceAsync(Guid id, CancellationToken ct);
    Task<InsuranceConfigDto> CreateInsuranceAsync(SaveInsuranceConfigRequest request, CancellationToken ct);
    Task<InsuranceConfigDto> UpdateInsuranceAsync(Guid id, SaveInsuranceConfigRequest request, CancellationToken ct);

    // Tax Brackets
    Task<TaxBracketDto[]> ListTaxBracketsAsync(CancellationToken ct);
    Task<TaxBracketDto> GetTaxBracketAsync(Guid id, CancellationToken ct);
    Task<TaxBracketDto> CreateTaxBracketAsync(SaveTaxBracketRequest request, CancellationToken ct);
    Task<TaxBracketDto> UpdateTaxBracketAsync(Guid id, SaveTaxBracketRequest request, CancellationToken ct);

    // Commission Rules
    Task<CommissionRuleDto[]> ListCommissionRulesAsync(CancellationToken ct);
    Task<CommissionRuleDto> GetCommissionRuleAsync(Guid id, CancellationToken ct);
    Task<CommissionRuleDto> CreateCommissionRuleAsync(SaveCommissionRuleRequest request, Guid? creatorId, CancellationToken ct);
    Task<CommissionRuleDto> UpdateCommissionRuleAsync(Guid id, SaveCommissionRuleRequest request, CancellationToken ct);
}
