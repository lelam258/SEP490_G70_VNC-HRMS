using Microsoft.EntityFrameworkCore;
using Vnc.HRMS.DTOs.Payroll;
using Vnc.HRMS.Models;
using Vnc.HRMS.Persistence;
using Vnc.HRMS.Repositories.Interfaces;

namespace Vnc.HRMS.Repositories;

public sealed class PayrollPeriodRepository(AppDbContext db) : IPayrollPeriodRepository
{
    private static string NormalizeStatus(string? rawStatus)
    {
        if (string.IsNullOrWhiteSpace(rawStatus)) return "draft";
        var s = rawStatus.Trim().ToLowerInvariant();
        return s == "open" ? "draft" : s;
    }

    public async Task<List<PayrollPeriodDto>> ListPeriodsAsync(CancellationToken ct)
    {
        var locks = await db.PayrollLocks.AsNoTracking()
            .OrderByDescending(x => x.PayMonth)
            .ToListAsync(ct);

        // Group payslips by PayMonth to get count and sum of NetPay
        var payslipAggregates = await db.Payslips.AsNoTracking()
            .GroupBy(p => p.PayMonth)
            .Select(g => new
            {
                PayMonth = g.Key,
                Count = g.Count(),
                TotalNetPay = g.Sum(x => x.NetPay ?? 0m)
            })
            .ToDictionaryAsync(x => x.PayMonth, ct);

        return locks.Select(pl =>
        {
            payslipAggregates.TryGetValue(pl.PayMonth, out var agg);
            return new PayrollPeriodDto(
                pl.LockId,
                pl.PayMonth,
                NormalizeStatus(pl.Status),
                agg?.Count ?? 0,
                agg?.TotalNetPay ?? 0m,
                pl.LockedAt,
                pl.CreatedAt
            );
        }).ToList();
    }

    public Task<PayrollLock?> FindByMonthAsync(string payMonth, CancellationToken ct)
        => db.PayrollLocks.SingleOrDefaultAsync(x => x.PayMonth == payMonth, ct);

    public async Task<PayrollPeriodDetailDto?> GetPeriodDetailAsync(string payMonth, CancellationToken ct)
    {
        var pl = await db.PayrollLocks.AsNoTracking().SingleOrDefaultAsync(x => x.PayMonth == payMonth, ct);
        if (pl is null) return null;

        var payslipRows = await (
            from ps in db.Payslips.AsNoTracking()
            where ps.PayMonth == payMonth
            join s in db.Staff.AsNoTracking() on ps.StaffId equals s.StaffId into staffJoin
            from s in staffJoin.DefaultIfEmpty()
            join d in db.Departments.AsNoTracking() on ps.DepartmentId equals d.DepartmentId into deptJoin
            from d in deptJoin.DefaultIfEmpty()
            select new PayslipSummaryItemDto(
                ps.PayslipId,
                ps.StaffId,
                s != null ? s.StaffCode : null,
                ps.StaffName ?? (s != null ? s.FullName : null),
                d != null ? d.Name : null,
                ps.BasePay ?? 0m,
                ps.AllowanceTotal ?? 0m,
                ps.GrossPay ?? 0m,
                ps.InsuranceDeduction ?? 0m,
                ps.TaxDeduction ?? 0m,
                ps.NetPay ?? 0m,
                ps.Status
            )
        ).ToListAsync(ct);

        var employeeCount = payslipRows.Count;
        var totalNetPay = payslipRows.Sum(x => x.NetPay);

        return new PayrollPeriodDetailDto(
            pl.LockId,
            pl.PayMonth,
            NormalizeStatus(pl.Status),
            employeeCount,
            totalNetPay,
            pl.LockedAt,
            pl.CreatedAt,
            payslipRows
        );
    }

    public void AddPeriod(PayrollLock period)
        => db.PayrollLocks.Add(period);
}
