using System.Data;
using System.Text.RegularExpressions;
using Vnc.HRMS.Common.Exceptions;
using Vnc.HRMS.Common.Utils;
using Vnc.HRMS.DTOs.Payroll;
using Vnc.HRMS.Models;
using Vnc.HRMS.Models.Employees;
using Vnc.HRMS.Models.Organization;
using Vnc.HRMS.Repositories.Interfaces;
using Vnc.HRMS.Services.Interfaces;
using Vnc.HRMS.Services.Rules;

namespace Vnc.HRMS.Services;

public sealed partial class PayrollPeriodService(
    IPayrollPeriodRepository repository,
    IUnitOfWork unitOfWork,
    IAuditLogHelper auditHelper) : IPayrollPeriodService
{
    private static readonly Regex MonthRegex = MonthRegexPattern();

    [GeneratedRegex(@"^\d{4}-(0[1-9]|1[0-2])$")]
    private static partial Regex MonthRegexPattern();

    private static void ValidateMonth(string? payMonth)
    {
        if (string.IsNullOrWhiteSpace(payMonth) || !MonthRegex.IsMatch(payMonth.Trim())
            || PayrollParameterRules.MonthStart(payMonth.Trim()) is null)
        {
            throw new AppException(400, "Định dạng tháng không hợp lệ (định dạng đúng: YYYY-MM).");
        }
    }

    private static bool IsLockedOrFinalizedStatus(string? status)
    {
        return PayrollPeriodRules.IsLockedStatus(status);
    }

    private static int ComputeServiceYears(DateOnly dateJoined, DateOnly asOfDate)
    {
        var years = asOfDate.Year - dateJoined.Year;
        if (dateJoined.AddYears(years) > asOfDate)
        {
            years--;
        }
        return Math.Max(0, years);
    }

    private static string MapInsuranceDisplayName(string insType) => insType.ToLowerInvariant() switch
    {
        "social" => "BHXH (NLĐ)",
        "health" => "BHYT (NLĐ)",
        "unemployment" => "BHTN (NLĐ)",
        "accident" => "BHTNLĐ (NLĐ)",
        _ => $"Bảo hiểm ({insType})"
    };

    private static List<PayslipDeduction> BuildDeductionLines(
        Guid payslipId,
        decimal insSalary,
        PayrollCalculationContext ctx,
        PayrollFormulaResult formulaResult,
        DateTime now)
    {
        var lines = new List<PayslipDeduction>();

        if (formulaResult.Step2_InsuranceDeduction > 0m)
        {
            if (ctx.EmployeeInsuranceConfigs.Count > 0)
            {
                foreach (var (insType, ratePct) in ctx.EmployeeInsuranceConfigs)
                {
                    lines.Add(new PayslipDeduction
                    {
                        PayslipDeductionId = Guid.NewGuid(),
                        PayslipId = payslipId,
                        DeductionType = "insurance",
                        DeductionName = MapInsuranceDisplayName(insType),
                        CalculationBase = insSalary,
                        RatePercent = ratePct,
                        Amount = Math.Round(insSalary * (ratePct / 100m), 2, MidpointRounding.AwayFromZero),
                        Payer = "employee",
                        CreatedAt = now
                    });
                }
            }
            else
            {
                lines.Add(new PayslipDeduction
                {
                    PayslipDeductionId = Guid.NewGuid(),
                    PayslipId = payslipId,
                    DeductionType = "insurance",
                    DeductionName = "Bảo hiểm bắt buộc (BHXH, BHYT, BHTN)",
                    CalculationBase = insSalary,
                    RatePercent = ctx.EmployeeInsuranceRatePercent,
                    Amount = Math.Round(formulaResult.Step2_InsuranceDeduction, 2, MidpointRounding.AwayFromZero),
                    Payer = "employee",
                    CreatedAt = now
                });
            }
        }

        if (formulaResult.Step2_UnionFeeDeduction > 0m)
        {
            lines.Add(new PayslipDeduction
            {
                PayslipDeductionId = Guid.NewGuid(),
                PayslipId = payslipId,
                DeductionType = "union_fee",
                DeductionName = "Trừ quỹ Công đoàn",
                CalculationBase = 1m,
                RatePercent = null,
                Amount = Math.Round(formulaResult.Step2_UnionFeeDeduction, 0, MidpointRounding.AwayFromZero),
                Payer = "employee",
                CreatedAt = now
            });
        }

        if (formulaResult.Step5_PitTax > 0m)
        {
            lines.Add(new PayslipDeduction
            {
                PayslipDeductionId = Guid.NewGuid(),
                PayslipId = payslipId,
                DeductionType = "tax",
                DeductionName = "Thuế thu nhập cá nhân (TNCN)",
                CalculationBase = formulaResult.Step4_TaxableIncome,
                RatePercent = null,
                Amount = Math.Round(formulaResult.Step5_PitTax, 0, MidpointRounding.AwayFromZero),
                Payer = "employee",
                CreatedAt = now
            });
        }

        return lines;
    }

    private const string InlineAdjustmentAllowanceName = "Phụ cấp & trực (Điều chỉnh kế toán)";

    private static List<PayslipAllowance> SyncAllowancesForInlineEdit(
        Guid payslipId,
        decimal targetTotal,
        IReadOnlyList<PayslipAllowance> existingAllowances,
        (decimal EveningCount, decimal NoonCount, decimal EveningRate, decimal NoonRate)? explicitDuty = null)
    {
        if (!explicitDuty.HasValue)
        {
            decimal existingTotal = Math.Round(existingAllowances.Sum(x => x.Amount), 2, MidpointRounding.AwayFromZero);
            if (targetTotal == existingTotal)
            {
                return existingAllowances.Select(x => new PayslipAllowance
                {
                    Id = Guid.NewGuid(),
                    PayslipId = payslipId,
                    AllowanceId = x.AllowanceId,
                    Name = x.Name,
                    Amount = x.Amount
                }).ToList();
            }
        }

        if (targetTotal <= 0m)
        {
            return [];
        }

        var allOldDutyLines = existingAllowances
            .Where(line => line.AllowanceId is null
                && (line.Name.StartsWith("Tiền trực tối", StringComparison.OrdinalIgnoreCase)
                    || line.Name.StartsWith("Tiền trực trưa", StringComparison.OrdinalIgnoreCase)
                    || line.Name.StartsWith("Tiền trực ngoài giờ", StringComparison.OrdinalIgnoreCase)
                    || line.Name.StartsWith("Tiền làm thêm giờ", StringComparison.OrdinalIgnoreCase)))
            .ToList();

        List<PayslipAllowance> dutyLines;
        if (explicitDuty.HasValue)
        {
            var duty = explicitDuty.Value;
            dutyLines = [];
            decimal eveningPay = Math.Round(duty.EveningCount * duty.EveningRate, 2, MidpointRounding.AwayFromZero);
            decimal noonPay = Math.Round(duty.NoonCount * duty.NoonRate, 2, MidpointRounding.AwayFromZero);

            if (duty.EveningCount > 0m && eveningPay > 0m)
            {
                dutyLines.Add(new PayslipAllowance
                {
                    Id = Guid.NewGuid(),
                    PayslipId = payslipId,
                    AllowanceId = null,
                    Name = $"Tiền trực tối ({duty.EveningCount.ToString("0.#", System.Globalization.CultureInfo.InvariantCulture)} ca)",
                    Amount = eveningPay
                });
            }
            if (duty.NoonCount > 0m && noonPay > 0m)
            {
                dutyLines.Add(new PayslipAllowance
                {
                    Id = Guid.NewGuid(),
                    PayslipId = payslipId,
                    AllowanceId = null,
                    Name = $"Tiền trực trưa ({duty.NoonCount.ToString("0.#", System.Globalization.CultureInfo.InvariantCulture)} ca)",
                    Amount = noonPay
                });
            }

            dutyLines.AddRange(allOldDutyLines
                .Where(line => line.Name.StartsWith("Tiền trực ngoài giờ", StringComparison.OrdinalIgnoreCase)
                    || line.Name.StartsWith("Tiền làm thêm giờ", StringComparison.OrdinalIgnoreCase))
                .Select(x => new PayslipAllowance
                {
                    Id = Guid.NewGuid(),
                    PayslipId = payslipId,
                    AllowanceId = x.AllowanceId,
                    Name = x.Name,
                    Amount = x.Amount
                }));
        }
        else
        {
            dutyLines = allOldDutyLines.Select(x => new PayslipAllowance
            {
                Id = Guid.NewGuid(),
                PayslipId = payslipId,
                AllowanceId = x.AllowanceId,
                Name = x.Name,
                Amount = x.Amount
            }).ToList();
        }

        var pureLines = existingAllowances
            .Where(line => !allOldDutyLines.Contains(line)
                && !string.Equals(line.Name, InlineAdjustmentAllowanceName, StringComparison.OrdinalIgnoreCase))
            .ToList();

        decimal dutySum = Math.Round(dutyLines.Sum(x => x.Amount), 2, MidpointRounding.AwayFromZero);
        if (targetTotal < dutySum)
        {
            return
            [
                new PayslipAllowance
                {
                    Id = Guid.NewGuid(),
                    PayslipId = payslipId,
                    AllowanceId = null,
                    Name = InlineAdjustmentAllowanceName,
                    Amount = targetTotal
                }
            ];
        }

        var result = dutyLines;

        decimal remaining = Math.Round(targetTotal - dutySum, 2, MidpointRounding.AwayFromZero);
        decimal pureSum = Math.Round(pureLines.Sum(x => x.Amount), 2, MidpointRounding.AwayFromZero);

        if (pureLines.Count > 0 && pureSum <= remaining)
        {
            result.AddRange(pureLines.Select(x => new PayslipAllowance
            {
                Id = Guid.NewGuid(),
                PayslipId = payslipId,
                AllowanceId = x.AllowanceId,
                Name = x.Name,
                Amount = x.Amount
            }));

            decimal diff = Math.Round(remaining - pureSum, 2, MidpointRounding.AwayFromZero);
            if (diff > 0m)
            {
                result.Add(new PayslipAllowance
                {
                    Id = Guid.NewGuid(),
                    PayslipId = payslipId,
                    AllowanceId = null,
                    Name = InlineAdjustmentAllowanceName,
                    Amount = diff
                });
            }
        }
        else if (remaining > 0m)
        {
            result.Add(new PayslipAllowance
            {
                Id = Guid.NewGuid(),
                PayslipId = payslipId,
                AllowanceId = null,
                Name = InlineAdjustmentAllowanceName,
                Amount = remaining
            });
        }

        return result;
    }

    public Task<List<PayrollPeriodDto>> ListPeriodsAsync(CancellationToken ct)
        => repository.ListPeriodsAsync(ct);

    public async Task<PayrollPeriodDetailDto> GetPeriodDetailAsync(string payMonth, CancellationToken ct)
    {
        ValidateMonth(payMonth);
        var detail = await repository.GetPeriodDetailAsync(payMonth.Trim(), ct);
        return detail ?? throw new AppException(404, $"Không tìm thấy kỳ tính lương tháng {payMonth}.");
    }

    public async Task<PayrollPeriodDto> CreatePeriodAsync(
        Guid userId, CreatePayrollPeriodRequest request, CancellationToken ct)
    {
        ValidateMonth(request.PayMonth);
        var normalizedMonth = request.PayMonth.Trim();

        var existing = await repository.FindByMonthAsync(normalizedMonth, ct);
        if (existing is not null)
        {
            throw new AppException(409, "Kỳ tính lương cho tháng này đã tồn tại.");
        }

        var entity = new PayrollLock
        {
            LockId = Guid.NewGuid(),
            PayMonth = normalizedMonth,
            Status = "open",
            CreatedAt = DateTime.UtcNow
        };

        repository.AddPeriod(entity);

        var snapshot = new
        {
            entity.LockId,
            entity.PayMonth,
            entity.Status,
            entity.CreatedAt
        };
        auditHelper.Log("create", "PayrollLock", entity.LockId, null, snapshot);

        await unitOfWork.SaveChangesAsync(ct);

        var (y, m) = PayrollPeriodRules.ParsePayMonth(normalizedMonth);
        var openDate = PayrollPeriodRules.GetConsolidationOpenDate(y, m);
        var standardLockDate = PayrollPeriodRules.GetStandardLockDate(y, m);
        var correctionDeadline = PayrollPeriodRules.GetCorrectionDeadline(y, m);

        return new PayrollPeriodDto(
            entity.LockId,
            entity.PayMonth,
            "draft",
            0,
            0m,
            0m,
            false,
            true,
            false,
            null,
            entity.CreatedAt,
            openDate,
            standardLockDate,
            correctionDeadline
        );
    }

    public async Task<PayrollPeriodDetailDto> ReopenPeriodAsync(
        Guid userId, string payMonth, ReopenPayrollPeriodRequest request, CancellationToken ct)
    {
        ValidateMonth(payMonth);
        var normalizedMonth = payMonth.Trim();

        var entity = await repository.FindByMonthAsync(normalizedMonth, ct);
        if (entity is null)
        {
            throw new AppException(404, $"Không tìm thấy kỳ tính lương tháng {payMonth}.");
        }

        if (string.IsNullOrWhiteSpace(request?.Reason))
        {
            throw new AppException(400, "Lý do mở lại kỳ tính lương là bắt buộc.");
        }
        var trimmedReason = request.Reason.Trim();
        if (trimmedReason.Length > 500)
        {
            throw new AppException(400, "Lý do mở lại không được vượt quá 500 ký tự.");
        }

        var normStatus = entity.Status?.Trim().ToLowerInvariant();
        if (normStatus == "draft" || normStatus == "open")
        {
            throw new AppException(400, "Kỳ tính lương đang ở trạng thái bản nháp, không cần mở lại.");
        }

        // GB-26 / Alternative Flow A3: Paid period blocks reopen (MSG48)
        var isPaid = await repository.HasPaidPayslipsAsync(normalizedMonth, ct);
        if (isPaid)
        {
            throw new AppException(400, "Kỳ lương này đã thanh toán hoặc đã quá hạn điều chỉnh. Vui lòng sử dụng điều chỉnh kỳ sau.");
        }

        // GB-26 / Alternative Flow A3: Expired correction window blocks reopen (MSG48)
        var (y, m) = PayrollPeriodRules.ParsePayMonth(normalizedMonth);
        var today = TimeHelper.TodayInVietnam();
        if (PayrollPeriodRules.IsAfterCorrectionDeadline(y, m, today))
        {
            throw new AppException(400, "Kỳ lương này đã thanh toán hoặc đã quá hạn điều chỉnh. Vui lòng sử dụng điều chỉnh kỳ sau.");
        }

        // GB-26: System logs the reopen, sets Late, and invalidates affected calculations and approvals
        var previousStatus = entity.Status;
        entity.Status = "draft";
        entity.LockedAt = null;
        entity.LockedBy = null;

        var payslips = await repository.GetPayslipsByMonthAsync(normalizedMonth, ct);
        foreach (var p in payslips)
        {
            p.IsLocked = false;
            p.Status = "draft";
            p.FinalizedAt = null;
            p.FinalizedBy = null;
            p.DeptApprovedAt = null;
            p.DeptApprovedBy = null;
            p.DeptRejectedReason = null;
        }

        var auditSnapshot = new
        {
            entity.LockId,
            entity.PayMonth,
            PreviousStatus = previousStatus,
            NewStatus = "draft",
            Reason = trimmedReason,
            IsLate = true,
            ReopenedAt = DateTime.UtcNow
        };
        auditHelper.Log("reopen", "PayrollLock", entity.LockId, new { Status = previousStatus }, auditSnapshot);

        await unitOfWork.SaveChangesAsync(ct);

        var detail = await repository.GetPeriodDetailAsync(normalizedMonth, ct);
        return detail!;
    }

    public async Task<PayrollPeriodDetailDto> CalculatePeriodAsync(
        Guid userId, string payMonth, CancellationToken ct)
    {
        ValidateMonth(payMonth);
        var normalizedMonth = payMonth.Trim();

        await using var tx = await unitOfWork.BeginTransactionAsync(ct, IsolationLevel.Serializable);

        var entity = await repository.FindByMonthAsync(normalizedMonth, ct)
            ?? throw new AppException(404, $"Không tìm thấy kỳ tính lương tháng {payMonth}.");

        if (IsLockedOrFinalizedStatus(entity.Status))
        {
            throw new AppException(400, "Kỳ lương đã bị khóa sổ, không thể tính toán lại. Vui lòng mở lại kỳ lương trước.");
        }

        var (y, m) = PayrollPeriodRules.ParsePayMonth(normalizedMonth);
        var monthStart = new DateOnly(y, m, 1);
        var monthEnd = monthStart.AddMonths(1).AddDays(-1);

        var ctx = await repository.LoadCalculationContextAsync(normalizedMonth, ct);
        var attendanceByStaff = ctx.MonthAttendanceRecords.ToLookup(x => x.StaffId);
        var onCallsByStaff = ctx.MonthOnCallShifts.ToLookup(x => x.StaffId);
        var leavesByStaff = ctx.ApprovedLeavesInMonth.ToLookup(x => x.StaffId);
        var now = DateTime.UtcNow;

        foreach (var staff in ctx.ActiveCs1Staff)
        {
            var att = PayrollPeriodRules.ComputeStaffAttendanceMetrics(
                monthStart,
                monthEnd,
                attendanceByStaff[staff.StaffId],
                onCallsByStaff[staff.StaffId],
                leavesByStaff[staff.StaffId],
                ctx.LeaveTypesIsPaid,
                ctx.ScheduledNightDatesByStaff?[staff.StaffId]);

            ctx.ActiveContractsByStaff.TryGetValue(staff.StaffId, out var contract);
            Position? position = null;
            if (staff.PositionId.HasValue)
            {
                ctx.PositionsById.TryGetValue(staff.PositionId.Value, out position);
            }

            bool isDoctorPos = PayrollPeriodRules.IsDoctorPosition(position);

            decimal clinicStdDays = PayrollPeriodRules.ResolveRate(
                ctx.ActiveRateConfigs, "standard_working_days", staff.StaffId, staff.PositionId,
                ctx.PositionsById, isDoctorPos, PayrollDefaults.StandardWorkingDays);
            decimal dutyNoonRate = PayrollPeriodRules.ResolveRate(
                ctx.ActiveRateConfigs, "duty_noon", staff.StaffId, staff.PositionId,
                ctx.PositionsById, isDoctorPos, 50_000m);
            decimal dutyNightRate = PayrollPeriodRules.ResolveRate(
                ctx.ActiveRateConfigs, "duty_night", staff.StaffId, staff.PositionId,
                ctx.PositionsById, isDoctorPos, isDoctorPos ? 200_000m : 100_000m);
            decimal otMultiplierPercent = PayrollPeriodRules.ResolveRate(
                ctx.ActiveRateConfigs, "duty_extra_hour_multiplier", staff.StaffId, staff.PositionId,
                ctx.PositionsById, isDoctorPos, 150m);
            decimal unionFeeFixed = PayrollPeriodRules.ResolveRate(
                ctx.ActiveRateConfigs, "union_fee", staff.StaffId, staff.PositionId,
                ctx.PositionsById, isDoctorPos, PayrollDefaults.UnionFee);

            // Lương lấy theo lịch sử lương của chính tháng này, không lấy mức lương đang áp dụng hôm nay.
            var salaryHistories = contract is null
                ? []
                : (ctx.SalaryHistoriesByContract?[contract.ContractId] ?? []).ToArray();
            var salarySegments = contract is null
                ? []
                : ContractSalaryRules.SegmentsFor(contract, salaryHistories, monthStart, monthEnd);
            // Các điều khoản tính theo tháng (bảo hiểm, thuế, lương làm cơ sở phụ cấp %) lấy tại ngày cuối hợp đồng trong tháng.
            var termsDate = contract?.EffectiveTo is { } contractEnd && contractEnd < monthEnd ? contractEnd : monthEnd;
            var termsEntry = contract is null ? null : ContractSalaryRules.EntryOn(salaryHistories, termsDate);
            bool insuranceEligible = termsEntry?.IsInsuranceEligible ?? contract?.IsInsuranceEligible ?? false;
            decimal? insuranceBasis = termsEntry is not null ? termsEntry.InsuranceSalaryBasis : contract?.InsuranceSalaryBasis;
            decimal? monthlySalaryTerms = termsEntry is not null ? termsEntry.MonthlySalary : contract?.MonthlySalary;
            string taxMethod = termsEntry?.TaxMethod ?? contract?.TaxMethod ?? "progressive";

            decimal dailyRate = salarySegments.Length > 0
                ? PayrollPeriodRules.DailyRateOf(salarySegments[^1], clinicStdDays)
                : 0m;
            decimal basePay = PayrollPeriodRules.BasePayBySegments(
                salarySegments, clinicStdDays, attendanceByStaff[staff.StaffId], leavesByStaff[staff.StaffId], ctx.LeaveTypesIsPaid);

            decimal noonPay = Math.Round(att.NoonDutyCount * dutyNoonRate, 2, MidpointRounding.AwayFromZero);
            decimal eveningPay = Math.Round(att.EveningDutyCount * dutyNightRate, 2, MidpointRounding.AwayFromZero);
            decimal overtimePay = (dailyRate > 0m && att.OvertimeHours > 0m)
                ? Math.Round(att.OvertimeHours * (dailyRate / 8m) * (otMultiplierPercent / 100m), 2, MidpointRounding.AwayFromZero)
                : 0m;

            bool isNew = !ctx.ExistingPayslipsByStaff.TryGetValue(staff.StaffId, out var payslip);
            if (isNew || payslip is null)
            {
                payslip = new Payslip
                {
                    PayslipId = Guid.NewGuid(),
                    StaffId = staff.StaffId,
                    PayMonth = normalizedMonth,
                    CreatedAt = now
                };
                repository.AddPayslip(payslip);
            }

            var allowanceLines = new List<PayslipAllowance>();
            int serviceYears = ComputeServiceYears(staff.DateJoined, monthEnd);
            decimal prorateDenom = clinicStdDays > 0m ? clinicStdDays : PayrollDefaults.StandardWorkingDays;

            foreach (var (sa, type) in ctx.AllowancesByStaff[staff.StaffId])
            {
                var calcMethod = (sa.CalcMethod ?? type.DefaultCalcMethod ?? "fixed").Trim().ToLowerInvariant();
                decimal amount;

                if (string.Equals(sa.ValueType, "percentage", StringComparison.OrdinalIgnoreCase)
                    || calcMethod == "percentage")
                {
                    decimal salaryBasis = monthlySalaryTerms ?? (dailyRate * prorateDenom);
                    amount = Math.Round(salaryBasis * (sa.AmountValue / 100m), 2, MidpointRounding.AwayFromZero);
                }
                else if (calcMethod is "prorate_by_workdays" or "prorate_by_workday")
                {
                    amount = Math.Round((sa.AmountValue / prorateDenom) * att.TotalWorkDays, 2, MidpointRounding.AwayFromZero);
                }
                else if (calcMethod == "per_service_year")
                {
                    amount = (type.MinServiceYears.HasValue && serviceYears < type.MinServiceYears.Value)
                        ? 0m
                        : Math.Round(sa.AmountValue * serviceYears, 2, MidpointRounding.AwayFromZero);
                }
                else
                {
                    amount = Math.Round(sa.AmountValue, 2, MidpointRounding.AwayFromZero);
                }

                if (amount > 0m)
                {
                    allowanceLines.Add(new PayslipAllowance
                    {
                        Id = Guid.NewGuid(),
                        PayslipId = payslip.PayslipId,
                        AllowanceId = sa.AllowanceId,
                        Name = type.Name,
                        Amount = amount
                    });
                }
            }

            if (eveningPay > 0m)
            {
                allowanceLines.Add(new PayslipAllowance
                {
                    Id = Guid.NewGuid(),
                    PayslipId = payslip.PayslipId,
                    AllowanceId = null,
                    Name = $"Tiền trực tối ({att.EveningDutyCount:0.#} ca)",
                    Amount = eveningPay
                });
            }
            if (noonPay > 0m)
            {
                allowanceLines.Add(new PayslipAllowance
                {
                    Id = Guid.NewGuid(),
                    PayslipId = payslip.PayslipId,
                    AllowanceId = null,
                    Name = $"Tiền trực trưa ({att.NoonDutyCount:0.#} ca)",
                    Amount = noonPay
                });
            }
            if (overtimePay > 0m)
            {
                allowanceLines.Add(new PayslipAllowance
                {
                    Id = Guid.NewGuid(),
                    PayslipId = payslip.PayslipId,
                    AllowanceId = null,
                    Name = $"Tiền trực ngoài giờ ({att.OvertimeHours:0.##} giờ)",
                    Amount = overtimePay
                });
            }

            decimal maternityPay = 0m;
            if (att.MaternityMonthRatio > 0m && contract is not null && insuranceEligible)
            {
                int daysInMonth = DateTime.DaysInMonth(y, m);
                decimal maternityInsBase = insuranceBasis ?? 5_061_100m;
                maternityPay = Math.Round(maternityInsBase * att.MaternityMonthRatio, 0, MidpointRounding.AwayFromZero);
                if (maternityPay > 0m)
                {
                    allowanceLines.Add(new PayslipAllowance
                    {
                        Id = Guid.NewGuid(),
                        PayslipId = payslip.PayslipId,
                        AllowanceId = null,
                        Name = $"Trợ cấp thai sản BHXH ({(att.MaternityMonthRatio >= 1m ? "1 tháng" : $"{att.MaternityCalendarDays:0} ngày/{daysInMonth}")})",
                        Amount = maternityPay
                    });
                }
            }

            decimal allowanceTotal = allowanceLines.Sum(x => x.Amount);
            decimal commissionTotal = Math.Round(
                ctx.ProcedureCommissionsByStaff[staff.StaffId].Where(x => x.IsVerified).Sum(x => x.CommissionAmount),
                2, MidpointRounding.AwayFromZero);
            decimal grossPay = basePay + allowanceTotal + commissionTotal;
            decimal taxableGrossPay = Math.Max(0m, basePay + (allowanceTotal - maternityPay) + commissionTotal);

            decimal insSalary = (taxableGrossPay > 0m && att.MaternityCalendarDays < 14m && contract is not null && insuranceEligible)
                ? (insuranceBasis ?? 5_061_100m)
                : 0m;
            bool isUnion = taxableGrossPay > unionFeeFixed && staff.IsUnionMember;

            var formulaResult = PayrollFormula.Calculate(new PayrollFormulaInput(
                TotalIncome: taxableGrossPay,
                InsuranceSalary: insSalary,
                IsUnionMember: isUnion,
                DependentCount: staff.DependentCount,
                TaxMethod: taxMethod,
                OtherDeductions: 0m,
                InsuranceEmployeeRatePercent: ctx.EmployeeInsuranceRatePercent,
                UnionFeeFixed: unionFeeFixed,
                PersonalDeduction: ctx.PersonalDeduction,
                DependentDeduction: ctx.DependentDeduction,
                FlatThreshold: ctx.FlatThreshold,
                FlatRatePercent: ctx.FlatRatePercent,
                RoundingUnit: ctx.RoundingUnit,
                DeductInsuranceBeforeTax: ctx.DeductInsuranceBeforeTax,
                DeductUnionFeeBeforeTax: ctx.DeductUnionFeeBeforeTax,
                DeductOtherBeforeTax: ctx.DeductOtherBeforeTax,
                FlatTaxBase: ctx.FlatTaxBase,
                Brackets: ctx.ActiveTaxBrackets
            ));

            var deductionLines = BuildDeductionLines(payslip.PayslipId, insSalary, ctx, formulaResult, now);

            payslip.StaffName = staff.FullName;
            payslip.DepartmentId = staff.DepartmentId;
            payslip.ContractId = contract?.ContractId;
            payslip.ContractType = contract?.ContractType;
            payslip.WorkDays = att.TotalWorkDays;
            payslip.OnCallDays = att.OnCallDays;
            payslip.BasePay = basePay;
            payslip.AllowanceTotal = allowanceTotal;
            payslip.CommissionTotal = commissionTotal;
            payslip.GrossPay = grossPay;
            payslip.InsuranceSalaryBase = insSalary;
            payslip.InsuranceDeduction = Math.Round(formulaResult.Step2_InsuranceDeduction, 2, MidpointRounding.AwayFromZero);
            payslip.DependentCount = staff.DependentCount;
            payslip.PersonalDeduction = formulaResult.Step4_PersonalDeductionAmount;
            payslip.DependentDeduction = formulaResult.Step4_DependentDeductionAmount;
            payslip.TaxableIncome = formulaResult.Step4_TaxableIncome;
            payslip.TaxDeduction = Math.Round(formulaResult.Step5_PitTax, 0, MidpointRounding.AwayFromZero);
            payslip.OtherDeduction = Math.Round(formulaResult.Step2_UnionFeeDeduction, 0, MidpointRounding.AwayFromZero);
            payslip.NetPay = formulaResult.Step6_TakeHome + maternityPay;
            payslip.Status = "draft";
            payslip.IsLocked = false;
            payslip.LockedAt = null;
            payslip.DeptApprovedBy = null;
            payslip.DeptApprovedAt = null;
            payslip.DeptRejectedReason = null;
            payslip.FinalizedBy = null;
            payslip.FinalizedAt = null;
            payslip.UpdatedAt = now;

            await repository.ReplacePayslipLinesAsync(payslip.PayslipId, allowanceLines, deductionLines, ct);
        }

        entity.Status = "draft";
        auditHelper.Log("calculate", "PayrollLock", entity.LockId, null, new
        {
            entity.PayMonth,
            Scope = "CS1",
            StaffCount = ctx.ActiveCs1Staff.Count,
            CalculatedBy = userId,
            CalculatedAt = now
        });

        await unitOfWork.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        var detail = await repository.GetPeriodDetailAsync(normalizedMonth, ct);
        return detail!;
    }

    public async Task<PayslipDetailDto> GetPayslipDetailAsync(
        string payMonth, Guid payslipId, CancellationToken ct)
    {
        ValidateMonth(payMonth);
        var normalizedMonth = payMonth.Trim();
        return await repository.GetPayslipDetailAsync(normalizedMonth, payslipId, ct)
            ?? throw new AppException(404, $"Không tìm thấy phiếu lương trong kỳ {normalizedMonth}.");
    }

    public async Task<PayslipDetailDto> ReviewPayslipAsync(
        Guid userId, string payMonth, Guid payslipId, ReviewPayslipRequest request, CancellationToken ct)
    {
        ValidateMonth(payMonth);
        var normalizedMonth = payMonth.Trim();

        var period = await repository.FindByMonthAsync(normalizedMonth, ct)
            ?? throw new AppException(404, $"Không tìm thấy kỳ tính lương tháng {payMonth}.");

        if (IsLockedOrFinalizedStatus(period.Status))
        {
            throw new AppException(400, "Kỳ lương đã bị khóa sổ, không thể thay đổi trạng thái rà soát.");
        }

        var reviewStatus = request?.ReviewStatus?.Trim().ToLowerInvariant() ?? string.Empty;
        if (!PayrollPeriodRules.ValidReviewStatuses.Contains(reviewStatus))
        {
            throw new AppException(400, "Trạng thái rà soát không hợp lệ.");
        }

        if (reviewStatus.StartsWith("needs_", StringComparison.Ordinal) && string.IsNullOrWhiteSpace(request?.Note))
        {
            throw new AppException(400, "Vui lòng nhập ghi chú lý do khi đánh dấu phiếu lương cần kiểm tra/hiệu chỉnh.");
        }

        var ps = await repository.FindPayslipAsync(normalizedMonth, payslipId, ct)
            ?? throw new AppException(404, $"Không tìm thấy phiếu lương trong kỳ {normalizedMonth}.");

        var oldState = PayrollPeriodRules.ParseReviewState(ps.Status, ps.DeptApprovedAt, ps.DeptRejectedReason);
        var now = DateTime.UtcNow;

        if (reviewStatus == "pending")
        {
            ps.DeptApprovedBy = null;
            ps.DeptApprovedAt = null;
            ps.DeptRejectedReason = null;
        }
        else
        {
            ps.DeptApprovedBy = userId;
            ps.DeptApprovedAt = now;
            ps.DeptRejectedReason = PayrollPeriodRules.EncodeReviewReason(reviewStatus, request?.Note);
        }
        ps.UpdatedAt = now;

        auditHelper.Log("review_payslip", "Payslip", ps.PayslipId,
            new { oldState.ReviewStatus, oldState.ReviewNote },
            new { ReviewStatus = reviewStatus, Note = request?.Note?.Trim() });

        await unitOfWork.SaveChangesAsync(ct);

        var updated = await repository.GetPayslipDetailAsync(normalizedMonth, payslipId, ct);
        return updated!;
    }

    public async Task<PayrollPeriodDetailDto> ReviewAllValidAsync(
        Guid userId, string payMonth, CancellationToken ct)
    {
        ValidateMonth(payMonth);
        var normalizedMonth = payMonth.Trim();

        var period = await repository.FindByMonthAsync(normalizedMonth, ct)
            ?? throw new AppException(404, $"Không tìm thấy kỳ tính lương tháng {payMonth}.");

        if (IsLockedOrFinalizedStatus(period.Status))
        {
            throw new AppException(400, "Kỳ lương đã bị khóa sổ, không thể rà soát.");
        }

        var payslips = await repository.GetPayslipsByMonthAsync(normalizedMonth, ct);
        if (payslips.Count == 0)
        {
            throw new AppException(400, "Kỳ lương chưa có dữ liệu phiếu lương. Vui lòng chạy Tính lương tháng trước.");
        }

        var now = DateTime.UtcNow;
        int reviewedCount = 0;

        foreach (var ps in payslips)
        {
            var (currentStatus, _) = PayrollPeriodRules.ParseReviewState(ps.Status, ps.DeptApprovedAt, ps.DeptRejectedReason);
            if (currentStatus == "pending" && ps.ContractId.HasValue && (ps.GrossPay ?? 0m) > 0m)
            {
                ps.DeptApprovedBy = userId;
                ps.DeptApprovedAt = now;
                ps.DeptRejectedReason = null;
                ps.UpdatedAt = now;
                reviewedCount++;
            }
        }

        auditHelper.Log("review_all_valid", "PayrollLock", period.LockId, null, new
        {
            period.PayMonth,
            ReviewedCount = reviewedCount,
            ReviewedBy = userId,
            ReviewedAt = now
        });

        await unitOfWork.SaveChangesAsync(ct);

        var detail = await repository.GetPeriodDetailAsync(normalizedMonth, ct);
        return detail!;
    }

    public async Task<PayrollPeriodDetailDto> ConfirmPeriodAsync(
        Guid userId, string payMonth, ConfirmPayrollPeriodRequest? request, CancellationToken ct)
    {
        ValidateMonth(payMonth);
        var normalizedMonth = payMonth.Trim();

        var period = await repository.FindByMonthAsync(normalizedMonth, ct)
            ?? throw new AppException(404, $"Không tìm thấy kỳ tính lương tháng {payMonth}.");

        if (IsLockedOrFinalizedStatus(period.Status))
        {
            throw new AppException(400, "Kỳ lương đã bị khóa sổ, không thể xác nhận lại.");
        }

        var payslips = await repository.GetPayslipsByMonthAsync(normalizedMonth, ct);
        if (payslips.Count == 0)
        {
            throw new AppException(400, "Kỳ lương chưa có dữ liệu phiếu lương. Vui lòng chạy Tính lương tháng trước khi xác nhận.");
        }

        var flaggedCount = payslips.Count(p =>
        {
            var (rs, _) = PayrollPeriodRules.ParseReviewState(p.Status, p.DeptApprovedAt, p.DeptRejectedReason);
            return rs.StartsWith("needs_", StringComparison.Ordinal);
        });
        if (flaggedCount > 0)
        {
            throw new AppException(400, $"Không thể xác nhận bảng lương khi còn {flaggedCount} phiếu lương đang gắn cờ chờ hiệu chỉnh.");
        }

        var previousStatus = period.Status;
        var now = DateTime.UtcNow;
        period.Status = "approved";

        foreach (var ps in payslips)
        {
            ps.Status = "approved";
            ps.DeptApprovedBy ??= userId;
            ps.DeptApprovedAt ??= now;
            ps.UpdatedAt = now;
        }

        auditHelper.Log("confirm", "PayrollLock", period.LockId,
            new { Status = previousStatus },
            new { Status = "approved", Note = request?.Note?.Trim(), ConfirmedBy = userId, ConfirmedAt = now });

        await unitOfWork.SaveChangesAsync(ct);

        var detail = await repository.GetPeriodDetailAsync(normalizedMonth, ct);
        return detail!;
    }

    public async Task<PayrollPeriodDetailDto> FinalizePeriodAsync(
        Guid userId, string payMonth, FinalizePayrollPeriodRequest request, CancellationToken ct)
    {
        ValidateMonth(payMonth);
        var normalizedMonth = payMonth.Trim();

        if (request is null || !request.ConfirmLock)
        {
            throw new AppException(400, "Vui lòng xác nhận chốt và khóa bảng lương chính thức.");
        }

        var period = await repository.FindByMonthAsync(normalizedMonth, ct)
            ?? throw new AppException(404, $"Không tìm thấy kỳ tính lương tháng {payMonth}.");

        if (IsLockedOrFinalizedStatus(period.Status))
        {
            throw new AppException(400, "Kỳ lương đã được chốt và khóa sổ trước đó.");
        }

        var normStatus = period.Status?.Trim().ToLowerInvariant();
        if (normStatus is not ("approved" or "confirmed"))
        {
            throw new AppException(400, "Vui lòng xác nhận bảng lương trước khi chốt & khóa sổ chính thức.");
        }

        var (attendanceLocked, proceduresVerified) = await repository.GetPeriodReadinessAsync(normalizedMonth, ct);
        if (!attendanceLocked)
        {
            throw new AppException(400, "Bảng chấm công tháng chưa được khóa. Không thể chốt sổ lương chính thức.");
        }

        if (!proceduresVerified)
        {
            throw new AppException(400, "Còn phiếu thủ thuật y tế trong tháng chưa được xác minh. Không thể chốt sổ lương chính thức.");
        }

        var payslips = await repository.GetPayslipsByMonthAsync(normalizedMonth, ct);
        if (payslips.Count == 0)
        {
            throw new AppException(400, "Kỳ lương chưa có dữ liệu phiếu lương.");
        }

        var now = DateTime.UtcNow;
        var previousStatus = period.Status;
        period.Status = "finalized";
        period.LockedBy = userId;
        period.LockedAt = now;

        foreach (var ps in payslips)
        {
            ps.Status = "finalized";
            ps.IsLocked = true;
            ps.LockedAt = now;
            ps.FinalizedBy = userId;
            ps.FinalizedAt = now;
            ps.UpdatedAt = now;
        }

        auditHelper.Log("finalize", "PayrollLock", period.LockId,
            new { Status = previousStatus },
            new
            {
                Status = "finalized",
                Note = request.Note?.Trim(),
                FinalizedBy = userId,
                FinalizedAt = now,
                EmployeeCount = payslips.Count,
                TotalGrossPay = payslips.Sum(x => x.GrossPay ?? 0m),
                TotalNetPay = payslips.Sum(x => x.NetPay ?? 0m)
            });

        await unitOfWork.SaveChangesAsync(ct);

        var detail = await repository.GetPeriodDetailAsync(normalizedMonth, ct);
        return detail!;
    }

    public async Task DeletePeriodAsync(Guid userId, string payMonth, CancellationToken ct)
    {
        ValidateMonth(payMonth);
        var normalizedMonth = payMonth.Trim();

        await using var tx = await unitOfWork.BeginTransactionAsync(ct, IsolationLevel.Serializable);

        var entity = await repository.FindByMonthAsync(normalizedMonth, ct)
            ?? throw new AppException(404, $"Không tìm thấy kỳ tính lương tháng {payMonth}.");

        var normStatus = entity.Status?.Trim().ToLowerInvariant();
        if (normStatus is not ("draft" or "open"))
        {
            throw new AppException(400,
                "Chỉ được phép xóa kỳ tính lương đang ở trạng thái Bản nháp. Kỳ lương đã xác nhận hoặc chốt sổ không thể xóa để đảm bảo lịch sử kiểm toán.");
        }

        if (await repository.HasPaidPayslipsAsync(normalizedMonth, ct))
        {
            throw new AppException(400, "Kỳ lương này đã phát sinh thanh toán, không thể xóa.");
        }

        if (await repository.HasPayslipComplaintsAsync(normalizedMonth, ct))
        {
            throw new AppException(400, "Kỳ lương này đã phát sinh thắc mắc/khiếu nại lương, không thể xóa.");
        }

        var payslips = await repository.GetPayslipsByMonthAsync(normalizedMonth, ct);
        var deletedPayslipCount = payslips.Count;

        var auditOldSnapshot = new
        {
            entity.LockId,
            entity.PayMonth,
            entity.Status,
            DeletedPayslipCount = deletedPayslipCount,
            DeletedBy = userId,
            DeletedAt = DateTime.UtcNow
        };

        await repository.DeleteDraftPeriodCascadeAsync(entity, ct);

        auditHelper.Log("delete", "PayrollLock", entity.LockId, auditOldSnapshot, null);

        await unitOfWork.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
    }

    public async Task<PayrollPeriodDetailDto> UpdatePayslipInlineAsync(
        Guid userId, string payMonth, Guid payslipId, UpdatePayslipInlineRequest request, CancellationToken ct)
    {
        ValidateMonth(payMonth);
        var normalizedMonth = payMonth.Trim();

        if (request is null)
        {
            throw new AppException(400, "Dữ liệu điều chỉnh phiếu lương không hợp lệ.");
        }

        if (request.WorkDays is < 0m or > 31m)
        {
            throw new AppException(400, "Số ngày công phải nằm trong khoảng 0 đến 31.");
        }

        if (request.OnCallDays is < 0m or > 62m)
        {
            throw new AppException(400, "Số ca trực phải nằm trong khoảng 0 đến 62.");
        }

        if (request.NoonDutyCount.HasValue && request.NoonDutyCount.Value is < 0m or > 31m)
        {
            throw new AppException(400, "Số ca trực trưa phải nằm trong khoảng 0 đến 31.");
        }

        if (request.EveningDutyCount.HasValue && request.EveningDutyCount.Value is < 0m or > 31m)
        {
            throw new AppException(400, "Số ca trực tối phải nằm trong khoảng 0 đến 31.");
        }

        if (request.BasePay < 0m || request.AllowanceAndDutyTotal < 0m || request.CommissionTotal < 0m)
        {
            throw new AppException(400, "Các khoản thu nhập không được âm.");
        }

        await using var tx = await unitOfWork.BeginTransactionAsync(ct, IsolationLevel.Serializable);

        var period = await repository.FindByMonthAsync(normalizedMonth, ct)
            ?? throw new AppException(404, $"Không tìm thấy kỳ tính lương tháng {payMonth}.");

        if (IsLockedOrFinalizedStatus(period.Status))
        {
            throw new AppException(400, "Kỳ lương đã bị khóa sổ, không thể chỉnh sửa phiếu lương. Vui lòng mở lại kỳ lương trước.");
        }

        var payslip = await repository.FindPayslipAsync(normalizedMonth, payslipId, ct)
            ?? throw new AppException(404, $"Không tìm thấy phiếu lương trong kỳ {normalizedMonth}.");

        var ctx = await repository.LoadCalculationContextAsync(normalizedMonth, ct);
        var staff = ctx.ActiveCs1Staff.FirstOrDefault(s => s.StaffId == payslip.StaffId);
        ctx.ActiveContractsByStaff.TryGetValue(payslip.StaffId, out var contract);

        // Bảo hiểm và phương pháp thuế lấy theo lịch sử lương của tháng này, không theo mức lương hiện tại.
        var (inlineYear, inlineMonth) = PayrollPeriodRules.ParsePayMonth(normalizedMonth);
        var inlineMonthEnd = new DateOnly(inlineYear, inlineMonth, 1).AddMonths(1).AddDays(-1);
        var termsDate = contract?.EffectiveTo is { } contractEnd && contractEnd < inlineMonthEnd ? contractEnd : inlineMonthEnd;
        var termsEntry = contract is null
            ? null
            : ContractSalaryRules.EntryOn(ctx.SalaryHistoriesByContract?[contract.ContractId] ?? [], termsDate);
        bool insuranceEligible = termsEntry?.IsInsuranceEligible ?? contract?.IsInsuranceEligible ?? false;
        decimal? insuranceBasis = termsEntry is not null ? termsEntry.InsuranceSalaryBasis : contract?.InsuranceSalaryBasis;
        string taxMethod = termsEntry?.TaxMethod ?? contract?.TaxMethod ?? "progressive";

        Position? position = null;
        if (staff?.PositionId.HasValue == true)
        {
            ctx.PositionsById.TryGetValue(staff.PositionId.Value, out position);
        }

        bool isDoctorPos = PayrollPeriodRules.IsDoctorPosition(position);
        decimal dutyNoonRate = PayrollPeriodRules.ResolveRate(
            ctx.ActiveRateConfigs, "duty_noon", payslip.StaffId, staff?.PositionId,
            ctx.PositionsById, isDoctorPos, 50_000m);
        decimal dutyNightRate = PayrollPeriodRules.ResolveRate(
            ctx.ActiveRateConfigs, "duty_night", payslip.StaffId, staff?.PositionId,
            ctx.PositionsById, isDoctorPos, isDoctorPos ? 200_000m : 100_000m);
        decimal unionFeeFixed = PayrollPeriodRules.ResolveRate(
            ctx.ActiveRateConfigs, "union_fee", payslip.StaffId, staff?.PositionId,
            ctx.PositionsById, isDoctorPos, PayrollDefaults.UnionFee);

        bool hasExplicitDuties = request.NoonDutyCount.HasValue || request.EveningDutyCount.HasValue;
        decimal? noonDutyCount = request.NoonDutyCount.HasValue
            ? Math.Round(request.NoonDutyCount.Value, 2, MidpointRounding.AwayFromZero)
            : (hasExplicitDuties ? 0m : null);
        decimal? eveningDutyCount = request.EveningDutyCount.HasValue
            ? Math.Round(request.EveningDutyCount.Value, 2, MidpointRounding.AwayFromZero)
            : (hasExplicitDuties ? 0m : null);

        decimal workDays = Math.Round(request.WorkDays, 2, MidpointRounding.AwayFromZero);
        decimal onCallDays = hasExplicitDuties
            ? Math.Round((eveningDutyCount ?? 0m) + (noonDutyCount ?? 0m), 2, MidpointRounding.AwayFromZero)
            : Math.Round(request.OnCallDays, 2, MidpointRounding.AwayFromZero);
        decimal basePay = Math.Round(request.BasePay, 2, MidpointRounding.AwayFromZero);
        decimal allowanceTotal = Math.Round(request.AllowanceAndDutyTotal, 2, MidpointRounding.AwayFromZero);
        decimal commissionTotal = Math.Round(request.CommissionTotal, 2, MidpointRounding.AwayFromZero);
        decimal grossPay = Math.Round(basePay + allowanceTotal + commissionTotal, 2, MidpointRounding.AwayFromZero);

        decimal insSalary = grossPay > 0m
            ? (contract is not null
                ? (insuranceEligible ? (insuranceBasis ?? 5_061_100m) : 0m)
                : (payslip.InsuranceSalaryBase ?? 0m))
            : 0m;

        bool isUnionMember = staff?.IsUnionMember ?? ((payslip.OtherDeduction ?? 0m) > 0m);
        bool isUnion = grossPay > unionFeeFixed && isUnionMember;
        int dependentCount = staff?.DependentCount ?? payslip.DependentCount ?? 0;

        var formulaResult = PayrollFormula.Calculate(new PayrollFormulaInput(
            TotalIncome: grossPay,
            InsuranceSalary: insSalary,
            IsUnionMember: isUnion,
            DependentCount: dependentCount,
            TaxMethod: taxMethod,
            OtherDeductions: 0m,
            InsuranceEmployeeRatePercent: ctx.EmployeeInsuranceRatePercent,
            UnionFeeFixed: unionFeeFixed,
            PersonalDeduction: ctx.PersonalDeduction,
            DependentDeduction: ctx.DependentDeduction,
            FlatThreshold: ctx.FlatThreshold,
            FlatRatePercent: ctx.FlatRatePercent,
            RoundingUnit: ctx.RoundingUnit,
            DeductInsuranceBeforeTax: ctx.DeductInsuranceBeforeTax,
            DeductUnionFeeBeforeTax: ctx.DeductUnionFeeBeforeTax,
            DeductOtherBeforeTax: ctx.DeductOtherBeforeTax,
            FlatTaxBase: ctx.FlatTaxBase,
            Brackets: ctx.ActiveTaxBrackets
        ));

        var now = DateTime.UtcNow;
        var existingAllowances = await repository.GetPayslipAllowancesAsync(payslip.PayslipId, ct);
        (decimal EveningCount, decimal NoonCount, decimal EveningRate, decimal NoonRate)? explicitDuty =
            hasExplicitDuties
                ? (eveningDutyCount ?? 0m, noonDutyCount ?? 0m, dutyNightRate, dutyNoonRate)
                : null;
        var syncedAllowances = SyncAllowancesForInlineEdit(
            payslip.PayslipId, allowanceTotal, existingAllowances, explicitDuty);
        var deductionLines = BuildDeductionLines(payslip.PayslipId, insSalary, ctx, formulaResult, now);

        var oldSnapshot = new
        {
            payslip.WorkDays,
            payslip.OnCallDays,
            payslip.BasePay,
            payslip.AllowanceTotal,
            payslip.CommissionTotal,
            payslip.GrossPay,
            payslip.InsuranceDeduction,
            payslip.TaxDeduction,
            payslip.OtherDeduction,
            payslip.NetPay
        };

        payslip.WorkDays = workDays;
        payslip.OnCallDays = onCallDays;
        payslip.BasePay = basePay;
        payslip.AllowanceTotal = allowanceTotal;
        payslip.CommissionTotal = commissionTotal;
        payslip.GrossPay = grossPay;
        payslip.InsuranceSalaryBase = insSalary;
        payslip.InsuranceDeduction = Math.Round(formulaResult.Step2_InsuranceDeduction, 2, MidpointRounding.AwayFromZero);
        payslip.DependentCount = dependentCount;
        payslip.PersonalDeduction = formulaResult.Step4_PersonalDeductionAmount;
        payslip.DependentDeduction = formulaResult.Step4_DependentDeductionAmount;
        payslip.TaxableIncome = formulaResult.Step4_TaxableIncome;
        payslip.TaxDeduction = Math.Round(formulaResult.Step5_PitTax, 0, MidpointRounding.AwayFromZero);
        payslip.OtherDeduction = Math.Round(formulaResult.Step2_UnionFeeDeduction, 0, MidpointRounding.AwayFromZero);
        payslip.NetPay = formulaResult.Step6_TakeHome;
        payslip.Status = "draft";
        payslip.IsLocked = false;
        payslip.DeptApprovedBy = userId;
        payslip.DeptApprovedAt = now;
        payslip.DeptRejectedReason = string.IsNullOrWhiteSpace(request.Note)
            ? null
            : PayrollPeriodRules.EncodeReviewReason("reviewed", request.Note);
        payslip.UpdatedAt = now;

        // Nếu kỳ lương đã xác nhận trước đó, đưa về bản nháp để kế toán xác nhận lại sau khi sửa
        var periodNormStatus = period.Status?.Trim().ToLowerInvariant();
        if (periodNormStatus is "approved" or "confirmed")
        {
            period.Status = "draft";
        }

        await repository.ReplacePayslipLinesAsync(payslip.PayslipId, syncedAllowances, deductionLines, ct);

        var newSnapshot = new
        {
            payslip.WorkDays,
            payslip.OnCallDays,
            payslip.BasePay,
            payslip.AllowanceTotal,
            payslip.CommissionTotal,
            payslip.GrossPay,
            payslip.InsuranceDeduction,
            payslip.TaxDeduction,
            payslip.OtherDeduction,
            payslip.NetPay,
            Note = request.Note?.Trim(),
            AdjustedBy = userId,
            AdjustedAt = now
        };
        auditHelper.Log("adjust_payslip", "Payslip", payslip.PayslipId, oldSnapshot, newSnapshot);

        await unitOfWork.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        var detail = await repository.GetPeriodDetailAsync(normalizedMonth, ct);
        return detail!;
    }

    private static bool IsFinalizedStatus(string? status)
        => status is not null && status.Trim().ToLowerInvariant() is "finalized" or "locked" or "paid";

    private static PayslipDetailDto SanitizeForEmployee(PayslipDetailDto detail)
    {
        // Ẩn ghi chú rà soát nội bộ của kế toán khi hiển thị cho nhân viên (SRS 6.13)
        return detail with
        {
            ReviewNote = null
        };
    }

    private async Task<Guid> RequireStaffIdAsync(Guid userId, CancellationToken ct)
    {
        var staffId = await repository.FindStaffIdByUserIdAsync(userId, ct);
        if (!staffId.HasValue)
        {
            throw new AppException(403, "Bạn không có quyền truy cập chức năng hoặc bản ghi này.");
        }
        return staffId.Value;
    }

    public async Task<List<MyPayslipSummaryDto>> ListMyPayslipsAsync(Guid userId, int? year, CancellationToken ct)
    {
        if (year.HasValue && (year.Value < 2000 || year.Value > 2100))
        {
            throw new AppException(400, "Năm lọc không hợp lệ.");
        }

        var staffId = await RequireStaffIdAsync(userId, ct);
        return await repository.ListFinalizedPayslipsByStaffAsync(staffId, year, ct);
    }

    public async Task<MyPayslipMonthLookupDto> GetMyPayslipByMonthAsync(
        Guid userId, string payMonth, CancellationToken ct)
    {
        ValidateMonth(payMonth);
        var normalizedMonth = payMonth.Trim();
        var staffId = await RequireStaffIdAsync(userId, ct);

        var period = await repository.FindByMonthAsync(normalizedMonth, ct);
        if (period is null || !IsFinalizedStatus(period.Status))
        {
            // A1 - MSG10: Kỳ lương chưa được chốt
            return new MyPayslipMonthLookupDto(
                PayMonth: normalizedMonth,
                Availability: "not_finalized",
                Message: "Bảng lương kỳ này chưa được chốt, phiếu lương chưa khả dụng.",
                Payslip: null
            );
        }

        var ps = await repository.FindPayslipByMonthAndStaffAsync(normalizedMonth, staffId, ct);
        if (ps is null || (ps.IsLocked != true && !IsFinalizedStatus(ps.Status)))
        {
            // A2 - MSG01: Không tìm thấy phiếu lương phù hợp
            return new MyPayslipMonthLookupDto(
                PayMonth: normalizedMonth,
                Availability: "not_found",
                Message: "Không tìm thấy phiếu lương phù hợp cho kỳ đã chọn.",
                Payslip: null
            );
        }

        var detail = await repository.GetPayslipDetailAsync(normalizedMonth, ps.PayslipId, ct);
        if (detail is null)
        {
            return new MyPayslipMonthLookupDto(
                PayMonth: normalizedMonth,
                Availability: "not_found",
                Message: "Không tìm thấy phiếu lương phù hợp cho kỳ đã chọn.",
                Payslip: null
            );
        }

        return new MyPayslipMonthLookupDto(
            PayMonth: normalizedMonth,
            Availability: "available",
            Message: null,
            Payslip: SanitizeForEmployee(detail)
        );
    }

    public async Task<PayslipDetailDto> GetMyPayslipDetailAsync(
        Guid userId, Guid payslipId, CancellationToken ct)
    {
        var staffId = await RequireStaffIdAsync(userId, ct);
        var ps = await repository.FindPayslipByIdAsync(payslipId, ct);
        if (ps is null)
        {
            throw new AppException(404, "Không tìm thấy phiếu lương phù hợp.");
        }

        // A3 - MSG38: Chặn truy cập phiếu lương của nhân viên khác
        if (ps.StaffId != staffId)
        {
            throw new AppException(403, "Bạn không có quyền truy cập chức năng hoặc bản ghi này.");
        }

        var period = await repository.FindByMonthAsync(ps.PayMonth, ct);
        if (period is null || !IsFinalizedStatus(period.Status) || (ps.IsLocked != true && !IsFinalizedStatus(ps.Status)))
        {
            // A1 - MSG10: Kỳ lương chưa được chốt
            throw new AppException(400, "Bảng lương kỳ này chưa được chốt, phiếu lương chưa khả dụng.");
        }

        var detail = await repository.GetPayslipDetailAsync(ps.PayMonth, ps.PayslipId, ct)
            ?? throw new AppException(404, "Không tìm thấy phiếu lương phù hợp.");

        return SanitizeForEmployee(detail);
    }
}
