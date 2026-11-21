using System.Globalization;
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
    private static readonly string[] VerifiedProcedureStatuses = ["verified", "approved", "completed"];
    private static readonly string[] ClosedProcedureStatuses = ["verified", "approved", "completed", "rejected", "cancelled"];

    private static string NormalizeStatus(string? rawStatus)
    {
        if (string.IsNullOrWhiteSpace(rawStatus)) return "draft";
        var s = rawStatus.Trim().ToLowerInvariant();
        return s == "open" ? "draft" : s;
    }

    private static bool IsVerifiedSlipStatus(string? status)
        => !string.IsNullOrWhiteSpace(status) && VerifiedProcedureStatuses.Contains(status.Trim().ToLowerInvariant());

    private static bool IsClosedSlipStatus(string? status)
        => !string.IsNullOrWhiteSpace(status) && ClosedProcedureStatuses.Contains(status.Trim().ToLowerInvariant());

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
            .Where(p => p.Status == null || !ClosedProcedureStatuses.Contains(p.Status.ToLower()))
            .Select(p => new { p.ProcedureDate.Year, p.ProcedureDate.Month })
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

            var attendanceLocked = lockedTimesheetMonths.Contains(pl.PayMonth);
            var proceduresVerified = !unverifiedProcedureMonths.Contains(pl.PayMonth);

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

    public async Task<bool> HasPayslipComplaintsAsync(string payMonth, CancellationToken ct)
        => await (
            from c in db.Complaints.AsNoTracking()
            join p in db.Payslips.AsNoTracking() on c.PayslipId equals p.PayslipId
            where p.PayMonth == payMonth
            select c.ComplaintId
        ).AnyAsync(ct);

    public async Task DeleteDraftPeriodCascadeAsync(PayrollLock period, CancellationToken ct)
    {
        var payslips = await db.Payslips
            .Where(x => x.PayMonth == period.PayMonth)
            .ToListAsync(ct);

        if (payslips.Count > 0)
        {
            var payslipIds = payslips.Select(x => x.PayslipId).ToList();

            // Gỡ liên kết phiếu thủ thuật (FK Restrict) trước khi xóa phiếu lương nháp
            var linkedAssignments = await db.ProcedureAssignments
                .Where(x => x.PayslipId.HasValue && payslipIds.Contains(x.PayslipId.Value))
                .ToListAsync(ct);
            foreach (var assignment in linkedAssignments)
            {
                assignment.PayslipId = null;
            }

            var allowances = await db.PayslipAllowances
                .Where(x => payslipIds.Contains(x.PayslipId))
                .ToListAsync(ct);
            if (allowances.Count > 0)
            {
                db.PayslipAllowances.RemoveRange(allowances);
            }

            var deductions = await db.PayslipDeductions
                .Where(x => payslipIds.Contains(x.PayslipId))
                .ToListAsync(ct);
            if (deductions.Count > 0)
            {
                db.PayslipDeductions.RemoveRange(deductions);
            }

            db.Payslips.RemoveRange(payslips);
        }

        db.PayrollLocks.Remove(period);
    }

    public Task<List<Payslip>> GetPayslipsByMonthAsync(string payMonth, CancellationToken ct)
        => db.Payslips.Where(x => x.PayMonth == payMonth).ToListAsync(ct);

    public Task<List<PayslipAllowance>> GetPayslipAllowancesAsync(Guid payslipId, CancellationToken ct)
        => db.PayslipAllowances.AsNoTracking().Where(x => x.PayslipId == payslipId).OrderBy(x => x.Name).ToListAsync(ct);

    public Task<Payslip?> FindPayslipAsync(string payMonth, Guid payslipId, CancellationToken ct)
        => db.Payslips.SingleOrDefaultAsync(x => x.PayMonth == payMonth && x.PayslipId == payslipId, ct);

    public async Task<(bool AttendanceLocked, bool ProceduresVerified)> GetPeriodReadinessAsync(string payMonth, CancellationToken ct)
    {
        var (y, m) = PayrollPeriodRules.ParsePayMonth(payMonth);
        var monthStart = new DateOnly(y, m, 1);
        var monthEnd = monthStart.AddMonths(1).AddDays(-1);

        var attendanceLocked = await db.MonthlyTimesheets.AsNoTracking()
            .AnyAsync(x => x.PayMonth == payMonth && (x.Status == "locked" || x.Status == "confirmed"), ct);

        var hasUnverifiedProcedures = await db.ProcedureSlips.AsNoTracking()
            .AnyAsync(p => p.ProcedureDate >= monthStart && p.ProcedureDate <= monthEnd
                && (p.Status == null || !ClosedProcedureStatuses.Contains(p.Status.ToLower())), ct);

        return (attendanceLocked, !hasUnverifiedProcedures);
    }

    public async Task<PayrollPeriodDetailDto?> GetPeriodDetailAsync(string payMonth, CancellationToken ct)
    {
        var pl = await db.PayrollLocks.AsNoTracking().SingleOrDefaultAsync(x => x.PayMonth == payMonth, ct);
        if (pl is null) return null;

        var (y, m) = PayrollPeriodRules.ParsePayMonth(payMonth);
        var monthStart = new DateOnly(y, m, 1);
        var monthEnd = monthStart.AddMonths(1).AddDays(-1);
        var openDate = PayrollPeriodRules.GetConsolidationOpenDate(y, m);
        var standardLockDate = PayrollPeriodRules.GetStandardLockDate(y, m);
        var correctionDeadline = PayrollPeriodRules.GetCorrectionDeadline(y, m);

        var (attendanceLocked, proceduresVerified) = await GetPeriodReadinessAsync(payMonth, ct);

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
        var normStatus = NormalizeStatus(pl.Status);
        var isLate = reopenAudit is not null || (today > standardLockDate && normStatus != "locked" && normStatus != "finalized" && normStatus != "approved");

        var activeContractStaffIds = (await db.Contracts.AsNoTracking()
            .Where(c => c.Status == "active")
            .Select(c => c.StaffId)
            .ToListAsync(ct))
            .ToHashSet();

        var staffWithUnconfirmedAtt = (await db.AttendanceRecords.AsNoTracking()
            .Where(r => r.WorkDate >= monthStart && r.WorkDate <= monthEnd && r.ValidationStatus != "confirmed")
            .Select(r => r.StaffId)
            .Distinct()
            .ToListAsync(ct))
            .Concat(await db.OnCallShifts.AsNoTracking()
                .Where(o => o.ShiftDate >= monthStart && o.ShiftDate <= monthEnd && o.Status != "confirmed")
                .Select(o => o.StaffId)
                .Distinct()
                .ToListAsync(ct))
            .ToHashSet();

        var staffWithUnverifiedProc = (await (
            from pa in db.ProcedureAssignments.AsNoTracking()
            join psSlip in db.ProcedureSlips.AsNoTracking() on pa.SlipId equals psSlip.SlipId
            where psSlip.ProcedureDate >= monthStart && psSlip.ProcedureDate <= monthEnd
                && (psSlip.Status == null || !ClosedProcedureStatuses.Contains(psSlip.Status.ToLower()))
            select pa.StaffId
        ).Distinct().ToListAsync(ct)).ToHashSet();

        var payslipRows = await (
            from ps in db.Payslips.AsNoTracking()
            where ps.PayMonth == payMonth
            join s in db.Staff.AsNoTracking() on ps.StaffId equals s.StaffId into staffJoin
            from s in staffJoin.DefaultIfEmpty()
            join d in db.Departments.AsNoTracking() on ps.DepartmentId equals d.DepartmentId into deptJoin
            from d in deptJoin.DefaultIfEmpty()
            orderby s != null ? s.StaffCode : "", ps.StaffName
            select new
            {
                ps.PayslipId,
                ps.StaffId,
                StaffCode = s != null ? s.StaffCode : null,
                StaffName = ps.StaffName ?? (s != null ? s.FullName : null),
                PositionId = s != null ? s.PositionId : (Guid?)null,
                DepartmentName = d != null ? d.Name : null,
                WorkDays = ps.WorkDays ?? 0m,
                OnCallDays = ps.OnCallDays ?? 0m,
                BasePay = ps.BasePay ?? 0m,
                AllowanceTotal = ps.AllowanceTotal ?? 0m,
                CommissionTotal = ps.CommissionTotal ?? 0m,
                GrossPay = ps.GrossPay ?? 0m,
                InsuranceDeduction = ps.InsuranceDeduction ?? 0m,
                TaxDeduction = ps.TaxDeduction ?? 0m,
                OtherDeduction = ps.OtherDeduction ?? 0m,
                NetPay = ps.NetPay ?? 0m,
                ps.Status,
                ps.ContractType,
                ps.ContractId,
                ps.DeptApprovedAt,
                ps.DeptRejectedReason
            }
        ).ToListAsync(ct);

        var payslipIds = payslipRows.Select(x => x.PayslipId).ToList();
        var allowancesByPayslip = (await db.PayslipAllowances.AsNoTracking()
            .Where(a => payslipIds.Contains(a.PayslipId))
            .ToListAsync(ct))
            .ToLookup(a => a.PayslipId);

        var confirmedDutyEntries = (await db.AttendanceRecords.AsNoTracking()
            .Where(r => r.WorkDate >= monthStart && r.WorkDate <= monthEnd
                && r.ValidationStatus == "confirmed"
                && (r.ShiftType == "noon" || r.ShiftType == "evening"))
            .Select(r => new { r.StaffId, DutyType = r.ShiftType ?? string.Empty, Date = r.WorkDate })
            .ToListAsync(ct))
            .Concat(await db.OnCallShifts.AsNoTracking()
                .Where(o => o.ShiftDate >= monthStart && o.ShiftDate <= monthEnd
                    && o.Status == "confirmed"
                    && (o.ShiftCategory == "noon" || o.ShiftCategory == "evening"))
                .Select(o => new { o.StaffId, DutyType = o.ShiftCategory ?? string.Empty, Date = o.ShiftDate })
                .ToListAsync(ct));

        var dutyCountsByStaff = confirmedDutyEntries
            .GroupBy(x => x.StaffId)
            .ToDictionary(
                g => g.Key,
                g => (
                    NoonCount: (decimal)g.Where(x => x.DutyType == "noon").Select(x => x.Date).Distinct().Count(),
                    EveningCount: (decimal)g.Where(x => x.DutyType == "evening").Select(x => x.Date).Distinct().Count()
                ));

        var positionsById = await db.Positions.AsNoTracking()
            .ToDictionaryAsync(p => p.PositionId, ct);

        var activeRateConfigs = await db.PayrollRateConfigs.AsNoTracking()
            .Where(r => r.Status == "active" && r.EffectiveFrom <= monthEnd && (r.EffectiveTo == null || r.EffectiveTo >= monthStart))
            .ToListAsync(ct);

        var payslips = payslipRows.Select(p =>
        {
            var hasContract = p.ContractId.HasValue || activeContractStaffIds.Contains(p.StaffId);
            var attConfirmed = attendanceLocked && !staffWithUnconfirmedAtt.Contains(p.StaffId);
            var procConfirmed = !staffWithUnverifiedProc.Contains(p.StaffId);
            var split = PayrollPeriodRules.SplitPayslipAllowances(allowancesByPayslip[p.PayslipId], p.AllowanceTotal);
            var (reviewStatus, reviewNote) = PayrollPeriodRules.ParseReviewState(p.Status, p.DeptApprovedAt, p.DeptRejectedReason);
            dutyCountsByStaff.TryGetValue(p.StaffId, out var dutyCounts);

            var position = p.PositionId.HasValue ? positionsById.GetValueOrDefault(p.PositionId.Value) : null;
            bool isDoctorPos = PayrollPeriodRules.IsDoctorPosition(position);
            decimal noonDutyRate = PayrollPeriodRules.ResolveRate(
                activeRateConfigs, "duty_noon", p.StaffId, p.PositionId, positionsById, isDoctorPos, 50_000m);
            decimal eveningDutyRate = PayrollPeriodRules.ResolveRate(
                activeRateConfigs, "duty_night", p.StaffId, p.PositionId, positionsById, isDoctorPos,
                isDoctorPos ? 200_000m : 100_000m);

            decimal resolvedNoonCount;
            decimal resolvedEveningCount;
            if (p.OnCallDays <= 0m)
            {
                resolvedNoonCount = 0m;
                resolvedEveningCount = 0m;
            }
            else if (split.NoonDutyCount > 0m || split.EveningDutyCount > 0m)
            {
                resolvedNoonCount = split.NoonDutyCount;
                resolvedEveningCount = split.EveningDutyCount;
            }
            else
            {
                resolvedNoonCount = dutyCounts.NoonCount;
                resolvedEveningCount = dutyCounts.EveningCount;
            }

            return new PayslipSummaryItemDto(
                p.PayslipId,
                p.StaffId,
                p.StaffCode,
                p.StaffName,
                p.DepartmentName,
                p.WorkDays,
                p.OnCallDays,
                p.BasePay,
                split.PureAllowanceTotal,
                p.CommissionTotal,
                p.GrossPay,
                p.InsuranceDeduction,
                p.TaxDeduction,
                p.NetPay,
                p.Status,
                p.ContractType,
                hasContract,
                attConfirmed,
                procConfirmed,
                split.OnCallPay,
                split.OvertimePay,
                p.OtherDeduction,
                reviewStatus,
                reviewNote,
                p.DeptApprovedAt,
                resolvedNoonCount,
                resolvedEveningCount,
                noonDutyRate,
                eveningDutyRate
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

    public async Task<PayrollCalculationContext> LoadCalculationContextAsync(string payMonth, CancellationToken ct)
    {
        var (y, m) = PayrollPeriodRules.ParsePayMonth(payMonth);
        var monthStart = new DateOnly(y, m, 1);
        var monthEnd = monthStart.AddMonths(1).AddDays(-1);

        var (attendanceLocked, proceduresVerified) = await GetPeriodReadinessAsync(payMonth, ct);

        var cs1Site = await db.Sites.AsNoTracking().FirstOrDefaultAsync(s => s.SiteCode == "CS1", ct);
        var activeCs1Staff = await db.Staff.AsNoTracking()
            .Where(s => s.Status == "active"
                && s.DateJoined <= monthEnd
                && (s.DateLeft == null || s.DateLeft >= monthStart)
                && (cs1Site == null || s.SiteId == cs1Site.SiteId || s.SiteId == null))
            .OrderBy(s => s.StaffCode)
            .ToListAsync(ct);

        var staffIds = activeCs1Staff.Select(s => s.StaffId).ToHashSet();

        var activeContracts = await db.Contracts.AsNoTracking()
            .Where(c => c.Status == "active" && staffIds.Contains(c.StaffId))
            .OrderByDescending(c => c.EffectiveFrom)
            .ThenByDescending(c => c.CreatedAt)
            .ToListAsync(ct);

        var contractsByStaff = activeContracts
            .GroupBy(c => c.StaffId)
            .ToDictionary(
                g => g.Key,
                g => g.FirstOrDefault(c => c.EffectiveFrom <= monthEnd && (c.EffectiveTo == null || c.EffectiveTo >= monthStart))
                    ?? g.First());

        var positionsById = await db.Positions.AsNoTracking()
            .ToDictionaryAsync(p => p.PositionId, ct);

        var departmentsById = await db.Departments.AsNoTracking()
            .ToDictionaryAsync(d => d.DepartmentId, ct);

        var allowanceRows = await (
            from sa in db.StaffAllowances.AsNoTracking()
            join at in db.AllowanceTypes.AsNoTracking() on sa.AllowanceId equals at.AllowanceId
            where staffIds.Contains(sa.StaffId)
                && sa.Status == "active"
                && (at.Status == null || at.Status == "active")
                && sa.EffectiveFrom <= monthEnd
                && (sa.EffectiveTo == null || sa.EffectiveTo >= monthStart)
            select new { sa, at }
        ).ToListAsync(ct);

        var allowancesByStaff = allowanceRows.ToLookup(x => x.sa.StaffId, x => (x.sa, x.at));

        var monthAttendance = await db.AttendanceRecords.AsNoTracking()
            .Where(r => staffIds.Contains(r.StaffId) && r.WorkDate >= monthStart && r.WorkDate <= monthEnd)
            .ToListAsync(ct);

        var monthOnCall = await db.OnCallShifts.AsNoTracking()
            .Where(o => staffIds.Contains(o.StaffId) && o.ShiftDate >= monthStart && o.ShiftDate <= monthEnd)
            .ToListAsync(ct);

        var approvedLeaves = await db.LeaveRequests.AsNoTracking()
            .Where(l => staffIds.Contains(l.StaffId) && l.Status == "approved" && l.StartDate <= monthEnd && l.EndDate >= monthStart)
            .ToListAsync(ct);

        var leaveTypesIsPaid = await db.LeaveTypes.AsNoTracking()
            .ToDictionaryAsync(x => x.Code, x => x.IsPaid, ct);

        var procedureRows = await (
            from pa in db.ProcedureAssignments.AsNoTracking()
            join ps in db.ProcedureSlips.AsNoTracking() on pa.SlipId equals ps.SlipId
            where staffIds.Contains(pa.StaffId)
                && ps.ProcedureDate >= monthStart && ps.ProcedureDate <= monthEnd
            select new { pa.StaffId, pa.CommissionAmount, pa.Status, SlipStatus = ps.Status }
        ).ToListAsync(ct);

        var commissionsByStaff = procedureRows
            .Where(x => IsClosedSlipStatus(x.SlipStatus)
                ? IsVerifiedSlipStatus(x.SlipStatus)
                : true)
            .Where(x => !string.Equals(x.SlipStatus, "rejected", StringComparison.OrdinalIgnoreCase)
                && !string.Equals(x.SlipStatus, "cancelled", StringComparison.OrdinalIgnoreCase)
                && !string.Equals(x.Status, "rejected", StringComparison.OrdinalIgnoreCase))
            .ToLookup(
                x => x.StaffId,
                x => (x.CommissionAmount ?? 0m, IsVerifiedSlipStatus(x.SlipStatus)));

        var taxPolicy = await LoadTaxAndInsuranceParametersAsync(monthStart, monthEnd, ct);

        var rateConfigs = await db.PayrollRateConfigs.AsNoTracking()
            .Where(r => r.Status == "active" && r.EffectiveFrom <= monthEnd && (r.EffectiveTo == null || r.EffectiveTo >= monthStart))
            .ToListAsync(ct);

        var existingPayslips = await db.Payslips
            .Where(p => p.PayMonth == payMonth && staffIds.Contains(p.StaffId))
            .ToDictionaryAsync(p => p.StaffId, ct);

        return new PayrollCalculationContext(
            AttendanceLocked: attendanceLocked,
            ProceduresVerified: proceduresVerified,
            ActiveCs1Staff: activeCs1Staff,
            ActiveContractsByStaff: contractsByStaff,
            PositionsById: positionsById,
            DepartmentsById: departmentsById,
            AllowancesByStaff: allowancesByStaff,
            MonthAttendanceRecords: monthAttendance,
            MonthOnCallShifts: monthOnCall,
            ApprovedLeavesInMonth: approvedLeaves,
            LeaveTypesIsPaid: leaveTypesIsPaid,
            ProcedureCommissionsByStaff: commissionsByStaff,
            EmployeeInsuranceConfigs: taxPolicy.InsuranceConfigs,
            EmployeeInsuranceRatePercent: taxPolicy.EmployeeInsuranceRatePercent,
            ActiveRateConfigs: rateConfigs,
            ActiveTaxBrackets: taxPolicy.Brackets,
            PersonalDeduction: taxPolicy.PersonalDeduction,
            DependentDeduction: taxPolicy.DependentDeduction,
            FlatThreshold: taxPolicy.FlatThreshold,
            FlatRatePercent: taxPolicy.FlatRatePercent,
            RoundingUnit: taxPolicy.RoundingUnit,
            DeductInsuranceBeforeTax: taxPolicy.DeductInsuranceBeforeTax,
            DeductUnionFeeBeforeTax: taxPolicy.DeductUnionFeeBeforeTax,
            DeductOtherBeforeTax: taxPolicy.DeductOtherBeforeTax,
            FlatTaxBase: taxPolicy.FlatTaxBase,
            ExistingPayslipsByStaff: existingPayslips
        );
    }

    public async Task ReplacePayslipLinesAsync(
        Guid payslipId,
        IEnumerable<PayslipAllowance> allowances,
        IEnumerable<PayslipDeduction> deductions,
        CancellationToken ct)
    {
        var oldAllowances = await db.PayslipAllowances.Where(x => x.PayslipId == payslipId).ToListAsync(ct);
        if (oldAllowances.Count > 0)
        {
            db.PayslipAllowances.RemoveRange(oldAllowances);
        }

        var oldDeductions = await db.PayslipDeductions.Where(x => x.PayslipId == payslipId).ToListAsync(ct);
        if (oldDeductions.Count > 0)
        {
            db.PayslipDeductions.RemoveRange(oldDeductions);
        }

        db.PayslipAllowances.AddRange(allowances);
        db.PayslipDeductions.AddRange(deductions);
    }

    public void AddPayslip(Payslip payslip) => db.Payslips.Add(payslip);

    public async Task<PayslipDetailDto?> GetPayslipDetailAsync(string payMonth, Guid payslipId, CancellationToken ct)
    {
        var ps = await db.Payslips.AsNoTracking()
            .SingleOrDefaultAsync(x => x.PayslipId == payslipId && x.PayMonth == payMonth, ct);
        if (ps is null) return null;

        var (y, m) = PayrollPeriodRules.ParsePayMonth(payMonth);
        var monthStart = new DateOnly(y, m, 1);
        var monthEnd = monthStart.AddMonths(1).AddDays(-1);

        var staff = await db.Staff.AsNoTracking().SingleOrDefaultAsync(s => s.StaffId == ps.StaffId, ct);
        var dept = ps.DepartmentId.HasValue
            ? await db.Departments.AsNoTracking().SingleOrDefaultAsync(d => d.DepartmentId == ps.DepartmentId.Value, ct)
            : (staff?.DepartmentId is Guid sDeptId
                ? await db.Departments.AsNoTracking().SingleOrDefaultAsync(d => d.DepartmentId == sDeptId, ct)
                : null);
        var position = staff?.PositionId is Guid posId
            ? await db.Positions.AsNoTracking().SingleOrDefaultAsync(p => p.PositionId == posId, ct)
            : null;
        var contract = ps.ContractId.HasValue
            ? await db.Contracts.AsNoTracking().SingleOrDefaultAsync(c => c.ContractId == ps.ContractId.Value, ct)
            : await db.Contracts.AsNoTracking()
                .Where(c => c.StaffId == ps.StaffId && c.Status == "active")
                .OrderByDescending(c => c.EffectiveFrom)
                .FirstOrDefaultAsync(ct);

        var periodLock = await db.PayrollLocks.AsNoTracking().SingleOrDefaultAsync(x => x.PayMonth == payMonth, ct);
        var attendanceLocked = await db.MonthlyTimesheets.AsNoTracking()
            .AnyAsync(x => x.PayMonth == payMonth && (x.Status == "locked" || x.Status == "confirmed"), ct);

        var records = await db.AttendanceRecords.AsNoTracking()
            .Where(r => r.StaffId == ps.StaffId && r.WorkDate >= monthStart && r.WorkDate <= monthEnd)
            .ToListAsync(ct);
        var onCalls = await db.OnCallShifts.AsNoTracking()
            .Where(o => o.StaffId == ps.StaffId && o.ShiftDate >= monthStart && o.ShiftDate <= monthEnd)
            .ToListAsync(ct);
        var leaves = await db.LeaveRequests.AsNoTracking()
            .Where(l => l.StaffId == ps.StaffId && l.Status == "approved" && l.StartDate <= monthEnd && l.EndDate >= monthStart)
            .ToListAsync(ct);
        var leaveTypesIsPaid = await db.LeaveTypes.AsNoTracking()
            .ToDictionaryAsync(x => x.Code, x => x.IsPaid, ct);

        var attMetrics = PayrollPeriodRules.ComputeStaffAttendanceMetrics(
            monthStart, monthEnd, records, onCalls, leaves, leaveTypesIsPaid);

        var hasUnverifiedProc = await (
            from pa in db.ProcedureAssignments.AsNoTracking()
            join slip in db.ProcedureSlips.AsNoTracking() on pa.SlipId equals slip.SlipId
            where pa.StaffId == ps.StaffId
                && slip.ProcedureDate >= monthStart && slip.ProcedureDate <= monthEnd
                && (slip.Status == null || !ClosedProcedureStatuses.Contains(slip.Status.ToLower()))
            select pa.AssignmentId
        ).AnyAsync(ct);

        var rawAllowances = await db.PayslipAllowances.AsNoTracking()
            .Where(a => a.PayslipId == payslipId)
            .OrderBy(a => a.Name)
            .ToListAsync(ct);
        var split = PayrollPeriodRules.SplitPayslipAllowances(rawAllowances, ps.AllowanceTotal ?? 0m);

        var rawDeductions = await db.PayslipDeductions.AsNoTracking()
            .Where(d => d.PayslipId == payslipId)
            .OrderBy(d => d.DeductionType)
            .ThenBy(d => d.DeductionName)
            .ToListAsync(ct);

        var deductions = rawDeductions.Select(d => new PayslipDeductionItemDto(
            d.PayslipDeductionId,
            d.DeductionType,
            d.DeductionName,
            d.CalculationBase,
            d.RatePercent,
            d.Amount
        )).ToList();

        decimal unionFeeDeduction = rawDeductions
            .Where(d => d.DeductionType == "union_fee")
            .Sum(d => d.Amount);
        if (unionFeeDeduction == 0m && (ps.OtherDeduction ?? 0m) > 0m)
        {
            unionFeeDeduction = ps.OtherDeduction ?? 0m;
        }

        if (deductions.Count == 0)
        {
            if ((ps.InsuranceDeduction ?? 0m) > 0m)
            {
                deductions.Add(new PayslipDeductionItemDto(
                    Guid.Empty, "insurance", "Bảo hiểm bắt buộc (BHXH 8% + BHYT 1.5% + BHTN 1%)",
                    ps.InsuranceSalaryBase ?? 0m, PayrollDefaults.EmployeeInsuranceRatePercent, ps.InsuranceDeduction ?? 0m));
            }
            if (unionFeeDeduction > 0m)
            {
                deductions.Add(new PayslipDeductionItemDto(
                    Guid.Empty, "union_fee", "Trừ quỹ Công đoàn", 1m, null, unionFeeDeduction));
            }
            if ((ps.TaxDeduction ?? 0m) > 0m)
            {
                deductions.Add(new PayslipDeductionItemDto(
                    Guid.Empty, "tax", "Thuế thu nhập cá nhân (TNCN)",
                    ps.TaxableIncome ?? 0m, null, ps.TaxDeduction ?? 0m));
            }
        }

        var taxPolicy = await LoadTaxAndInsuranceParametersAsync(monthStart, monthEnd, ct);
        decimal grossPay = ps.GrossPay ?? 0m;
        decimal insBase = ps.InsuranceSalaryBase ?? 0m;
        bool hasInsurance = (ps.InsuranceDeduction ?? 0m) > 0m && insBase > 0m;

        var formulaResult = PayrollFormula.Calculate(new PayrollFormulaInput(
            TotalIncome: grossPay,
            InsuranceSalary: hasInsurance ? insBase : 0m,
            IsUnionMember: unionFeeDeduction > 0m,
            DependentCount: ps.DependentCount ?? staff?.DependentCount ?? 0,
            TaxMethod: contract?.TaxMethod ?? "progressive",
            OtherDeductions: 0m,
            InsuranceEmployeeRatePercent: taxPolicy.EmployeeInsuranceRatePercent,
            UnionFeeFixed: unionFeeDeduction > 0m ? unionFeeDeduction : 0m,
            PersonalDeduction: (ps.PersonalDeduction ?? 0m) > 0m ? ps.PersonalDeduction!.Value : taxPolicy.PersonalDeduction,
            DependentDeduction: taxPolicy.DependentDeduction,
            FlatThreshold: taxPolicy.FlatThreshold,
            FlatRatePercent: taxPolicy.FlatRatePercent,
            RoundingUnit: taxPolicy.RoundingUnit,
            DeductInsuranceBeforeTax: taxPolicy.DeductInsuranceBeforeTax,
            DeductUnionFeeBeforeTax: taxPolicy.DeductUnionFeeBeforeTax,
            DeductOtherBeforeTax: taxPolicy.DeductOtherBeforeTax,
            FlatTaxBase: taxPolicy.FlatTaxBase,
            Brackets: taxPolicy.Brackets
        ));

        decimal stdDays = contract?.StandardWorkingDays is > 0m ? contract.StandardWorkingDays.Value : PayrollDefaults.StandardWorkingDays;
        string salaryType = contract?.SalaryType ?? "monthly";
        decimal dailyRate = contract is null
            ? 0m
            : (string.Equals(salaryType, "daily", StringComparison.OrdinalIgnoreCase)
                ? contract.DailyRate
                : (stdDays > 0m ? (contract.MonthlySalary ?? (contract.DailyRate * stdDays)) / stdDays : 0m));

        var (reviewStatus, reviewNote) = PayrollPeriodRules.ParseReviewState(ps.Status, ps.DeptApprovedAt, ps.DeptRejectedReason);
        bool isLocked = (ps.IsLocked ?? false)
            || (periodLock?.Status is "locked" or "finalized");

        return new PayslipDetailDto(
            PayslipId: ps.PayslipId,
            StaffId: ps.StaffId,
            StaffCode: staff?.StaffCode,
            StaffName: ps.StaffName ?? staff?.FullName,
            DepartmentName: dept?.Name,
            PositionName: position?.Name,
            PayMonth: ps.PayMonth,
            Status: ps.Status,
            IsLocked: isLocked,
            ContractCode: contract?.ContractCode,
            ContractType: ps.ContractType ?? contract?.ContractType,
            SalaryType: salaryType,
            DailyRate: Math.Round(dailyRate, 2, MidpointRounding.AwayFromZero),
            MonthlySalary: contract?.MonthlySalary,
            StandardWorkingDays: stdDays,
            TaxMethod: contract?.TaxMethod ?? "progressive",
            IsInsuranceEligible: contract?.IsInsuranceEligible ?? false,
            InsuranceSalaryBase: insBase,
            IsUnionMember: staff?.IsUnionMember ?? (unionFeeDeduction > 0m),
            DependentCount: ps.DependentCount ?? staff?.DependentCount ?? 0,
            WorkDays: ps.WorkDays ?? attMetrics.TotalWorkDays,
            PaidLeaveDays: attMetrics.PaidLeaveDays,
            UnpaidLeaveDays: attMetrics.UnpaidLeaveDays,
            NoonDutyCount: (ps.OnCallDays ?? attMetrics.OnCallDays) <= 0m
                ? 0m
                : (split.NoonDutyCount > 0m || split.EveningDutyCount > 0m ? split.NoonDutyCount : attMetrics.NoonDutyCount),
            EveningDutyCount: (ps.OnCallDays ?? attMetrics.OnCallDays) <= 0m
                ? 0m
                : (split.NoonDutyCount > 0m || split.EveningDutyCount > 0m ? split.EveningDutyCount : attMetrics.EveningDutyCount),
            OvertimeHours: attMetrics.OvertimeHours,
            OnCallDays: ps.OnCallDays ?? attMetrics.OnCallDays,
            BasePay: ps.BasePay ?? 0m,
            NoonDutyPay: split.NoonDutyPay,
            EveningDutyPay: split.EveningDutyPay,
            OvertimePay: split.OvertimePay,
            OnCallPay: split.OnCallPay,
            AllowanceTotal: split.PureAllowanceTotal,
            CommissionTotal: ps.CommissionTotal ?? 0m,
            GrossPay: grossPay,
            InsuranceDeduction: ps.InsuranceDeduction ?? 0m,
            UnionFeeDeduction: unionFeeDeduction,
            OtherDeduction: ps.OtherDeduction ?? 0m,
            PersonalDeduction: ps.PersonalDeduction ?? formulaResult.Step4_PersonalDeductionAmount,
            DependentDeduction: ps.DependentDeduction ?? formulaResult.Step4_DependentDeductionAmount,
            TaxableIncome: ps.TaxableIncome ?? formulaResult.Step4_TaxableIncome,
            TaxDeduction: ps.TaxDeduction ?? 0m,
            NetPay: ps.NetPay ?? 0m,
            HasContract: contract is not null || ps.ContractId.HasValue,
            AttendanceConfirmed: attendanceLocked && !attMetrics.HasUnconfirmedAttendance,
            ProcedureConfirmed: !hasUnverifiedProc,
            ReviewStatus: reviewStatus,
            ReviewNote: reviewNote,
            ReviewedAt: ps.DeptApprovedAt,
            Allowances: split.PureAllowances,
            Deductions: deductions,
            TaxBrackets: formulaResult.Step5_BracketBreakdowns.ToList(),
            TaxCalculationNote: formulaResult.Step4_Note ?? formulaResult.Step5_Note
        );
    }

    public void AddPeriod(PayrollLock period)
        => db.PayrollLocks.Add(period);

    private async Task<(
        List<(string InsuranceType, decimal RatePercent)> InsuranceConfigs,
        decimal EmployeeInsuranceRatePercent,
        List<TaxBracketItem> Brackets,
        decimal PersonalDeduction,
        decimal DependentDeduction,
        decimal FlatThreshold,
        decimal FlatRatePercent,
        decimal RoundingUnit,
        bool DeductInsuranceBeforeTax,
        bool DeductUnionFeeBeforeTax,
        bool DeductOtherBeforeTax,
        string FlatTaxBase
    )> LoadTaxAndInsuranceParametersAsync(DateOnly monthStart, DateOnly monthEnd, CancellationToken ct)
    {
        var insConfigs = await db.PayrollInsuranceConfigs.AsNoTracking()
            .Where(i => i.Status == "active"
                && i.Payer == "employee"
                && i.EffectiveFrom <= monthEnd
                && (i.EffectiveTo == null || i.EffectiveTo >= monthStart))
            .Select(i => new { i.InsuranceType, i.RatePercent })
            .ToListAsync(ct);

        var insList = insConfigs
            .GroupBy(x => x.InsuranceType.ToLowerInvariant())
            .Select(g => (g.Key, g.First().RatePercent))
            .ToList();

        decimal empInsRate = insList.Count > 0
            ? insList.Sum(x => x.Item2)
            : PayrollDefaults.EmployeeInsuranceRatePercent;

        var bracketRows = await db.PayrollTaxBrackets.AsNoTracking()
            .Where(b => b.Status == "active"
                && b.EffectiveFrom <= monthEnd
                && (b.EffectiveTo == null || b.EffectiveTo >= monthStart))
            .OrderBy(b => b.IncomeFrom)
            .ToListAsync(ct);

        var brackets = bracketRows.Count > 0
            ? bracketRows.Select((b, idx) => new TaxBracketItem(idx + 1, b.IncomeFrom, b.IncomeTo, b.TaxRatePercent)).ToList()
            : PayrollDefaults.TaxBrackets.ToList();

        var policies = (await db.SystemPolicies.AsNoTracking()
            .Select(p => new { p.PolicyKey, p.PolicyValue })
            .ToListAsync(ct))
            .GroupBy(p => p.PolicyKey)
            .ToDictionary(g => g.Key, g => g.First().PolicyValue);

        static decimal GetDec(Dictionary<string, string> p, string k, decimal fallback)
            => p.TryGetValue(k, out var raw) && decimal.TryParse(raw, NumberStyles.Number, CultureInfo.InvariantCulture, out var val)
                ? val
                : fallback;

        static bool GetBool(Dictionary<string, string> p, string k, bool fallback)
            => p.TryGetValue(k, out var raw) && bool.TryParse(raw, out var val) ? val : fallback;

        var flatBase = policies.TryGetValue("pit_flat_base", out var fb) && !string.IsNullOrWhiteSpace(fb)
            ? fb
            : PayrollDefaults.FlatTaxBase;

        return (
            insList,
            empInsRate,
            brackets,
            GetDec(policies, "tax_personal_deduction", PayrollDefaults.PersonalDeduction),
            GetDec(policies, "tax_dependent_deduction", PayrollDefaults.DependentDeduction),
            GetDec(policies, "tax_flat_threshold", PayrollDefaults.FlatTaxThreshold),
            GetDec(policies, "tax_flat_rate", PayrollDefaults.FlatTaxRatePercent),
            GetDec(policies, "payroll_rounding_unit", PayrollDefaults.RoundingUnit),
            GetBool(policies, "pit_deduct_insurance_before_tax", PayrollDefaults.DeductInsuranceBeforeTax),
            GetBool(policies, "pit_deduct_union_fee_before_tax", PayrollDefaults.DeductUnionFeeBeforeTax),
            GetBool(policies, "pit_deduct_other_before_tax", PayrollDefaults.DeductOtherBeforeTax),
            flatBase
        );
    }
}
