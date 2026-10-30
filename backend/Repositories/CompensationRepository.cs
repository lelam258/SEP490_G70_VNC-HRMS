using Microsoft.EntityFrameworkCore;
using Vnc.HRMS.DTOs.Payroll;
using Vnc.HRMS.Models;
using Vnc.HRMS.Models.Employees;
using Vnc.HRMS.Persistence;
using Vnc.HRMS.Repositories.Interfaces;

namespace Vnc.HRMS.Repositories;

public sealed class CompensationRepository(AppDbContext db) : ICompensationRepository
{
    public async Task<ContractSummaryDto[]> ListContractsAsync(string? q, string? status, CancellationToken ct)
    {
        var query = from c in db.Contracts.AsNoTracking()
                    join s in db.Staff.AsNoTracking() on c.StaffId equals s.StaffId
                    join d in db.Departments.AsNoTracking() on s.DepartmentId equals d.DepartmentId into depts
                    from dept in depts.DefaultIfEmpty()
                    select new
                    {
                        Contract = c,
                        Staff = s,
                        DepartmentName = dept != null ? dept.Name : null
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

        return await query
            .OrderByDescending(x => x.Contract.CreatedAt)
            .Select(x => new ContractSummaryDto(
                x.Contract.ContractId,
                x.Contract.StaffId,
                x.Contract.ContractCode,
                x.Staff.StaffCode,
                x.Staff.FullName,
                x.DepartmentName,
                x.Contract.ContractType,
                x.Contract.DailyRate,
                x.Contract.IsInsuranceEligible,
                x.Contract.InsuranceSalaryBasis,
                x.Contract.EffectiveFrom,
                x.Contract.EffectiveTo,
                x.Contract.Status))
            .ToArrayAsync(ct);
    }

    public Task<Contract?> FindContractAsync(Guid contractId, CancellationToken ct)
        => db.Contracts.SingleOrDefaultAsync(x => x.ContractId == contractId, ct);

    public async Task<ContractCompensationDto?> GetContractCompensationAsync(Guid contractId, CancellationToken ct)
    {
        var contractInfo = await (
            from c in db.Contracts.AsNoTracking()
            where c.ContractId == contractId
            join s in db.Staff.AsNoTracking() on c.StaffId equals s.StaffId
            join d in db.Departments.AsNoTracking() on s.DepartmentId equals d.DepartmentId into depts
            from dept in depts.DefaultIfEmpty()
            select new
            {
                Contract = c,
                Staff = s,
                DepartmentName = dept != null ? dept.Name : null
            }
        ).SingleOrDefaultAsync(ct);

        if (contractInfo is null) return null;

        var allowances = await ListStaffAllowancesAsync(contractInfo.Contract.StaffId, ct);

        return new ContractCompensationDto(
            contractInfo.Contract.ContractId,
            contractInfo.Contract.StaffId,
            contractInfo.Contract.ContractCode,
            contractInfo.Staff.StaffCode,
            contractInfo.Staff.FullName,
            contractInfo.DepartmentName,
            contractInfo.Contract.ContractType,
            contractInfo.Contract.DailyRate,
            contractInfo.Contract.IsInsuranceEligible,
            contractInfo.Contract.InsuranceSalaryBasis,
            contractInfo.Contract.EffectiveFrom,
            contractInfo.Contract.EffectiveTo,
            contractInfo.Contract.Status,
            allowances);
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
}
