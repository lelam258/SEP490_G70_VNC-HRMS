using Microsoft.EntityFrameworkCore;
using Vnc.HRMS.DTOs.Payroll;
using Vnc.HRMS.Models;
using Vnc.HRMS.Models.Employees;
using Vnc.HRMS.Persistence;
using Vnc.HRMS.Repositories.Interfaces;
using Vnc.HRMS.Services.Rules;

namespace Vnc.HRMS.Repositories;

public sealed class CompensationRepository(AppDbContext db) : ICompensationRepository
{
    public async Task<ContractSummaryDto[]> ListContractsAsync(string? q, string? status, CancellationToken ct)
    {
        var query = from c in db.Contracts.AsNoTracking()
                    join s in db.Staff.AsNoTracking() on c.StaffId equals s.StaffId
                    join d in db.Departments.AsNoTracking() on s.DepartmentId equals d.DepartmentId into depts
                    from dept in depts.DefaultIfEmpty()
                    join site in db.Sites.AsNoTracking() on s.SiteId equals site.SiteId into sites
                    from st in sites.DefaultIfEmpty()
                    select new
                    {
                        Contract = c,
                        Staff = s,
                        DepartmentName = dept != null ? dept.Name : null,
                        SiteId = s.SiteId,
                        SiteName = st != null ? st.Name : null
                    };

        if (!string.IsNullOrWhiteSpace(status))
        {
            var sVal = status.Trim().ToLowerInvariant();
            query = query.Where(x => x.Contract.Status == sVal);
        }

        if (!string.IsNullOrWhiteSpace(q))
        {
            var term = q.Trim().ToLower();
            query = query.Where(x =>
                (x.Contract.ContractCode != null && x.Contract.ContractCode.ToLower().Contains(term))
                || x.Staff.FullName.ToLower().Contains(term)
                || x.Staff.StaffCode.ToLower().Contains(term));
        }

        var rows = await query
            .OrderByDescending(x => x.Contract.CreatedAt)
            .ToArrayAsync(ct);

        var histories = await LoadHistoriesAsync(rows.Select(x => x.Contract.ContractId).ToArray(), ct);
        var today = PayrollParameterRules.TodayVn();

        return rows.Select(x =>
        {
            var timeline = histories.GetValueOrDefault(x.Contract.ContractId) ?? [];
            var current = SalaryInForce(x.Contract, timeline, today);
            return new ContractSummaryDto(
                x.Contract.ContractId,
                x.Contract.StaffId,
                x.Contract.ContractCode,
                x.Staff.StaffCode,
                x.Staff.FullName,
                x.DepartmentName,
                x.Contract.ContractType,
                current.SalaryType,
                current.DailyRate,
                current.MonthlySalary,
                current.StandardWorkingDays,
                current.IsInsuranceEligible,
                current.InsuranceSalaryBasis,
                current.TaxMethod,
                x.SiteId,
                x.SiteName,
                x.Staff.IsUnionMember,
                x.Contract.EffectiveFrom,
                x.Contract.EffectiveTo,
                x.Contract.Status,
                ToDto(ContractSalaryRules.NextAfter(timeline, today)));
        }).ToArray();
    }

    public Task<Contract?> FindContractAsync(Guid contractId, CancellationToken ct)
        => db.Contracts.SingleOrDefaultAsync(x => x.ContractId == contractId, ct);

    public Task<Staff?> FindStaffAsync(Guid staffId, CancellationToken ct)
        => db.Staff.SingleOrDefaultAsync(x => x.StaffId == staffId, ct);

    public async Task<ContractCompensationDto?> GetContractCompensationAsync(Guid contractId, CancellationToken ct)
    {
        var contractInfo = await (
            from c in db.Contracts.AsNoTracking()
            where c.ContractId == contractId
            join s in db.Staff.AsNoTracking() on c.StaffId equals s.StaffId
            join d in db.Departments.AsNoTracking() on s.DepartmentId equals d.DepartmentId into depts
            from dept in depts.DefaultIfEmpty()
            join site in db.Sites.AsNoTracking() on s.SiteId equals site.SiteId into sites
            from st in sites.DefaultIfEmpty()
            select new
            {
                Contract = c,
                Staff = s,
                DepartmentName = dept != null ? dept.Name : null,
                SiteId = s.SiteId,
                SiteName = st != null ? st.Name : null
            }
        ).SingleOrDefaultAsync(ct);

        if (contractInfo is null) return null;

        var allowances = await ListStaffAllowancesAsync(contractInfo.Contract.StaffId, ct);
        var timeline = await ListSalaryHistoryEntriesAsync(contractId, ct);
        var today = PayrollParameterRules.TodayVn();
        var current = SalaryInForce(contractInfo.Contract, timeline, today);

        return new ContractCompensationDto(
            contractInfo.Contract.ContractId,
            contractInfo.Contract.StaffId,
            contractInfo.Contract.ContractCode,
            contractInfo.Staff.StaffCode,
            contractInfo.Staff.FullName,
            contractInfo.DepartmentName,
            contractInfo.Contract.ContractType,
            current.SalaryType,
            current.DailyRate,
            current.MonthlySalary,
            current.StandardWorkingDays,
            current.IsInsuranceEligible,
            current.InsuranceSalaryBasis,
            current.TaxMethod,
            contractInfo.SiteId,
            contractInfo.SiteName,
            contractInfo.Staff.IsUnionMember,
            contractInfo.Contract.EffectiveFrom,
            contractInfo.Contract.EffectiveTo,
            contractInfo.Contract.Status,
            allowances,
            ToDto(ContractSalaryRules.NextAfter(timeline, today)));
    }

