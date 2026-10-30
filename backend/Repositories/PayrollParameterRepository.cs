using System.Globalization;
using Microsoft.EntityFrameworkCore;
using Vnc.HRMS.DTOs.Payroll;
using Vnc.HRMS.Models;
using Vnc.HRMS.Persistence;
using Vnc.HRMS.Repositories.Interfaces;
using Vnc.HRMS.Services.Rules;

namespace Vnc.HRMS.Repositories;

public sealed class PayrollParameterRepository(AppDbContext db) : IPayrollParameterRepository
{
    // =========================================================================
    // Allowances
    // =========================================================================

    public async Task<AllowanceTypeDto[]> ListAllowancesAsync(PayrollParameterFilter filter, CancellationToken ct)
    {
        var query = db.AllowanceTypes.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(filter.Status))
        {
            var s = filter.Status.Trim().ToLowerInvariant();
            query = query.Where(x => x.Status == s);
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
                x.DefaultCalcMethod ?? "fixed",
                x.MinServiceYears,
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

    // =========================================================================
    // Insurances
    // =========================================================================

    public async Task<InsuranceConfigDto[]> ListInsurancesAsync(PayrollParameterFilter filter, CancellationToken ct)
    {
        var query = db.PayrollInsuranceConfigs.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(filter.Status))
        {
            var s = filter.Status.Trim().ToLowerInvariant();
            query = query.Where(x => x.Status == s);
        }

        if (filter.EffectiveOn.HasValue)
        {
            var on = filter.EffectiveOn.Value;
            query = query.Where(x => x.EffectiveFrom <= on && (x.EffectiveTo == null || x.EffectiveTo >= on));
        }

        if (!string.IsNullOrWhiteSpace(filter.Q))
        {
            var term = filter.Q.Trim().ToLower();
            query = query.Where(x => x.InsuranceType.ToLower().Contains(term) || x.Payer.ToLower().Contains(term));
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
        return db.PayrollInsuranceConfigs.AsNoTracking()
            .Where(x => x.Status == "active"
                && x.InsuranceType == insuranceType
                && x.Payer == payer
                && (x.AppliesTo ?? "all") == appliesTo
                && (!excludeId.HasValue || x.ConfigId != excludeId.Value))
            .ToArrayAsync(ct);
    }

    public void AddInsurance(PayrollInsuranceConfig config) => db.PayrollInsuranceConfigs.Add(config);

    // =========================================================================
    // Tax Brackets
    // =========================================================================

    public async Task<TaxBracketDto[]> ListTaxBracketsAsync(PayrollParameterFilter filter, CancellationToken ct)
    {
        var query = db.PayrollTaxBrackets.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(filter.Status))
        {
            var s = filter.Status.Trim().ToLowerInvariant();
            query = query.Where(x => x.Status == s);
        }

        if (filter.EffectiveOn.HasValue)
        {
            var on = filter.EffectiveOn.Value;
            query = query.Where(x => x.EffectiveFrom <= on && (x.EffectiveTo == null || x.EffectiveTo >= on));
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
        return db.PayrollTaxBrackets.AsNoTracking()
            .Where(x => x.Status == "active"
                && (!excludeId.HasValue || x.BracketId != excludeId.Value))
            .ToArrayAsync(ct);
    }

    public void AddTaxBracket(PayrollTaxBracket bracket) => db.PayrollTaxBrackets.Add(bracket);

    public async Task<TaxDeductionPolicyDto> GetTaxDeductionPolicyAsync(CancellationToken ct)
    {
        var policies = await LoadPolicyValuesAsync(ct);
        return new TaxDeductionPolicyDto(
            PolicyDecimal(policies, "tax_personal_deduction", PayrollDefaults.PersonalDeduction),
            PolicyDecimal(policies, "tax_dependent_deduction", PayrollDefaults.DependentDeduction));
    }

    public async Task<TaxPolicySummaryDto> GetTaxPolicySummaryAsync(CancellationToken ct)
    {
        var today = PayrollParameterRules.TodayVn();
        var brackets = await ListTaxBracketsAsync(new PayrollParameterFilter("active", today, null), ct);
        var policies = await LoadPolicyValuesAsync(ct);

        var flatBase = policies.GetValueOrDefault("pit_flat_base");
        return new TaxPolicySummaryDto(
            brackets,
            PolicyDecimal(policies, "tax_personal_deduction", PayrollDefaults.PersonalDeduction),
            PolicyDecimal(policies, "tax_dependent_deduction", PayrollDefaults.DependentDeduction),
            PolicyDecimal(policies, "tax_flat_threshold", PayrollDefaults.FlatTaxThreshold),
            PolicyDecimal(policies, "tax_flat_rate", PayrollDefaults.FlatTaxRatePercent),
            PolicyDecimal(policies, "payroll_rounding_unit", PayrollDefaults.RoundingUnit),
            PolicyBool(policies, "pit_deduct_insurance_before_tax", PayrollDefaults.DeductInsuranceBeforeTax),
            PolicyBool(policies, "pit_deduct_union_fee_before_tax", PayrollDefaults.DeductUnionFeeBeforeTax),
            PolicyBool(policies, "pit_deduct_other_before_tax", PayrollDefaults.DeductOtherBeforeTax),
            string.IsNullOrWhiteSpace(flatBase) ? PayrollDefaults.FlatTaxBase : flatBase);
    }

    private async Task<Dictionary<string, string?>> LoadPolicyValuesAsync(CancellationToken ct)
    {
        var rows = await db.SystemPolicies.AsNoTracking()
            .Select(p => new { p.PolicyKey, p.PolicyValue })
            .ToArrayAsync(ct);
        return rows.GroupBy(p => p.PolicyKey).ToDictionary(g => g.Key, g => (string?)g.First().PolicyValue);
    }

    // Policy values are stored culture-independently ("10.5"), so parse with the invariant culture.
    private static decimal PolicyDecimal(Dictionary<string, string?> policies, string key, decimal fallback)
        => policies.TryGetValue(key, out var raw)
            && decimal.TryParse(raw, NumberStyles.Number, CultureInfo.InvariantCulture, out var value)
            ? value
            : fallback;

    private static bool PolicyBool(Dictionary<string, string?> policies, string key, bool fallback)
        => policies.TryGetValue(key, out var raw) && bool.TryParse(raw, out var value) ? value : fallback;

    public async Task<TaxPolicySummaryDto> UpdateTaxPolicyFlagsAsync(UpdateTaxPolicyFlagsRequest request, Guid updatedBy, CancellationToken ct)
    {
        var policies = await db.SystemPolicies.Where(p =>
            p.PolicyKey == "pit_deduct_union_fee_before_tax" ||
            p.PolicyKey == "pit_deduct_other_before_tax" ||
            p.PolicyKey == "pit_flat_base"
        ).ToListAsync(ct);

        if (request.DeductUnionFeeBeforeTax.HasValue)
        {
            var p = policies.FirstOrDefault(x => x.PolicyKey == "pit_deduct_union_fee_before_tax");
            if (p != null)
            {
                p.PolicyValue = request.DeductUnionFeeBeforeTax.Value ? "true" : "false";
                p.UpdatedBy = updatedBy == Guid.Empty ? null : updatedBy;
                p.UpdatedAt = DateTime.UtcNow;
            }
            else
            {
                db.SystemPolicies.Add(new SystemPolicy
                {
                    PolicyId = Guid.NewGuid(),
                    PolicyKey = "pit_deduct_union_fee_before_tax",
                    PolicyValue = request.DeductUnionFeeBeforeTax.Value ? "true" : "false",
                    ValueType = "boolean",
                    Description = "Khấu trừ đoàn phí công đoàn trước khi tính thuế TNCN",
                    UpdatedBy = updatedBy == Guid.Empty ? null : updatedBy,
                    UpdatedAt = DateTime.UtcNow
                });
            }
        }

        if (request.DeductOtherBeforeTax.HasValue)
        {
            var p = policies.FirstOrDefault(x => x.PolicyKey == "pit_deduct_other_before_tax");
            if (p != null)
            {
                p.PolicyValue = request.DeductOtherBeforeTax.Value ? "true" : "false";
                p.UpdatedBy = updatedBy == Guid.Empty ? null : updatedBy;
                p.UpdatedAt = DateTime.UtcNow;
            }
            else
            {
                db.SystemPolicies.Add(new SystemPolicy
                {
                    PolicyId = Guid.NewGuid(),
                    PolicyKey = "pit_deduct_other_before_tax",
                    PolicyValue = request.DeductOtherBeforeTax.Value ? "true" : "false",
                    ValueType = "boolean",
                    Description = "Khấu trừ các khoản khác trước thuế (chờ phòng khám xác nhận)",
                    UpdatedBy = updatedBy == Guid.Empty ? null : updatedBy,
                    UpdatedAt = DateTime.UtcNow
                });
            }
        }

        if (!string.IsNullOrWhiteSpace(request.FlatTaxBase))
        {
            var p = policies.FirstOrDefault(x => x.PolicyKey == "pit_flat_base");
            var baseVal = request.FlatTaxBase.ToLowerInvariant() == "after_deductions" ? "after_deductions" : "gross";
            if (p != null)
            {
                p.PolicyValue = baseVal;
                p.UpdatedBy = updatedBy == Guid.Empty ? null : updatedBy;
                p.UpdatedAt = DateTime.UtcNow;
            }
            else
            {
                db.SystemPolicies.Add(new SystemPolicy
                {
                    PolicyId = Guid.NewGuid(),
                    PolicyKey = "pit_flat_base",
                    PolicyValue = baseVal,
                    ValueType = "string",
                    Description = "Cơ sở tính thuế 10% (gross | after_deductions, chờ phòng khám xác nhận)",
                    UpdatedBy = updatedBy == Guid.Empty ? null : updatedBy,
                    UpdatedAt = DateTime.UtcNow
                });
            }
        }

        await db.SaveChangesAsync(ct);
        return await GetTaxPolicySummaryAsync(ct);
    }

    // =========================================================================
    // Payroll Rate Configs
    // =========================================================================

    public async Task<PayrollRateConfigDto[]> ListRateConfigsAsync(PayrollRateConfigFilter filter, CancellationToken ct)
    {
        var query = from rc in db.PayrollRateConfigs.AsNoTracking()
                    join pos in db.Positions.AsNoTracking() on rc.PositionId equals pos.PositionId into positions
                    from p in positions.DefaultIfEmpty()
                    join st in db.Staff.AsNoTracking() on rc.StaffId equals st.StaffId into staffs
                    from s in staffs.DefaultIfEmpty()
                    select new
                    {
                        RateConfig = rc,
                        PositionName = p != null ? p.Name : null,
                        StaffCode = s != null ? s.StaffCode : null,
                        StaffName = s != null ? s.FullName : null
                    };

        if (!string.IsNullOrWhiteSpace(filter.Code))
        {
            var c = filter.Code.Trim().ToLowerInvariant();
            query = query.Where(x => x.RateConfig.Code.ToLower() == c);
        }

        if (filter.PositionId.HasValue)
        {
            query = query.Where(x => x.RateConfig.PositionId == filter.PositionId.Value);
        }

        if (filter.StaffId.HasValue)
        {
            query = query.Where(x => x.RateConfig.StaffId == filter.StaffId.Value);
        }

        if (!string.IsNullOrWhiteSpace(filter.Status))
        {
            var s = filter.Status.Trim().ToLowerInvariant();
            query = query.Where(x => x.RateConfig.Status == s);
        }

        if (filter.EffectiveOn.HasValue)
        {
            var on = filter.EffectiveOn.Value;
            query = query.Where(x => x.RateConfig.EffectiveFrom <= on && (x.RateConfig.EffectiveTo == null || x.RateConfig.EffectiveTo >= on));
        }

        if (!string.IsNullOrWhiteSpace(filter.Q))
        {
            var term = filter.Q.Trim().ToLower();
            query = query.Where(x =>
                x.RateConfig.Code.ToLower().Contains(term)
                || (x.RateConfig.Description != null && x.RateConfig.Description.ToLower().Contains(term))
                || (x.PositionName != null && x.PositionName.ToLower().Contains(term))
                || (x.StaffName != null && x.StaffName.ToLower().Contains(term))
                || (x.StaffCode != null && x.StaffCode.ToLower().Contains(term)));
        }

        return await query
            .OrderBy(x => x.RateConfig.Code)
            .ThenBy(x => x.RateConfig.PositionId)
            .ThenBy(x => x.RateConfig.StaffId)
            .ThenByDescending(x => x.RateConfig.EffectiveFrom)
            .Select(x => new PayrollRateConfigDto(
                x.RateConfig.ConfigId,
                x.RateConfig.Code,
                x.RateConfig.PositionId,
                x.PositionName,
                x.RateConfig.StaffId,
                x.StaffCode,
                x.StaffName,
                x.RateConfig.Value,
                x.RateConfig.Unit,
                x.RateConfig.Description,
                x.RateConfig.EffectiveFrom,
                x.RateConfig.EffectiveTo,
                x.RateConfig.Status ?? "active",
                x.RateConfig.CreatedBy,
                x.RateConfig.CreatedAt,
                null))
            .ToArrayAsync(ct);
    }

    public Task<PayrollRateConfig?> FindRateConfigAsync(Guid id, CancellationToken ct)
        => db.PayrollRateConfigs.SingleOrDefaultAsync(x => x.ConfigId == id, ct);

    public Task<PayrollRateConfig[]> GetOverlappingRateConfigsAsync(
        string code, Guid? positionId, Guid? staffId, DateOnly from, DateOnly? to, Guid? excludeId, CancellationToken ct)
    {
        return db.PayrollRateConfigs.AsNoTracking()
            .Where(x => x.Status == "active"
                && x.Code == code
                && x.PositionId == positionId
                && x.StaffId == staffId
                && (!excludeId.HasValue || x.ConfigId != excludeId.Value))
            .ToArrayAsync(ct);
    }

    public void AddRateConfig(PayrollRateConfig config) => db.PayrollRateConfigs.Add(config);

    // =========================================================================
    // Commission Rules
    // =========================================================================

    public async Task<CommissionRuleDto[]> ListCommissionRulesAsync(CommissionRuleFilter filter, CancellationToken ct)
    {
        var query = from r in db.CommissionRules.AsNoTracking()
                    join s in db.ProcedureServices.AsNoTracking() on r.ServiceId equals s.ServiceId into services
                    from srv in services.DefaultIfEmpty()
                    join p in db.Positions.AsNoTracking() on r.PositionId equals p.PositionId into positions
                    from pos in positions.DefaultIfEmpty()
                    select new
                    {
                        Rule = r,
                        Service = srv,
                        PositionName = pos != null ? pos.Name : null
                    };

        if (filter.ServiceId.HasValue)
        {
            query = query.Where(x => x.Rule.ServiceId == filter.ServiceId.Value);
        }

        if (!string.IsNullOrWhiteSpace(filter.ServiceCategory))
        {
            var cat = filter.ServiceCategory.Trim().ToLowerInvariant();
            query = query.Where(x => (x.Rule.ServiceCategory != null && x.Rule.ServiceCategory.ToLower() == cat)
                || (x.Service != null && x.Service.Category != null && x.Service.Category.ToLower() == cat));
        }

        if (filter.PositionId.HasValue)
        {
            query = query.Where(x => x.Rule.PositionId == filter.PositionId.Value);
        }

        if (!string.IsNullOrWhiteSpace(filter.Role))
        {
            var role = filter.Role.Trim().ToLowerInvariant();
            query = query.Where(x => x.Rule.Role.ToLower() == role);
        }

        if (!string.IsNullOrWhiteSpace(filter.TimeCondition))
        {
            var tc = filter.TimeCondition.Trim().ToLowerInvariant();
            query = query.Where(x => x.Rule.TimeCondition.ToLower() == tc);
        }

        if (!string.IsNullOrWhiteSpace(filter.Status))
        {
            var s = filter.Status.Trim().ToLowerInvariant();
            query = query.Where(x => x.Rule.Status == s);
        }

        if (filter.EffectiveOn.HasValue)
        {
            var on = filter.EffectiveOn.Value;
            query = query.Where(x => x.Rule.EffectiveFrom <= on && (x.Rule.EffectiveTo == null || x.Rule.EffectiveTo >= on));
        }

        if (!string.IsNullOrWhiteSpace(filter.Q))
        {
            var term = filter.Q.Trim().ToLower();
            query = query.Where(x =>
                (x.Service != null && x.Service.ServiceCode.ToLower().Contains(term))
                || (x.Service != null && x.Service.ServiceName.ToLower().Contains(term))
                || (x.Rule.ServiceCategory != null && x.Rule.ServiceCategory.ToLower().Contains(term))
                || x.Rule.Role.ToLower().Contains(term)
                || (x.PositionName != null && x.PositionName.ToLower().Contains(term)));
        }

        return await query
            .OrderBy(x => x.Service != null ? x.Service.Category : x.Rule.ServiceCategory)
            .ThenBy(x => x.Service != null ? x.Service.ServiceCode : string.Empty)
            .ThenBy(x => x.Rule.Role)
            .ThenByDescending(x => x.Rule.EffectiveFrom)
            .Select(x => new CommissionRuleDto(
                x.Rule.RuleId,
                x.Rule.ServiceId,
                x.Service != null ? x.Service.ServiceCode : null,
                x.Service != null ? x.Service.ServiceName : null,
                x.Rule.ServiceCategory ?? (x.Service != null ? x.Service.Category : null),
                x.Rule.PositionId,
                x.PositionName,
                x.Rule.Role,
                x.Rule.TimeCondition ?? "all",
                x.Rule.ValueType,
                x.Rule.CommissionValue,
                x.Rule.EffectiveFrom,
                x.Rule.EffectiveTo,
                x.Rule.Status ?? "active",
                x.Rule.CreatedBy,
                x.Rule.CreatedAt,
                null))
            .ToArrayAsync(ct);
    }

    public Task<CommissionRule?> FindCommissionRuleAsync(Guid id, CancellationToken ct)
        => db.CommissionRules.SingleOrDefaultAsync(x => x.RuleId == id, ct);

    public Task<CommissionRule[]> GetOverlappingCommissionRulesAsync(
        Guid? serviceId, string? serviceCategory, string role, Guid? positionId, string timeCondition, DateOnly from, DateOnly? to, Guid? excludeId, CancellationToken ct)
    {
        return db.CommissionRules.AsNoTracking()
            .Where(x => x.Status == "active"
                && x.ServiceId == serviceId
                && x.ServiceCategory == serviceCategory
                && x.Role == role
                && x.PositionId == positionId
                && (x.TimeCondition ?? "all") == timeCondition
                && (!excludeId.HasValue || x.RuleId != excludeId.Value))
            .ToArrayAsync(ct);
    }

    public void AddCommissionRule(CommissionRule rule) => db.CommissionRules.Add(rule);

    public async Task<CommissionMatrixDto> GetCommissionMatrixAsync(CancellationToken ct)
    {
        var services = await db.ProcedureServices.AsNoTracking()
            .Where(x => x.Status == "active")
            .OrderBy(x => x.Category)
            .ThenBy(x => x.ServiceCode)
            .ToArrayAsync(ct);

        var today = PayrollParameterRules.TodayVn();
        var rules = await (
            from r in db.CommissionRules.AsNoTracking()
            where r.Status == "active" && r.EffectiveFrom <= today && (r.EffectiveTo == null || r.EffectiveTo >= today)
            join p in db.Positions.AsNoTracking() on r.PositionId equals p.PositionId into positions
            from pos in positions.DefaultIfEmpty()
            select new
            {
                Rule = r,
                PositionName = pos != null ? pos.Name : null
            }
        ).ToArrayAsync(ct);

        var roles = PayrollParameterRules.CommissionRoles; // ["indicating", "performing", "assisting", "lab", "typist"]

        // Group services by category
        var categories = services
            .Select(s => string.IsNullOrWhiteSpace(s.Category) ? "Khác" : s.Category)
            .Distinct()
            .OrderBy(c => c)
            .ToList();

        // Also check if there are category rules that don't match existing services categories
        var catRuleNames = rules
            .Where(r => r.Rule.ServiceId == null && !string.IsNullOrWhiteSpace(r.Rule.ServiceCategory))
            .Select(r => r.Rule.ServiceCategory!)
            .Distinct();

        foreach (var c in catRuleNames)
        {
            if (!categories.Contains(c, StringComparer.OrdinalIgnoreCase))
            {
                categories.Add(c);
            }
        }

        var groups = new List<CommissionMatrixGroupDto>();

        foreach (var cat in categories)
        {
            var catServices = services.Where(s => (string.IsNullOrWhiteSpace(s.Category) ? "Khác" : s.Category) == cat).ToList();
            var rows = new List<CommissionMatrixRowDto>();

            // 1. Category fallback rule row if category rules exist
            var categoryLevelRules = rules.Where(r => r.Rule.ServiceId == null && string.Equals(r.Rule.ServiceCategory, cat, StringComparison.OrdinalIgnoreCase)).ToList();
            if (categoryLevelRules.Count > 0)
            {
                var catCells = new Dictionary<string, CommissionMatrixCellDto?>();
                foreach (var role in roles)
                {
                    var match = categoryLevelRules.FirstOrDefault(r => r.Rule.Role == role);
                    catCells[role] = match == null ? null : new CommissionMatrixCellDto(
                        match.Rule.RuleId,
                        match.Rule.ValueType,
                        match.Rule.CommissionValue,
                        match.Rule.TimeCondition ?? "all",
                        match.Rule.PositionId,
                        match.PositionName,
                        match.Rule.EffectiveFrom,
                        match.Rule.EffectiveTo,
                        match.Rule.Status ?? "active");
                }

                rows.Add(new CommissionMatrixRowDto(
                    null,
                    null,
                    $"[Nhóm chung] {cat}",
                    cat,
                    null,
                    catCells));
            }

            // 2. Specific service rows
            foreach (var srv in catServices)
            {
                var srvRules = rules.Where(r => r.Rule.ServiceId == srv.ServiceId).ToList();
                var cells = new Dictionary<string, CommissionMatrixCellDto?>();

                foreach (var role in roles)
                {
                    // If service specific rule exists, use it; else fallback to category rule
                    var match = srvRules.FirstOrDefault(r => r.Rule.Role == role)
                        ?? categoryLevelRules.FirstOrDefault(r => r.Rule.Role == role);

                    cells[role] = match == null ? null : new CommissionMatrixCellDto(
                        match.Rule.RuleId,
                        match.Rule.ValueType,
                        match.Rule.CommissionValue,
                        match.Rule.TimeCondition ?? "all",
                        match.Rule.PositionId,
                        match.PositionName,
                        match.Rule.EffectiveFrom,
                        match.Rule.EffectiveTo,
                        match.Rule.Status ?? "active");
                }

                rows.Add(new CommissionMatrixRowDto(
                    srv.ServiceId,
                    srv.ServiceCode,
                    srv.ServiceName,
                    cat,
                    srv.BasePrice,
                    cells));
            }

            if (rows.Count > 0)
            {
                groups.Add(new CommissionMatrixGroupDto(cat, rows));
            }
        }

        return new CommissionMatrixDto(groups);
    }

    public async Task<ProcedureServiceOptionDto[]> ListActiveProcedureServicesAsync(CancellationToken ct)
    {
        return await db.ProcedureServices.AsNoTracking()
            .Where(x => x.Status == "active")
            .OrderBy(x => x.Category)
            .ThenBy(x => x.ServiceCode)
            .Select(x => new ProcedureServiceOptionDto(
                x.ServiceId,
                x.ServiceCode,
                x.ServiceName,
                x.Category,
                x.BasePrice))
            .ToArrayAsync(ct);
    }

    public Task<bool> ServiceExistsAndActiveAsync(Guid serviceId, CancellationToken ct)
        => db.ProcedureServices.AnyAsync(x => x.ServiceId == serviceId && x.Status == "active", ct);

    // =========================================================================
    // Staff Commission Overrides
    // =========================================================================

    public async Task<StaffCommissionOverrideDto[]> ListStaffCommissionOverridesAsync(StaffCommissionOverrideFilter filter, CancellationToken ct)
    {
        var query = from ov in db.StaffCommissionOverrides.AsNoTracking()
                    join st in db.Staff.AsNoTracking() on ov.StaffId equals st.StaffId
                    join srv in db.ProcedureServices.AsNoTracking() on ov.ServiceId equals srv.ServiceId into services
                    from s in services.DefaultIfEmpty()
                    select new
                    {
                        Override = ov,
                        Staff = st,
                        Service = s
                    };

        if (filter.StaffId.HasValue)
        {
            query = query.Where(x => x.Override.StaffId == filter.StaffId.Value);
        }

        if (filter.ServiceId.HasValue)
        {
            query = query.Where(x => x.Override.ServiceId == filter.ServiceId.Value);
        }

        if (!string.IsNullOrWhiteSpace(filter.ServiceCategory))
        {
            var cat = filter.ServiceCategory.Trim().ToLowerInvariant();
            query = query.Where(x => (x.Override.ServiceCategory != null && x.Override.ServiceCategory.ToLower() == cat)
                || (x.Service != null && x.Service.Category != null && x.Service.Category.ToLower() == cat));
        }

        if (!string.IsNullOrWhiteSpace(filter.Role))
        {
            var role = filter.Role.Trim().ToLowerInvariant();
            query = query.Where(x => x.Override.Role.ToLower() == role);
        }

        if (!string.IsNullOrWhiteSpace(filter.Status))
        {
            var s = filter.Status.Trim().ToLowerInvariant();
            query = query.Where(x => x.Override.Status == s);
        }

        if (filter.EffectiveOn.HasValue)
        {
            var on = filter.EffectiveOn.Value;
            query = query.Where(x => x.Override.EffectiveFrom <= on && (x.Override.EffectiveTo == null || x.Override.EffectiveTo >= on));
        }

        if (!string.IsNullOrWhiteSpace(filter.Q))
        {
            var term = filter.Q.Trim().ToLower();
            query = query.Where(x =>
                x.Staff.StaffCode.ToLower().Contains(term)
                || x.Staff.FullName.ToLower().Contains(term)
                || (x.Service != null && x.Service.ServiceCode.ToLower().Contains(term))
                || (x.Service != null && x.Service.ServiceName.ToLower().Contains(term))
                || (x.Override.ServiceCategory != null && x.Override.ServiceCategory.ToLower().Contains(term))
                || x.Override.Role.ToLower().Contains(term));
        }

        return await query
            .OrderBy(x => x.Staff.StaffCode)
            .ThenBy(x => x.Override.Role)
            .ThenByDescending(x => x.Override.EffectiveFrom)
            .Select(x => new StaffCommissionOverrideDto(
                x.Override.OverrideId,
                x.Override.StaffId,
                x.Staff.StaffCode,
                x.Staff.FullName,
                x.Override.ServiceId,
                x.Service != null ? x.Service.ServiceCode : null,
                x.Service != null ? x.Service.ServiceName : null,
                x.Override.ServiceCategory ?? (x.Service != null ? x.Service.Category : null),
                x.Override.Role,
                x.Override.TimeCondition ?? "all",
                x.Override.ValueType,
                x.Override.CommissionValue,
                x.Override.EffectiveFrom,
                x.Override.EffectiveTo,
                x.Override.Status ?? "active",
                x.Override.CreatedBy,
                x.Override.CreatedAt,
                null))
            .ToArrayAsync(ct);
    }

    public Task<StaffCommissionOverride?> FindStaffCommissionOverrideAsync(Guid id, CancellationToken ct)
        => db.StaffCommissionOverrides.SingleOrDefaultAsync(x => x.OverrideId == id, ct);

    public Task<StaffCommissionOverride[]> GetOverlappingStaffCommissionOverridesAsync(
        Guid staffId, Guid? serviceId, string? serviceCategory, string role, string timeCondition, DateOnly from, DateOnly? to, Guid? excludeId, CancellationToken ct)
    {
        return db.StaffCommissionOverrides.AsNoTracking()
            .Where(x => x.Status == "active"
                && x.StaffId == staffId
                && x.ServiceId == serviceId
                && x.ServiceCategory == serviceCategory
                && x.Role == role
                && (x.TimeCondition ?? "all") == timeCondition
                && (!excludeId.HasValue || x.OverrideId != excludeId.Value))
            .ToArrayAsync(ct);
    }

    public void AddStaffCommissionOverride(StaffCommissionOverride overrideEntity)
        => db.StaffCommissionOverrides.Add(overrideEntity);

    // =========================================================================
    // Dropdowns & Validation lookups
    // =========================================================================

    public async Task<PositionOptionDto[]> ListPositionsAsync(CancellationToken ct)
    {
        return await db.Positions.AsNoTracking()
            .Where(x => x.Status == "active")
            .OrderBy(x => x.Name)
            .Select(x => new PositionOptionDto(x.PositionId, x.Name, x.ScopeTag))
            .ToArrayAsync(ct);
    }

    public Task<bool> PositionExistsAndActiveAsync(Guid positionId, CancellationToken ct)
        => db.Positions.AnyAsync(x => x.PositionId == positionId && x.Status == "active", ct);

    public async Task<SiteOptionDto[]> ListSitesAsync(CancellationToken ct)
    {
        return await db.Sites.AsNoTracking()
            .Where(x => x.Status == "active")
            .OrderBy(x => x.SiteCode)
            .Select(x => new SiteOptionDto(x.SiteId, x.SiteCode, x.Name, x.Address))
            .ToArrayAsync(ct);
    }

    public Task<bool> StaffExistsAndActiveAsync(Guid staffId, CancellationToken ct)
        => db.Staff.AnyAsync(x => x.StaffId == staffId && x.Status == "active", ct);

    // =========================================================================
    // Locked & Open months
    // =========================================================================

    public Task<string[]> GetLockedMonthsAsync(CancellationToken ct)
    {
        return db.PayrollLocks.AsNoTracking()
            .Where(x => x.Status == "finalized" || x.Status == "exported")
            .Select(x => x.PayMonth)
            .Distinct()
            .OrderBy(x => x)
            .ToArrayAsync(ct);
    }

    public Task<string[]> GetOpenMonthsAsync(CancellationToken ct)
    {
        return db.PayrollLocks.AsNoTracking()
            .Where(x => x.Status == "open" || x.Status == "reviewing")
            .Select(x => x.PayMonth)
            .Distinct()
            .OrderBy(x => x)
            .ToArrayAsync(ct);
    }

    private sealed record PolicyRow(string PolicyKey, string PolicyValue);
}
