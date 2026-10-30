using Vnc.HRMS.DTOs.Payroll;

namespace Vnc.HRMS.Services.Interfaces;

public interface IPayrollParameterService
{
    // Allowances
    Task<AllowanceTypeDto[]> ListAllowancesAsync(PayrollParameterFilter filter, CancellationToken ct);
    Task<AllowanceTypeDto> GetAllowanceAsync(Guid id, CancellationToken ct);
    Task<AllowanceTypeDto> CreateAllowanceAsync(SaveAllowanceTypeRequest request, CancellationToken ct);
    Task<AllowanceTypeDto> UpdateAllowanceAsync(Guid id, SaveAllowanceTypeRequest request, CancellationToken ct);
    Task<AllowanceTypeDto> DeactivateAllowanceAsync(Guid id, DeactivateParameterRequest request, CancellationToken ct);

    // Insurances
    Task<InsuranceConfigDto[]> ListInsurancesAsync(PayrollParameterFilter filter, CancellationToken ct);
    Task<InsuranceConfigDto> GetInsuranceAsync(Guid id, CancellationToken ct);
    Task<InsuranceConfigDto> CreateInsuranceAsync(SaveInsuranceConfigRequest request, CancellationToken ct);
    Task<InsuranceConfigDto> UpdateInsuranceAsync(Guid id, SaveInsuranceConfigRequest request, CancellationToken ct);
    Task<InsuranceConfigDto> DeactivateInsuranceAsync(Guid id, DeactivateParameterRequest request, CancellationToken ct);

    // Tax Brackets & Policy
    Task<TaxBracketDto[]> ListTaxBracketsAsync(PayrollParameterFilter filter, CancellationToken ct);
    Task<TaxBracketDto> GetTaxBracketAsync(Guid id, CancellationToken ct);
    Task<TaxBracketDto> CreateTaxBracketAsync(SaveTaxBracketRequest request, CancellationToken ct);
    Task<TaxBracketDto> UpdateTaxBracketAsync(Guid id, SaveTaxBracketRequest request, CancellationToken ct);
    Task<TaxBracketDto> DeactivateTaxBracketAsync(Guid id, DeactivateParameterRequest request, CancellationToken ct);
    Task<TaxDeductionPolicyDto> GetTaxDeductionPolicyAsync(CancellationToken ct);
    Task<TaxPolicySummaryDto> GetTaxPolicySummaryAsync(CancellationToken ct);
    Task<TaxPolicySummaryDto> UpdateTaxPolicyFlagsAsync(UpdateTaxPolicyFlagsRequest request, CancellationToken ct);
    Task<TaxCalculationResultDto> PreviewTaxCalculationAsync(TaxCalculationPreviewRequest request, CancellationToken ct);

    // Rate Configs
    Task<PayrollRateConfigDto[]> ListRateConfigsAsync(PayrollRateConfigFilter filter, CancellationToken ct);
    Task<PayrollRateConfigDto> GetRateConfigAsync(Guid id, CancellationToken ct);
    Task<PayrollRateConfigDto> CreateRateConfigAsync(SavePayrollRateConfigRequest request, Guid? creatorId, CancellationToken ct);
    Task<PayrollRateConfigDto> UpdateRateConfigAsync(Guid id, SavePayrollRateConfigRequest request, CancellationToken ct);
    Task<PayrollRateConfigDto> DeactivateRateConfigAsync(Guid id, DeactivateParameterRequest request, CancellationToken ct);

    // Commission Rules
    Task<CommissionRuleDto[]> ListCommissionRulesAsync(CommissionRuleFilter filter, CancellationToken ct);
    Task<CommissionRuleDto> GetCommissionRuleAsync(Guid id, CancellationToken ct);
    Task<CommissionRuleDto> CreateCommissionRuleAsync(SaveCommissionRuleRequest request, Guid? creatorId, CancellationToken ct);
    Task<CommissionRuleDto> UpdateCommissionRuleAsync(Guid id, SaveCommissionRuleRequest request, CancellationToken ct);
    Task<CommissionRuleDto> DeactivateCommissionRuleAsync(Guid id, DeactivateParameterRequest request, CancellationToken ct);
    Task<CommissionMatrixDto> GetCommissionMatrixAsync(CancellationToken ct);
    Task<ProcedureServiceOptionDto[]> ListActiveProcedureServicesAsync(CancellationToken ct);

    // Staff Commission Overrides
    Task<StaffCommissionOverrideDto[]> ListStaffCommissionOverridesAsync(StaffCommissionOverrideFilter filter, CancellationToken ct);
    Task<StaffCommissionOverrideDto> GetStaffCommissionOverrideAsync(Guid id, CancellationToken ct);
    Task<StaffCommissionOverrideDto> CreateStaffCommissionOverrideAsync(SaveStaffCommissionOverrideRequest request, Guid? creatorId, CancellationToken ct);
    Task<StaffCommissionOverrideDto> UpdateStaffCommissionOverrideAsync(Guid id, SaveStaffCommissionOverrideRequest request, CancellationToken ct);
    Task<StaffCommissionOverrideDto> DeactivateStaffCommissionOverrideAsync(Guid id, DeactivateParameterRequest request, CancellationToken ct);

    // Lookups
    Task<PositionOptionDto[]> ListPositionsAsync(CancellationToken ct);
    Task<SiteOptionDto[]> ListSitesAsync(CancellationToken ct);
}
