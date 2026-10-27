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

    // Tax Brackets
    Task<TaxBracketDto[]> ListTaxBracketsAsync(PayrollParameterFilter filter, CancellationToken ct);
    Task<PayrollTaxBracket?> FindTaxBracketAsync(Guid id, CancellationToken ct);
    Task<PayrollTaxBracket[]> GetActiveTaxBracketsAsync(DateOnly from, DateOnly? to, Guid? excludeId, CancellationToken ct);
    void AddTaxBracket(PayrollTaxBracket bracket);
    Task<TaxDeductionPolicyDto> GetTaxDeductionPolicyAsync(CancellationToken ct);

    // Commission Rules
    Task<CommissionRuleDto[]> ListCommissionRulesAsync(PayrollParameterFilter filter, CancellationToken ct);
    Task<CommissionRule?> FindCommissionRuleAsync(Guid id, CancellationToken ct);
    Task<CommissionRule[]> GetOverlappingCommissionRulesAsync(Guid serviceId, string role, DateOnly from, DateOnly? to, Guid? excludeId, CancellationToken ct);
    void AddCommissionRule(CommissionRule rule);
    Task<ProcedureServiceOptionDto[]> ListActiveProcedureServicesAsync(CancellationToken ct);
    Task<bool> ServiceExistsAndActiveAsync(Guid serviceId, CancellationToken ct);

    // Locked & Open months
    Task<string[]> GetLockedMonthsAsync(CancellationToken ct);
    Task<string[]> GetOpenMonthsAsync(CancellationToken ct);
}
