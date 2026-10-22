using Microsoft.EntityFrameworkCore;
using Vnc.HRMS.DTOs.Payroll;
using Vnc.HRMS.Models.Payroll;
using Vnc.HRMS.Persistence;
using Vnc.HRMS.Repositories.Interfaces;

namespace Vnc.HRMS.Repositories;

public sealed class PayrollParameterRepository(AppDbContext db) : IPayrollParameterRepository
{
    public async Task<AllowanceTypeDto[]> ListAllowancesAsync(CancellationToken ct)
        => await db.AllowanceTypes
            .AsNoTracking()
            .OrderByDescending(x => x.CreatedAt)
            .Select(x => new AllowanceTypeDto(x.AllowanceId, x.Code, x.Name, x.ValueType, x.DefaultValue, x.AppliesTo, x.IsTaxable, x.IsInsuranceBasis, x.Status, x.CreatedAt))
            .ToArrayAsync(ct);

    public Task<AllowanceType?> FindAllowanceAsync(Guid id, CancellationToken ct)
        => db.AllowanceTypes.FirstOrDefaultAsync(x => x.AllowanceId == id, ct);

    public Task<bool> ExistsAllowanceCodeAsync(string code, Guid? excludeId, CancellationToken ct)
        => db.AllowanceTypes.AnyAsync(x => x.Code == code && (excludeId == null || x.AllowanceId != excludeId), ct);

    public void AddAllowance(AllowanceType allowance) => db.AllowanceTypes.Add(allowance);

    public void RemoveAllowance(AllowanceType allowance) => db.AllowanceTypes.Remove(allowance);

    public async Task<InsuranceConfigDto[]> ListInsurancesAsync(CancellationToken ct)
        => await db.PayrollInsuranceConfigs
            .AsNoTracking()
            .OrderBy(x => x.InsuranceType)
            .ThenBy(x => x.Payer)
            .Select(x => new InsuranceConfigDto(x.ConfigId, x.InsuranceType, x.Payer, x.RatePercent, x.AppliesTo, x.EffectiveFrom, x.EffectiveTo, x.Status))
            .ToArrayAsync(ct);

    public Task<PayrollInsuranceConfig?> FindInsuranceAsync(Guid id, CancellationToken ct)
        => db.PayrollInsuranceConfigs.FirstOrDefaultAsync(x => x.ConfigId == id, ct);

    public void AddInsurance(PayrollInsuranceConfig config) => db.PayrollInsuranceConfigs.Add(config);

    public async Task<TaxBracketDto[]> ListTaxBracketsAsync(CancellationToken ct)
        => await db.PayrollTaxBrackets
            .AsNoTracking()
            .OrderBy(x => x.IncomeFrom)
            .Select(x => new TaxBracketDto(x.BracketId, x.IncomeFrom, x.IncomeTo, x.TaxRatePercent, x.EffectiveFrom, x.EffectiveTo, x.Status))
            .ToArrayAsync(ct);

    public Task<PayrollTaxBracket?> FindTaxBracketAsync(Guid id, CancellationToken ct)
        => db.PayrollTaxBrackets.FirstOrDefaultAsync(x => x.BracketId == id, ct);

    public void AddTaxBracket(PayrollTaxBracket bracket) => db.PayrollTaxBrackets.Add(bracket);

    public async Task<CommissionRuleDto[]> ListCommissionRulesAsync(CancellationToken ct)
        => await db.CommissionRules
            .AsNoTracking()
            .OrderByDescending(x => x.CreatedAt)
            .Select(x => new CommissionRuleDto(x.RuleId, x.ServiceId, x.Role, x.ValueType, x.CommissionValue, x.EffectiveFrom, x.EffectiveTo, x.Status))
            .ToArrayAsync(ct);

    public Task<CommissionRule?> FindCommissionRuleAsync(Guid id, CancellationToken ct)
        => db.CommissionRules.FirstOrDefaultAsync(x => x.RuleId == id, ct);

    public void AddCommissionRule(CommissionRule rule) => db.CommissionRules.Add(rule);

    public async Task<PayrollParametersSummaryDto> GetSummaryAsync(CancellationToken ct)
    {
        var allowances = await ListAllowancesAsync(ct);
        var insurances = await ListInsurancesAsync(ct);
        var taxBrackets = await ListTaxBracketsAsync(ct);
        var commissionRules = await ListCommissionRulesAsync(ct);
        return new PayrollParametersSummaryDto(allowances, insurances, taxBrackets, commissionRules);
    }
}
