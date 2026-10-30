using Vnc.HRMS.DTOs.Payroll;
using Vnc.HRMS.Models;

namespace Vnc.HRMS.Repositories.Interfaces;

public interface IPayrollParameterRepository
{
    // Allowances
    Task<AllowanceTypeDto[]> ListAllowancesAsync(PayrollParameterFilter filter, CancellationToken ct);
    Task<AllowanceType?> FindAllowanceAsync(Guid id, CancellationToken ct);
    Task<bool> AllowanceCodeExistsAsync(string code, Guid? excludeId, CancellationToken ct);
    void AddAllowance(AllowanceType allowance);

    // Insurances
    Task<InsuranceConfigDto[]> ListInsurancesAsync(PayrollParameterFilter filter, CancellationToken ct);
    Task<PayrollInsuranceConfig?> FindInsuranceAsync(Guid id, CancellationToken ct);
    Task<PayrollInsuranceConfig[]> GetOverlappingInsurancesAsync(string insuranceType, string payer, string appliesTo, DateOnly from, DateOnly? to, Guid? excludeId, CancellationToken ct);
    void AddInsurance(PayrollInsuranceConfig config);

    // Tax Brackets & Policy
    Task<TaxBracketDto[]> ListTaxBracketsAsync(PayrollParameterFilter filter, CancellationToken ct);
    Task<PayrollTaxBracket?> FindTaxBracketAsync(Guid id, CancellationToken ct);
    Task<PayrollTaxBracket[]> GetActiveTaxBracketsAsync(DateOnly from, DateOnly? to, Guid? excludeId, CancellationToken ct);
    void AddTaxBracket(PayrollTaxBracket bracket);
    Task<TaxDeductionPolicyDto> GetTaxDeductionPolicyAsync(CancellationToken ct);
    Task<TaxPolicySummaryDto> GetTaxPolicySummaryAsync(CancellationToken ct);
    Task<TaxPolicySummaryDto> UpdateTaxPolicyFlagsAsync(UpdateTaxPolicyFlagsRequest request, Guid updatedBy, CancellationToken ct);

    // Payroll Rate Configs
    Task<PayrollRateConfigDto[]> ListRateConfigsAsync(PayrollRateConfigFilter filter, CancellationToken ct);
    Task<PayrollRateConfig?> FindRateConfigAsync(Guid id, CancellationToken ct);
    Task<PayrollRateConfig[]> GetOverlappingRateConfigsAsync(string code, Guid? positionId, Guid? staffId, DateOnly from, DateOnly? to, Guid? excludeId, CancellationToken ct);
    void AddRateConfig(PayrollRateConfig config);

    // Commission Rules
    Task<CommissionRuleDto[]> ListCommissionRulesAsync(CommissionRuleFilter filter, CancellationToken ct);
    Task<CommissionRule?> FindCommissionRuleAsync(Guid id, CancellationToken ct);
    Task<CommissionRule[]> GetOverlappingCommissionRulesAsync(Guid? serviceId, string? serviceCategory, string role, Guid? positionId, string timeCondition, DateOnly from, DateOnly? to, Guid? excludeId, CancellationToken ct);
    void AddCommissionRule(CommissionRule rule);
    Task<CommissionMatrixDto> GetCommissionMatrixAsync(CancellationToken ct);
    Task<ProcedureServiceOptionDto[]> ListActiveProcedureServicesAsync(CancellationToken ct);
    Task<bool> ServiceExistsAndActiveAsync(Guid serviceId, CancellationToken ct);

    // Staff Commission Overrides
    Task<StaffCommissionOverrideDto[]> ListStaffCommissionOverridesAsync(StaffCommissionOverrideFilter filter, CancellationToken ct);
    Task<StaffCommissionOverride?> FindStaffCommissionOverrideAsync(Guid id, CancellationToken ct);
    Task<StaffCommissionOverride[]> GetOverlappingStaffCommissionOverridesAsync(Guid staffId, Guid? serviceId, string? serviceCategory, string role, string timeCondition, DateOnly from, DateOnly? to, Guid? excludeId, CancellationToken ct);
    void AddStaffCommissionOverride(StaffCommissionOverride overrideEntity);

    // Dropdowns & Validation lookups
    Task<PositionOptionDto[]> ListPositionsAsync(CancellationToken ct);
    Task<bool> PositionExistsAndActiveAsync(Guid positionId, CancellationToken ct);
    Task<SiteOptionDto[]> ListSitesAsync(CancellationToken ct);
    Task<bool> StaffExistsAndActiveAsync(Guid staffId, CancellationToken ct);

    // Locked & Open months
    Task<string[]> GetLockedMonthsAsync(CancellationToken ct);
    Task<string[]> GetOpenMonthsAsync(CancellationToken ct);
}
