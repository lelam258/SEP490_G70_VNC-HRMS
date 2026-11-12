using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Vnc.HRMS.Common.Utils;
using Vnc.HRMS.DTOs.Payroll;
using Vnc.HRMS.Models;
using Vnc.HRMS.Persistence;
using Vnc.HRMS.Repositories.Interfaces;
using Vnc.HRMS.Services.Rules;

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

        var payslipAggregates = await db.Payslips.AsNoTracking()
            .GroupBy(p => p.PayMonth)
            .Select(g => new
            {
                PayMonth = g.Key,
                Count = g.Count(),
                TotalGrossPay = g.Sum(x => x.GrossPay ?? 0m),
                TotalNetPay = g.Sum(x => x.NetPay ?? 0m)
            })
            .ToDictionaryAsync(x => x.PayMonth, ct);

        var lockedTimesheetMonths = (await db.MonthlyTimesheets.AsNoTracking()
            .Where(x => x.Status == "locked" || x.Status == "confirmed")
            .Select(x => x.PayMonth)
            .ToListAsync(ct))
            .ToHashSet();

        var reopenedLockIds = (await db.AuditLogs.AsNoTracking()
            .Where(a => a.EntityType == "PayrollLock" && a.Action == "reopen" && a.EntityId.HasValue)
            .Select(a => a.EntityId!.Value)
            .ToListAsync(ct))
            .ToHashSet();

        var unverifiedProcedureMonths = (await db.ProcedureSlips.AsNoTracking()
            .Where(p => p.Status != "verified" && p.Status != "approved")
            .Select(p => new { Year = p.ProcedureDate.Year, Month = p.ProcedureDate.Month })
            .Distinct()
            .ToListAsync(ct))
            .Select(x => $"{x.Year:D4}-{x.Month:D2}")
            .ToHashSet();

        var today = TimeHelper.TodayInVietnam();

        return locks.Select(pl =>
        {
            payslipAggregates.TryGetValue(pl.PayMonth, out var agg);
            var (y, m) = PayrollPeriodRules.ParsePayMonth(pl.PayMonth);
            var openDate = PayrollPeriodRules.GetConsolidationOpenDate(y, m);
            var standardLockDate = PayrollPeriodRules.GetStandardLockDate(y, m);
            var correctionDeadline = PayrollPeriodRules.GetCorrectionDeadline(y, m);

            var normStatus = NormalizeStatus(pl.Status);
            var isReopened = reopenedLockIds.Contains(pl.LockId);
            var isLate = isReopened || (today > standardLockDate && normStatus != "locked" && normStatus != "finalized" && normStatus != "approved");

            var isFinalOrApproved = normStatus == "approved" || normStatus == "locked" || normStatus == "finalized" || normStatus == "exported";
            var attendanceLocked = isFinalOrApproved || lockedTimesheetMonths.Contains(pl.PayMonth);
            var proceduresVerified = isFinalOrApproved || !unverifiedProcedureMonths.Contains(pl.PayMonth);

            return new PayrollPeriodDto(
                pl.LockId,
                pl.PayMonth,
                normStatus,
                agg?.Count ?? 0,
                agg?.TotalGrossPay ?? 0m,
                agg?.TotalNetPay ?? 0m,
                attendanceLocked,
                proceduresVerified,
                isLate,
                pl.LockedAt,
                pl.CreatedAt,
                openDate,
                standardLockDate,
                correctionDeadline
            );
        }).ToList();
    }

    public Task<PayrollLock?> FindByMonthAsync(string payMonth, CancellationToken ct)
        => db.PayrollLocks.SingleOrDefaultAsync(x => x.PayMonth == payMonth, ct);

    public async Task<bool> HasPaidPayslipsAsync(string payMonth, CancellationToken ct)
        => await db.Payslips.AsNoTracking().AnyAsync(x => x.PayMonth == payMonth && x.PaymentDate != null, ct);

    public Task<List<Payslip>> GetPayslipsByMonthAsync(string payMonth, CancellationToken ct)
        => db.Payslips.Where(x => x.PayMonth == payMonth).ToListAsync(ct);

    public async Task<PayrollPeriodDetailDto?> GetPeriodDetailAsync(string payMonth, CancellationToken ct)
    {
        var pl = await db.PayrollLocks.AsNoTracking().SingleOrDefaultAsync(x => x.PayMonth == payMonth, ct);
        if (pl is null) return null;

        var (y, m) = PayrollPeriodRules.ParsePayMonth(payMonth);
        var openDate = PayrollPeriodRules.GetConsolidationOpenDate(y, m);
        var standardLockDate = PayrollPeriodRules.GetStandardLockDate(y, m);
        var correctionDeadline = PayrollPeriodRules.GetCorrectionDeadline(y, m);
        var normStatus = NormalizeStatus(pl.Status);
        var isFinalOrApproved = normStatus == "approved" || normStatus == "locked" || normStatus == "finalized" || normStatus == "exported";

        var attendanceLocked = isFinalOrApproved || await db.MonthlyTimesheets.AsNoTracking()
            .AnyAsync(x => x.PayMonth == payMonth && (x.Status == "locked" || x.Status == "confirmed"), ct);

        var hasUnverifiedProcedures = await db.ProcedureSlips.AsNoTracking()
            .AnyAsync(p => p.ProcedureDate.Year == y && p.ProcedureDate.Month == m && p.Status != "verified" && p.Status != "approved", ct);
        var proceduresVerified = isFinalOrApproved || !hasUnverifiedProcedures;

        var reopenAudit = await db.AuditLogs.AsNoTracking()
            .Where(a => a.EntityType == "PayrollLock" && a.EntityId == pl.LockId && a.Action == "reopen")
            .OrderByDescending(a => a.CreatedAt)
            .FirstOrDefaultAsync(ct);

        string? reopenReason = null;
        if (reopenAudit?.NewValue is not null)
        {
            try
            {
                using var doc = JsonDocument.Parse(reopenAudit.NewValue);
                if (doc.RootElement.TryGetProperty("reason", out var reasonElem))
                {
                    reopenReason = reasonElem.GetString();
                }
            }
            catch
            {
                reopenReason = reopenAudit.NewValue;
            }
        }

        var today = TimeHelper.TodayInVietnam();
        var isLate = reopenAudit is not null || (today > standardLockDate && normStatus != "locked" && normStatus != "finalized" && normStatus != "approved");

        var activeContractStaffIds = (await db.Contracts.AsNoTracking()
            .Where(c => c.Status == "active")
            .Select(c => c.StaffId)
            .ToListAsync(ct))
            .ToHashSet();

        var payslipRows = await (
            from ps in db.Payslips.AsNoTracking()
            where ps.PayMonth == payMonth
            join s in db.Staff.AsNoTracking() on ps.StaffId equals s.StaffId into staffJoin
            from s in staffJoin.DefaultIfEmpty()
            join d in db.Departments.AsNoTracking() on ps.DepartmentId equals d.DepartmentId into deptJoin
            from d in deptJoin.DefaultIfEmpty()
            select new
            {
                ps.PayslipId,
                ps.StaffId,
                StaffCode = s != null ? s.StaffCode : null,
                StaffName = ps.StaffName ?? (s != null ? s.FullName : null),
                DepartmentName = d != null ? d.Name : null,
                WorkDays = ps.WorkDays ?? 0m,
                OnCallDays = ps.OnCallDays ?? 0m,
                BasePay = ps.BasePay ?? 0m,
                AllowanceTotal = ps.AllowanceTotal ?? 0m,
                CommissionTotal = ps.CommissionTotal ?? 0m,
                GrossPay = ps.GrossPay ?? 0m,
                InsuranceDeduction = ps.InsuranceDeduction ?? 0m,
                TaxDeduction = ps.TaxDeduction ?? 0m,
                NetPay = ps.NetPay ?? 0m,
                ps.Status,
                ps.ContractType,
                ps.ContractId
            }
        ).ToListAsync(ct);

        var payslips = payslipRows.Select(p =>
        {
            var hasContract = p.ContractId.HasValue || activeContractStaffIds.Contains(p.StaffId);
            return new PayslipSummaryItemDto(
                p.PayslipId,
                p.StaffId,
                p.StaffCode,
                p.StaffName,
                p.DepartmentName,
                p.WorkDays,
                p.OnCallDays,
                p.BasePay,
                p.AllowanceTotal,
                p.CommissionTotal,
                p.GrossPay,
                p.InsuranceDeduction,
                p.TaxDeduction,
                p.NetPay,
                p.Status,
                p.ContractType,
                hasContract,
                attendanceLocked,
                proceduresVerified
            );
        }).ToList();

        var employeeCount = payslips.Count;
        var totalGrossPay = payslips.Sum(x => x.GrossPay);
        var totalNetPay = payslips.Sum(x => x.NetPay);

        return new PayrollPeriodDetailDto(
            pl.LockId,
            pl.PayMonth,
            normStatus,
            employeeCount,
            totalGrossPay,
            totalNetPay,
            attendanceLocked,
            proceduresVerified,
            isLate,
            reopenReason,
            pl.LockedAt,
            pl.CreatedAt,
            openDate,
            standardLockDate,
            correctionDeadline,
            payslips
        );
    }

    public void AddPeriod(PayrollLock period)
        => db.PayrollLocks.Add(period);
}