    public async Task<StaffAllowanceDto[]> ListStaffAllowancesAsync(Guid staffId, CancellationToken ct)
    {
        return await (
            from sa in db.StaffAllowances.AsNoTracking()
            where sa.StaffId == staffId
            join at in db.AllowanceTypes.AsNoTracking() on sa.AllowanceId equals at.AllowanceId
            orderby sa.EffectiveFrom descending
            select new StaffAllowanceDto(
                sa.StaffAllowanceId,
                sa.StaffId,
                sa.AllowanceId,
                at.Code,
                at.Name,
                sa.ValueType,
                sa.AmountValue,
                sa.CalcMethod ?? "fixed",
                sa.EffectiveFrom,
                sa.EffectiveTo,
                sa.Status,
                sa.ApprovedBy,
                sa.CreatedAt,
                null)
        ).ToArrayAsync(ct);
    }

    public Task<StaffAllowance?> FindStaffAllowanceAsync(Guid staffAllowanceId, CancellationToken ct)
        => db.StaffAllowances.SingleOrDefaultAsync(x => x.StaffAllowanceId == staffAllowanceId, ct);

    public Task<StaffAllowance[]> GetOverlappingStaffAllowancesAsync(
        Guid staffId, Guid allowanceId, DateOnly from, DateOnly? to, Guid? excludeId, CancellationToken ct)
    {
        return db.StaffAllowances.AsNoTracking()
            .Where(x => x.Status == "active"
                && x.StaffId == staffId
                && x.AllowanceId == allowanceId
                && (!excludeId.HasValue || x.StaffAllowanceId != excludeId.Value))
            .ToArrayAsync(ct);
    }

    public void AddStaffAllowance(StaffAllowance staffAllowance) => db.StaffAllowances.Add(staffAllowance);

    public Task<bool> AllowanceExistsAndActiveAsync(Guid allowanceId, CancellationToken ct)
        => db.AllowanceTypes.AnyAsync(x => x.AllowanceId == allowanceId && x.Status == "active", ct);

    public async Task<ContractSalaryHistoryDto[]> ListContractSalaryHistoriesAsync(Guid contractId, CancellationToken ct)
    {
        return await db.ContractSalaryHistories.AsNoTracking()
            .Where(x => x.ContractId == contractId)
            .OrderByDescending(x => x.EffectiveFrom)
            .ThenByDescending(x => x.CreatedAt)
            .Select(x => new ContractSalaryHistoryDto(
                x.HistoryId,
                x.ContractId,
                x.SalaryType,
                x.DailyRate,
                x.MonthlySalary,
                x.StandardWorkingDays,
                x.IsInsuranceEligible ? x.InsuranceSalaryBasis : null,
                x.TaxMethod,
                x.EffectiveFrom,
                x.EffectiveTo,
                x.Note,
                x.CreatedAt))
            .ToArrayAsync(ct);
    }

    public Task<ContractSalaryHistory?> GetLatestSalaryHistoryAsync(Guid contractId, CancellationToken ct)
    {
        return db.ContractSalaryHistories
            .Where(x => x.ContractId == contractId)
            .OrderByDescending(x => x.EffectiveFrom)
            .ThenByDescending(x => x.CreatedAt)
            .FirstOrDefaultAsync(ct);
    }

    public void AddContractSalaryHistory(ContractSalaryHistory history)
        => db.ContractSalaryHistories.Add(history);

    public Task<ContractSalaryHistory[]> ListSalaryHistoryEntriesAsync(Guid contractId, CancellationToken ct)
        => db.ContractSalaryHistories.AsNoTracking()
            .Where(x => x.ContractId == contractId)
            .ToArrayAsync(ct);

    private async Task<Dictionary<Guid, ContractSalaryHistory[]>> LoadHistoriesAsync(Guid[] contractIds, CancellationToken ct)
    {
        if (contractIds.Length == 0) return [];
        var entries = await db.ContractSalaryHistories.AsNoTracking()
            .Where(x => contractIds.Contains(x.ContractId))
            .ToArrayAsync(ct);
        return entries.GroupBy(x => x.ContractId).ToDictionary(g => g.Key, g => g.ToArray());
    }

    private sealed record SalaryValues(
        string SalaryType, decimal DailyRate, decimal? MonthlySalary, decimal? StandardWorkingDays,
        bool IsInsuranceEligible, decimal? InsuranceSalaryBasis, string TaxMethod);

    /// <summary>Salary in force today: the history entry covering today, else the contract's own fields.</summary>
    private static SalaryValues SalaryInForce(Contract contract, IEnumerable<ContractSalaryHistory> timeline, DateOnly today)
    {
        var entry = ContractSalaryRules.EntryOn(timeline, today);
        if (entry is null)
        {
            return new SalaryValues(
                contract.SalaryType ?? "daily", contract.DailyRate, contract.MonthlySalary, contract.StandardWorkingDays,
                contract.IsInsuranceEligible, contract.InsuranceSalaryBasis, contract.TaxMethod ?? "progressive");
        }

        return new SalaryValues(
            entry.SalaryType, entry.DailyRate, entry.MonthlySalary, entry.StandardWorkingDays,
            entry.IsInsuranceEligible, entry.IsInsuranceEligible ? entry.InsuranceSalaryBasis : null, entry.TaxMethod);
    }

    private static ContractSalaryHistoryDto? ToDto(ContractSalaryHistory? x)
        => x is null ? null : new ContractSalaryHistoryDto(
            x.HistoryId, x.ContractId, x.SalaryType, x.DailyRate, x.MonthlySalary, x.StandardWorkingDays,
            x.IsInsuranceEligible ? x.InsuranceSalaryBasis : null, x.TaxMethod, x.EffectiveFrom, x.EffectiveTo, x.Note, x.CreatedAt);
}
