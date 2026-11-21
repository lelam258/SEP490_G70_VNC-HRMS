using Microsoft.EntityFrameworkCore;
using Vnc.HRMS.DTOs.Employees;
using Vnc.HRMS.Models.Employees;
using Vnc.HRMS.Persistence;
using Vnc.HRMS.Repositories.Interfaces;
using Vnc.HRMS.Services.Rules;

namespace Vnc.HRMS.Repositories;

public sealed class ContractRepository(AppDbContext db) : IContractRepository
{
    public Task<ContractListItemDto[]> ListAsync(CancellationToken ct)
        => (from c in db.Contracts.AsNoTracking()
            join s in db.Staff.AsNoTracking() on c.StaffId equals s.StaffId
            join d in db.Departments.AsNoTracking() on s.DepartmentId equals d.DepartmentId into depts
            from dept in depts.DefaultIfEmpty()
            join p in db.Positions.AsNoTracking() on s.PositionId equals p.PositionId into positions
            from pos in positions.DefaultIfEmpty()
            join site in db.Sites.AsNoTracking() on s.SiteId equals site.SiteId into sites
            from st in sites.DefaultIfEmpty()
            orderby c.EffectiveFrom descending, s.FullName
            select new ContractListItemDto(
                c.ContractId, c.ContractCode, s.StaffId, s.StaffCode, s.FullName,
                s.DepartmentId, dept != null ? dept.Name : null,
                pos != null ? pos.Name : null, st != null ? st.Name : null,
                c.ContractType, c.SalaryType, c.EffectiveFrom, c.EffectiveTo, c.Status, c.FileUrl, ""))
            .ToArrayAsync(ct);

    public Task<ContractDetailDto?> GetDetailAsync(Guid contractId, CancellationToken ct)
        => (from c in db.Contracts.AsNoTracking()
            where c.ContractId == contractId
            join s in db.Staff.AsNoTracking() on c.StaffId equals s.StaffId
            join d in db.Departments.AsNoTracking() on s.DepartmentId equals d.DepartmentId into depts
            from dept in depts.DefaultIfEmpty()
            join p in db.Positions.AsNoTracking() on s.PositionId equals p.PositionId into positions
            from pos in positions.DefaultIfEmpty()
            join site in db.Sites.AsNoTracking() on s.SiteId equals site.SiteId into sites
            from st in sites.DefaultIfEmpty()
            select new ContractDetailDto(
                c.ContractId, c.ContractCode, s.StaffId, s.StaffCode, s.FullName, s.Email,
                dept != null ? dept.Name : null, pos != null ? pos.Name : null, st != null ? st.Name : null,
                c.ContractType, c.SalaryType, c.DailyRate, c.MonthlySalary, c.StandardWorkingDays,
                c.IsInsuranceEligible, c.InsuranceSalaryBasis, c.TaxMethod,
                c.EffectiveFrom, c.EffectiveTo, c.Status, c.FileUrl, c.CreatedAt, c.UpdatedAt, ""))
            .FirstOrDefaultAsync(ct);

    public Task<Contract?> FindAsync(Guid contractId, CancellationToken ct)
        => db.Contracts.FirstOrDefaultAsync(x => x.ContractId == contractId, ct);

    public Task<Staff?> FindStaffAsync(Guid staffId, CancellationToken ct)
        => db.Staff.AsNoTracking().FirstOrDefaultAsync(x => x.StaffId == staffId, ct);

    public Task<bool> CodeExistsAsync(string code, Guid? excludeContractId, CancellationToken ct)
        => db.Contracts.AnyAsync(x => x.ContractCode == code && x.ContractId != excludeContractId, ct);

    public Task<bool> HasOverlappingActiveAsync(Guid staffId, DateOnly from, DateOnly? to, Guid? excludeContractId, CancellationToken ct)
    {
        var end = to ?? DateOnly.MaxValue;
        return db.Contracts.AnyAsync(x =>
            x.StaffId == staffId
            && x.ContractId != excludeContractId
            && x.Status == PayrollParameterRules.Active
            && x.EffectiveFrom <= end
            && (x.EffectiveTo == null || x.EffectiveTo >= from), ct);
    }

    public Task<ContractSalaryHistory[]> ListSalaryHistoriesAsync(Guid contractId, CancellationToken ct)
        => db.ContractSalaryHistories.Where(x => x.ContractId == contractId).ToArrayAsync(ct);

    public void Add(Contract contract) => db.Contracts.Add(contract);
}
