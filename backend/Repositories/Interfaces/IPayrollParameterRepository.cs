using Vnc.HRMS.DTOs.Payroll;
using Vnc.HRMS.Models.Payroll;

namespace Vnc.HRMS.Repositories.Interfaces;

public interface IPayrollParameterRepository
{
    // Allowances
    Task<AllowanceTypeDto[]> ListAllowancesAsync(CancellationToken ct);
    Task<AllowanceType?> FindAllowanceAsync(Guid id, CancellationToken ct);
    Task<bool> ExistsAllowanceCodeAsync(string code, Guid? excludeId, CancellationToken ct);
    void AddAllowance(AllowanceType allowance);
    void RemoveAllowance(AllowanceType allowance);

    // Insurance configs
    Task<InsuranceConfigDto[]> ListInsurancesAsync(CancellationToken ct);
    Task<PayrollInsuranceConfig?> FindInsuranceAsync(Guid id, CancellationToken ct);
    void AddInsurance(PayrollInsuranceConfig config);

    // Tax brackets
    Task<TaxBracketDto[]> ListTaxBracketsAsync(CancellationToken ct);
    Task<PayrollTaxBracket?> FindTaxBracketAsync(Guid id, CancellationToken ct);
    void AddTaxBracket(PayrollTaxBracket bracket);

    // Commission rules
    Task<CommissionRuleDto[]> ListCommissionRulesAsync(CancellationToken ct);
    Task<CommissionRule?> FindCommissionRuleAsync(Guid id, CancellationToken ct);
    void AddCommissionRule(CommissionRule rule);

    // Summary for listing all parameters
    Task<PayrollParametersSummaryDto> GetSummaryAsync(CancellationToken ct);
}
