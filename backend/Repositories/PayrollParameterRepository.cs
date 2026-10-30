using Microsoft.EntityFrameworkCore;
using Vnc.HRMS.DTOs.Payroll;
using Vnc.HRMS.Models;
using Vnc.HRMS.Persistence;
using Vnc.HRMS.Repositories.Interfaces;

namespace Vnc.HRMS.Repositories;

public sealed class PayrollParameterRepository(AppDbContext db) : IPayrollParameterRepository
{
    // ---------- Allowances ----------

    public async Task<AllowanceTypeDto[]> ListAllowancesAsync(PayrollParameterFilter filter, CancellationToken ct)
    {
        var query = db.AllowanceTypes.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(filter.Status))
        {
            var status = filter.Status.Trim().ToLowerInvariant();
            query = query.Where(x => x.Status == status);
        }

        if (!string.IsNullOrWhiteSpace(filter.Q))
        {
            var term = filter.Q.Trim().ToLower();
            query = query.Where(x => x.Code.ToLower().Contains(term) || x.Name.ToLower().Contains(term));
        }

        return await query
            .OrderBy(x => x.Code)
            .Select(x => new AllowanceTypeDto(
                x.AllowanceId,
                x.Code,
                x.Name,
                x.ValueType,
                x.DefaultValue,
                x.AppliesTo ?? "all",
                x.IsTaxable ?? false,
                x.IsInsuranceBasis ?? false,
                x.Status ?? "active",
                x.CreatedAt,
                null))
            .ToArrayAsync(ct);
    }

    public Task<AllowanceType?> FindAllowanceAsync(Guid id, CancellationToken ct)
        => db.AllowanceTypes.SingleOrDefaultAsync(x => x.AllowanceId == id, ct);

    public Task<bool> AllowanceCodeExistsAsync(string code, Guid? excludeId, CancellationToken ct)
    {
        var normalized = code.Trim().ToUpperInvariant();
        return db.AllowanceTypes.AnyAsync(x => x.Code == normalized && (!excludeId.HasValue || x.AllowanceId != excludeId.Value), ct);
    }

    public void AddAllowance(AllowanceType allowance) => db.AllowanceTypes.Add(allowance);

    // ---------- Insurances ----------

    public async Task<InsuranceConfigDto[]> ListInsurancesAsync(PayrollParameterFilter filter, CancellationToken ct)
    {
        var query = db.PayrollInsuranceConfigs.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(filter.Status))
        {
            var status = filter.Status.Trim().ToLowerInvariant();
            query = query.Where(x => x.Status == status);
        }

        if (filter.EffectiveOn.HasValue)
        {
            var date = filter.EffectiveOn.Value;
            query = query.Where(x => x.EffectiveFrom <= date && (x.EffectiveTo == null || x.EffectiveTo >= date));
        }

        if (!string.IsNullOrWhiteSpace(filter.Q))
        {
            var term = filter.Q.Trim().ToLower();
            query = query.Where(x => x.InsuranceType.ToLower().Contains(term) || (x.AppliesTo != null && x.AppliesTo.ToLower().Contains(term)));
        }

        return await query
            .OrderBy(x => x.InsuranceType)
            .ThenBy(x => x.Payer)
            .ThenByDescending(x => x.EffectiveFrom)
            .Select(x => new InsuranceConfigDto(
                x.ConfigId,
                x.InsuranceType,
                x.Payer,
                x.RatePercent,
                x.AppliesTo ?? "all",
                x.EffectiveFrom,
                x.EffectiveTo,
                x.Status ?? "active",
                null))
            .ToArrayAsync(ct);
    }

    public Task<PayrollInsuranceConfig?> FindInsuranceAsync(Guid id, CancellationToken ct)
        => db.PayrollInsuranceConfigs.SingleOrDefaultAsync(x => x.ConfigId == id, ct);

    public Task<PayrollInsuranceConfig[]> GetOverlappingInsurancesAsync(
        string insuranceType, string payer, string appliesTo, DateOnly from, DateOnly? to, Guid? excludeId, CancellationToken ct)
    {
        var query = db.PayrollInsuranceConfigs.AsNoTracking()
            .Where(x => x.Status == "active"
                && x.InsuranceType == insuranceType
                && x.Payer == payer
                && (x.AppliesTo ?? "all") == appliesTo
                && (!excludeId.HasValue || x.ConfigId != excludeId.Value));

        return query.ToArrayAsync(ct);
    }

    public void AddInsurance(PayrollInsuranceConfig config) => db.PayrollInsuranceConfigs.Add(config);

    // ---------- Tax Brackets ----------

    public async Task<TaxBracketDto[]> ListTaxBracketsAsync(PayrollParameterFilter filter, CancellationToken ct)
    {
        var query = db.PayrollTaxBrackets.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(filter.Status))
        {
            var status = filter.Status.Trim().ToLowerInvariant();
            query = query.Where(x => x.Status == status);
        }

        if (filter.EffectiveOn.HasValue)
        {
            var date = filter.EffectiveOn.Value;
            query = query.Where(x => x.EffectiveFrom <= date && (x.EffectiveTo == null || x.EffectiveTo >= date));
        }

        return await query
            .OrderByDescending(x => x.EffectiveFrom)
            .ThenBy(x => x.IncomeFrom)
            .Select(x => new TaxBracketDto(
                x.BracketId,
                x.IncomeFrom,
                x.IncomeTo,
                x.TaxRatePercent,
                x.EffectiveFrom,
                x.EffectiveTo,
                x.Status ?? "active",
                null))
            .ToArrayAsync(ct);
    }

    public Task<PayrollTaxBracket?> FindTaxBracketAsync(Guid id, CancellationToken ct)
        => db.PayrollTaxBrackets.SingleOrDefaultAsync(x => x.BracketId == id, ct);

    public Task<PayrollTaxBracket[]> GetActiveTaxBracketsAsync(DateOnly from, DateOnly? to, Guid? excludeId, CancellationToken ct)
    {
        var query = db.PayrollTaxBrackets.AsNoTracking()
            .Where(x => x.Status == "active" && (!excludeId.HasValue || x.BracketId != excludeId.Value));

        return query.ToArrayAsync(ct);
    }

    public void AddTaxBracket(PayrollTaxBracket bracket) => db.PayrollTaxBrackets.Add(bracket);

    public async Task<TaxDeductionPolicyDto> GetTaxDeductionPolicyAsync(CancellationToken ct)
    {
        var policies = await db.Set<SystemPolicy>().AsNoTracking()
            .Where(x => x.PolicyKey == "pit.personal_deduction" || x.PolicyKey == "pit.dependent_deduction")
            .ToDictionaryAsync(x => x.PolicyKey, x => x.PolicyValue, ct);

        decimal? personal = null;
        if (policies.TryGetValue("pit.personal_deduction", out var personalVal) && decimal.TryParse(personalVal, out var p))
            personal = p;

        decimal? dependent = null;
        if (policies.TryGetValue("pit.dependent_deduction", out var dependentVal) && decimal.TryParse(dependentVal, out var d))
            dependent = d;

        return new TaxDeductionPolicyDto(personal, dependent);
    }

    // ---------- Commission Rules ----------

    public async Task<CommissionRuleDto[]> ListCommissionRulesAsync(PayrollParameterFilter filter, CancellationToken ct)
    {
        var query = from r in db.CommissionRules.AsNoTracking()
                    join s in db.ProcedureServices.AsNoTracking() on r.ServiceId equals s.ServiceId
                    select new { Rule = r, Service = s };

        if (!string.IsNullOrWhiteSpace(filter.Status))
        {
            var status = filter.Status.Trim().ToLowerInvariant();
            query = query.Where(x => x.Rule.Status == status);
        }

        if (filter.EffectiveOn.HasValue)
        {
            var date = filter.EffectiveOn.Value;
            query = query.Where(x => x.Rule.EffectiveFrom <= date && (x.Rule.EffectiveTo == null || x.Rule.EffectiveTo >= date));
        }

        if (!string.IsNullOrWhiteSpace(filter.Q))
        {
            var term = filter.Q.Trim().ToLower();
            query = query.Where(x => x.Service.ServiceCode.ToLower().Contains(term)
                || x.Service.ServiceName.ToLower().Contains(term)
                || x.Rule.Role.ToLower().Contains(term));
        }

        var result = await query
            .OrderBy(x => x.Service.ServiceCode)
            .ThenBy(x => x.Rule.Role)
            .ThenByDescending(x => x.Rule.EffectiveFrom)
            .Select(x => new CommissionRuleDto(
                x.Rule.RuleId,
                x.Rule.ServiceId,
                x.Service.ServiceCode,
                x.Service.ServiceName,
                x.Rule.Role,
                x.Rule.ValueType,
                x.Rule.CommissionValue,
                x.Rule.EffectiveFrom,
                x.Rule.EffectiveTo,
                x.Rule.Status ?? "active",
                x.Rule.CreatedBy,
                x.Rule.CreatedAt,
                null))
            .ToArrayAsync(ct);

        return result;
    }

    public Task<CommissionRule?> FindCommissionRuleAsync(Guid id, CancellationToken ct)
        => db.CommissionRules.SingleOrDefaultAsync(x => x.RuleId == id, ct);

    public Task<CommissionRule[]> GetOverlappingCommissionRulesAsync(
        Guid serviceId, string role, DateOnly from, DateOnly? to, Guid? excludeId, CancellationToken ct)
    {
        var query = db.CommissionRules.AsNoTracking()
            .Where(x => x.Status == "active"
                && x.ServiceId == serviceId
                && x.Role == role
                && (!excludeId.HasValue || x.RuleId != excludeId.Value));

        return query.ToArrayAsync(ct);
    }

    public void AddCommissionRule(CommissionRule rule) => db.CommissionRules.Add(rule);

    public async Task<ProcedureServiceOptionDto[]> ListActiveProcedureServicesAsync(CancellationToken ct)
    {
        return await db.ProcedureServices.AsNoTracking()
            .Where(x => x.Status == "active")
            .OrderBy(x => x.ServiceCode)
            .Select(x => new ProcedureServiceOptionDto(x.ServiceId, x.ServiceCode, x.ServiceName, x.Category))
            .ToArrayAsync(ct);
    }

    public Task<bool> ServiceExistsAndActiveAsync(Guid serviceId, CancellationToken ct)
        => db.ProcedureServices.AnyAsync(x => x.ServiceId == serviceId && x.Status == "active", ct);

    // ---------- Locked & Open Months ----------

    public async Task<string[]> GetLockedMonthsAsync(CancellationToken ct)
    {
        return await db.PayrollLocks.AsNoTracking()
            .Where(x => x.Status == "finalized" || x.Status == "exported")
            .Select(x => x.PayMonth)
            .Distinct()
            .ToArrayAsync(ct);
    }

    public async Task<string[]> GetOpenMonthsAsync(CancellationToken ct)
    {
        return await db.PayrollLocks.AsNoTracking()
            .Where(x => x.Status == null || (x.Status != "finalized" && x.Status != "exported"))
            .Select(x => x.PayMonth)
            .Distinct()
            .ToArrayAsync(ct);
    }
}
