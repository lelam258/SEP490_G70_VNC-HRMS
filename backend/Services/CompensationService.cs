using System.Data;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Vnc.HRMS.Common.Exceptions;
using Vnc.HRMS.DTOs.Payroll;
using Vnc.HRMS.Models;
using Vnc.HRMS.Models.Employees;
using Vnc.HRMS.Repositories.Interfaces;
using Vnc.HRMS.Services.Interfaces;
using Vnc.HRMS.Services.Rules;

namespace Vnc.HRMS.Services;

public sealed class CompensationService(
    ICompensationRepository repository,
    IPayrollParameterRepository parameterRepository,
    IUnitOfWork unitOfWork,
    IAuditLogHelper auditHelper) : ICompensationService
{
    public Task<ContractSummaryDto[]> ListContractsAsync(string? q, string? status, CancellationToken ct)
        => repository.ListContractsAsync(q, status, ct);

    public async Task<ContractCompensationDto> GetContractCompensationAsync(Guid contractId, CancellationToken ct)
    {
        var result = await repository.GetContractCompensationAsync(contractId, ct)
            ?? throw new AppException(404, "Không tìm thấy hợp đồng lao động.");
        return result;
    }

    public async Task<ContractCompensationDto> UpdateContractCompensationAsync(
        Guid contractId, UpdateContractCompensationRequest request, CancellationToken ct)
    {
        var salaryType = PayrollParameterRules.RequireOption(request.SalaryType ?? "daily", PayrollParameterRules.SalaryTypes, "Kiểu lương");
        var taxMethod = PayrollParameterRules.RequireOption(request.TaxMethod ?? "progressive", PayrollParameterRules.TaxMethods, "Phương pháp tính thuế");
        var standardWorkingDays = request.StandardWorkingDays ?? await ConfiguredStandardWorkingDaysAsync(ct);
        if (standardWorkingDays <= 0 || standardWorkingDays > 31)
        {
            throw new AppException(400, "Số ngày công chuẩn phải nằm trong khoảng từ 1 đến 31.");
        }

        decimal dailyRate;
        decimal? monthlySalary;

        if (salaryType == "daily")
        {
            PayrollParameterRules.EnsureMoney(request.DailyRate, "Lương ngày (DailyRate)");
            dailyRate = request.DailyRate;
            monthlySalary = request.MonthlySalary ?? (dailyRate * standardWorkingDays);
        }
        else // monthly
        {
            if (!request.MonthlySalary.HasValue || request.MonthlySalary.Value <= 0)
            {
                throw new AppException(400, "Lương tháng là bắt buộc và phải lớn hơn 0 đối với kiểu lương theo tháng.");
            }
            monthlySalary = request.MonthlySalary.Value;
            dailyRate = Math.Round(monthlySalary.Value / standardWorkingDays, 2);
        }

        decimal? insuranceBasis = null;
        if (request.IsInsuranceEligible)
        {
            if (!request.InsuranceSalaryBasis.HasValue || request.InsuranceSalaryBasis.Value <= 0)
            {
                throw new AppException(400, "Mức lương đóng bảo hiểm là bắt buộc và phải lớn hơn 0 khi tham gia bảo hiểm.");
            }
            PayrollParameterRules.EnsureMoney(request.InsuranceSalaryBasis.Value, "Mức lương đóng bảo hiểm");
            insuranceBasis = request.InsuranceSalaryBasis.Value;
        }

        var effectiveChangeDate = request.EffectiveFrom ?? PayrollParameterRules.TodayVn();

        await using var tx = await unitOfWork.BeginTransactionAsync(ct, IsolationLevel.Serializable);

        var contract = await repository.FindContractAsync(contractId, ct)
            ?? throw new AppException(404, "Không tìm thấy hợp đồng lao động.");

        if (!PayrollParameterRules.PeriodWithin(effectiveChangeDate, effectiveChangeDate, contract.EffectiveFrom, contract.EffectiveTo))
        {
            throw new AppException(400, $"Ngày áp dụng mức lương mới ({effectiveChangeDate:dd/MM/yyyy}) phải nằm trong thời hạn hợp đồng ({contract.EffectiveFrom:dd/MM/yyyy} - {contract.EffectiveTo:dd/MM/yyyy}).");
        }

        var staff = await repository.FindStaffAsync(contract.StaffId, ct)
            ?? throw new AppException(404, "Không tìm thấy nhân viên của hợp đồng.");

        // The salary history is the source of truth; compare against its latest entry
        // (which may be a change scheduled for a future date), falling back to the contract.
        var latestHistory = await repository.GetLatestSalaryHistoryAsync(contractId, ct);
        var baseline = latestHistory is not null
            ? (latestHistory.SalaryType, latestHistory.DailyRate, latestHistory.MonthlySalary, latestHistory.StandardWorkingDays,
                latestHistory.TaxMethod, latestHistory.IsInsuranceEligible, latestHistory.InsuranceSalaryBasis)
            : (contract.SalaryType, contract.DailyRate, contract.MonthlySalary, contract.StandardWorkingDays,
                contract.TaxMethod, contract.IsInsuranceEligible, contract.IsInsuranceEligible ? contract.InsuranceSalaryBasis : null);

        bool valuesChanged = baseline != (salaryType, dailyRate, monthlySalary, standardWorkingDays,
            taxMethod, request.IsInsuranceEligible, insuranceBasis);

        if (valuesChanged)
        {
            if (latestHistory != null && effectiveChangeDate < latestHistory.EffectiveFrom)
            {
                throw new AppException(400, $"Ngày áp dụng mức lương mới phải từ {latestHistory.EffectiveFrom:dd/MM/yyyy} trở đi (ngày bắt đầu của lần điều chỉnh gần nhất).");
            }

            // The new salary applies from the change date to the contract end; none of that may be a locked month.
            var lockedMonths = await parameterRepository.GetLockedMonthsAsync(ct);
            PayrollParameterRules.EnsureLockedPeriodRule(
                lockedMonths, null, new LockedPeriodState(effectiveChangeDate, contract.EffectiveTo, contract.Status), true);
        }

        var oldSnapshot = new
        {
            SalaryType = baseline.Item1,
            DailyRate = baseline.Item2,
            MonthlySalary = baseline.Item3,
            StandardWorkingDays = baseline.Item4,
            TaxMethod = baseline.Item5,
            IsInsuranceEligible = baseline.Item6,
            InsuranceSalaryBasis = baseline.Item7,
            staff.SiteId,
            staff.IsUnionMember
        };

        // Contract fields cache the salary in force today, so a future-dated change only goes into the history.
        if (valuesChanged && effectiveChangeDate <= PayrollParameterRules.TodayVn())
        {
            contract.SalaryType = salaryType;
            contract.DailyRate = dailyRate;
            contract.MonthlySalary = monthlySalary;
            contract.StandardWorkingDays = standardWorkingDays;
            contract.TaxMethod = taxMethod;
            contract.IsInsuranceEligible = request.IsInsuranceEligible;
            contract.InsuranceSalaryBasis = insuranceBasis;
            contract.UpdatedAt = DateTime.UtcNow;
        }

        if (request.SiteId.HasValue)
        {
            staff.SiteId = request.SiteId.Value;
        }
        if (request.IsUnionMember.HasValue)
        {
            staff.IsUnionMember = request.IsUnionMember.Value;
        }
        staff.UpdatedAt = DateTime.UtcNow;

        if (valuesChanged)
        {
            if (latestHistory != null && latestHistory.EffectiveFrom == effectiveChangeDate)
            {
                // Same start date as the latest entry: correct that entry instead of creating a zero-length period.
                latestHistory.SalaryType = salaryType;
                latestHistory.DailyRate = dailyRate;
                latestHistory.MonthlySalary = monthlySalary;
                latestHistory.StandardWorkingDays = standardWorkingDays;
                latestHistory.IsInsuranceEligible = request.IsInsuranceEligible;
                latestHistory.InsuranceSalaryBasis = insuranceBasis;
                latestHistory.TaxMethod = taxMethod;
                latestHistory.Note = request.Note ?? latestHistory.Note;
            }
            else
            {
                if (latestHistory != null && (latestHistory.EffectiveTo == null || latestHistory.EffectiveTo >= effectiveChangeDate))
                {
                    latestHistory.EffectiveTo = effectiveChangeDate.AddDays(-1);
                }

                var newHistory = new ContractSalaryHistory
                {
                    HistoryId = Guid.NewGuid(),
                    ContractId = contractId,
                    SalaryType = salaryType,
                    DailyRate = dailyRate,
                    MonthlySalary = monthlySalary,
                    StandardWorkingDays = standardWorkingDays,
                    IsInsuranceEligible = request.IsInsuranceEligible,
                    InsuranceSalaryBasis = insuranceBasis,
                    TaxMethod = taxMethod,
                    EffectiveFrom = effectiveChangeDate,
                    EffectiveTo = contract.EffectiveTo,
                    Note = request.Note ?? "Cập nhật đãi ngộ hợp đồng",
                    CreatedAt = DateTime.UtcNow
                };
                repository.AddContractSalaryHistory(newHistory);
            }
        }

        var newSnapshot = new
        {
            SalaryType = salaryType,
            DailyRate = dailyRate,
            MonthlySalary = monthlySalary,
            StandardWorkingDays = standardWorkingDays,
            TaxMethod = taxMethod,
            IsInsuranceEligible = request.IsInsuranceEligible,
            InsuranceSalaryBasis = insuranceBasis,
            staff.SiteId,
            staff.IsUnionMember
        };
        auditHelper.Log("update", "Contract", contract.ContractId, oldSnapshot, newSnapshot);

        await SaveChangesWithDeadlockHandlingAsync(ct);
        await tx.CommitAsync(ct);

        var openMonths = await parameterRepository.GetOpenMonthsAsync(ct);
        var affectedPeriods = PayrollParameterRules.AffectedOpenPeriods(openMonths, effectiveChangeDate, contract.EffectiveTo);

        var result = await GetContractCompensationAsync(contractId, ct);
        return result with { AffectedOpenPeriods = affectedPeriods };
    }

    public async Task<ContractSalarySegmentDto[]> GetSalarySegmentsAsync(Guid contractId, DateOnly from, DateOnly to, CancellationToken ct)
    {
        if (to < from) throw new AppException(400, "Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.");

        var contract = await repository.FindContractAsync(contractId, ct)
            ?? throw new AppException(404, "Không tìm thấy hợp đồng lao động.");

        var histories = await repository.ListSalaryHistoryEntriesAsync(contractId, ct);
        return ContractSalaryRules.SegmentsFor(contract, histories, from, to);
    }

    public async Task<ContractSalaryHistoryDto[]> ListSalaryHistoriesAsync(Guid contractId, CancellationToken ct)
    {
        var contract = await repository.FindContractAsync(contractId, ct)
            ?? throw new AppException(404, "Không tìm thấy hợp đồng lao động.");

        return await repository.ListContractSalaryHistoriesAsync(contractId, ct);
    }

    public async Task<StaffAllowanceDto[]> ListStaffAllowancesAsync(Guid contractId, CancellationToken ct)
    {
        var contract = await repository.FindContractAsync(contractId, ct)
            ?? throw new AppException(404, "Không tìm thấy hợp đồng lao động.");

        return await repository.ListStaffAllowancesAsync(contract.StaffId, ct);
    }

    public async Task<StaffAllowanceDto> CreateStaffAllowanceAsync(
        Guid contractId, SaveStaffAllowanceRequest request, Guid? approverId, CancellationToken ct)
    {
        var contract = await repository.FindContractAsync(contractId, ct)
            ?? throw new AppException(404, "Không tìm thấy hợp đồng lao động.");

        if (!await repository.AllowanceExistsAndActiveAsync(request.AllowanceId, ct))
        {
            throw new AppException(404, "Loại phụ cấp không tồn tại hoặc đã ngừng hoạt động.");
        }

        var valueType = PayrollParameterRules.RequireOption(request.ValueType, PayrollParameterRules.AllowanceValueTypes, "Loại giá trị phụ cấp");
        var calcMethod = PayrollParameterRules.RequireOption(request.CalcMethod ?? "fixed", PayrollParameterRules.AllowanceCalcMethods, "Phương thức tính");
        PayrollParameterRules.EnsureTypedValue(valueType, request.AmountValue, "Giá trị phụ cấp");
        PayrollParameterRules.EnsureEffectiveRange(request.EffectiveFrom, request.EffectiveTo);
        var status = PayrollParameterRules.NormalizeStatus(request.Status);

        if (!PayrollParameterRules.PeriodWithin(request.EffectiveFrom, request.EffectiveTo, contract.EffectiveFrom, contract.EffectiveTo))
        {
            throw new AppException(400, $"Thời hạn phụ cấp ({request.EffectiveFrom:dd/MM/yyyy} - {request.EffectiveTo:dd/MM/yyyy}) phải nằm trong thời hạn hợp đồng ({contract.EffectiveFrom:dd/MM/yyyy} - {contract.EffectiveTo:dd/MM/yyyy}).");
        }

        await using var tx = await unitOfWork.BeginTransactionAsync(ct, IsolationLevel.Serializable);

        var lockedMonths = await parameterRepository.GetLockedMonthsAsync(ct);
        PayrollParameterRules.EnsureLockedPeriodRule(
            lockedMonths, null, new LockedPeriodState(request.EffectiveFrom, request.EffectiveTo, status), true);

        if (status == PayrollParameterRules.Active)
        {
            var existing = await repository.GetOverlappingStaffAllowancesAsync(
                contract.StaffId, request.AllowanceId, request.EffectiveFrom, request.EffectiveTo, null, ct);

            foreach (var ex in existing)
            {
                if (PayrollParameterRules.PeriodsOverlap(request.EffectiveFrom, request.EffectiveTo, ex.EffectiveFrom, ex.EffectiveTo))
                {
                    throw new AppException(409, $"Nhân viên đã được gán phụ cấp này với khoảng thời gian trùng lặp ({ex.EffectiveFrom:dd/MM/yyyy} - {ex.EffectiveTo:dd/MM/yyyy}).");
                }
            }
        }

        var entity = new StaffAllowance
        {
            StaffAllowanceId = Guid.NewGuid(),
            StaffId = contract.StaffId,
            AllowanceId = request.AllowanceId,
            ValueType = valueType,
            AmountValue = request.AmountValue,
            CalcMethod = calcMethod,
            EffectiveFrom = request.EffectiveFrom,
            EffectiveTo = request.EffectiveTo,
            Status = status,
            ApprovedBy = approverId,
            CreatedAt = DateTime.UtcNow
        };

        repository.AddStaffAllowance(entity);

        var newSnapshot = new
        {
            entity.StaffId,
            entity.AllowanceId,
            entity.ValueType,
            entity.AmountValue,
            entity.CalcMethod,
            entity.EffectiveFrom,
            entity.EffectiveTo,
            entity.Status
        };
        auditHelper.Log("create", "StaffAllowance", entity.StaffAllowanceId, null, newSnapshot);

        await SaveChangesWithDeadlockHandlingAsync(ct);
        await tx.CommitAsync(ct);

        var openMonths = await parameterRepository.GetOpenMonthsAsync(ct);
        var affectedPeriods = PayrollParameterRules.AffectedOpenPeriods(openMonths, request.EffectiveFrom, request.EffectiveTo);

        var all = await repository.ListStaffAllowancesAsync(contract.StaffId, ct);
        return all.First(x => x.StaffAllowanceId == entity.StaffAllowanceId) with { AffectedOpenPeriods = affectedPeriods };
    }

    public async Task<StaffAllowanceDto> UpdateStaffAllowanceAsync(
        Guid contractId, Guid staffAllowanceId, SaveStaffAllowanceRequest request, Guid? approverId, CancellationToken ct)
    {
        var contract = await repository.FindContractAsync(contractId, ct)
            ?? throw new AppException(404, "Không tìm thấy hợp đồng lao động.");

        var entity = await repository.FindStaffAllowanceAsync(staffAllowanceId, ct)
            ?? throw new AppException(404, "Không tìm thấy phụ cấp nhân viên.");

        if (entity.StaffId != contract.StaffId)
        {
            throw new AppException(404, "Phụ cấp không thuộc hợp đồng này.");
        }

        if (entity.AllowanceId != request.AllowanceId && !await repository.AllowanceExistsAndActiveAsync(request.AllowanceId, ct))
        {
            throw new AppException(404, "Loại phụ cấp không tồn tại hoặc đã ngừng hoạt động.");
        }

        var valueType = PayrollParameterRules.RequireOption(request.ValueType, PayrollParameterRules.AllowanceValueTypes, "Loại giá trị phụ cấp");
        var calcMethod = PayrollParameterRules.RequireOption(request.CalcMethod ?? "fixed", PayrollParameterRules.AllowanceCalcMethods, "Phương thức tính");
        PayrollParameterRules.EnsureTypedValue(valueType, request.AmountValue, "Giá trị phụ cấp");
        PayrollParameterRules.EnsureEffectiveRange(request.EffectiveFrom, request.EffectiveTo);
        var status = PayrollParameterRules.NormalizeStatus(request.Status);

        if (!PayrollParameterRules.PeriodWithin(request.EffectiveFrom, request.EffectiveTo, contract.EffectiveFrom, contract.EffectiveTo))
        {
            throw new AppException(400, $"Thời hạn phụ cấp ({request.EffectiveFrom:dd/MM/yyyy} - {request.EffectiveTo:dd/MM/yyyy}) phải nằm trong thời hạn hợp đồng ({contract.EffectiveFrom:dd/MM/yyyy} - {contract.EffectiveTo:dd/MM/yyyy}).");
        }

        await using var tx = await unitOfWork.BeginTransactionAsync(ct, IsolationLevel.Serializable);

        bool valuesChanged = entity.AllowanceId != request.AllowanceId
            || entity.ValueType != valueType
            || entity.AmountValue != request.AmountValue
            || entity.CalcMethod != calcMethod;

        var lockedMonths = await parameterRepository.GetLockedMonthsAsync(ct);
        PayrollParameterRules.EnsureLockedPeriodRule(
            lockedMonths,
            new LockedPeriodState(entity.EffectiveFrom, entity.EffectiveTo, entity.Status),
            new LockedPeriodState(request.EffectiveFrom, request.EffectiveTo, status),
            valuesChanged);

        if (status == PayrollParameterRules.Active)
        {
            var existing = await repository.GetOverlappingStaffAllowancesAsync(
                contract.StaffId, request.AllowanceId, request.EffectiveFrom, request.EffectiveTo, staffAllowanceId, ct);

            foreach (var ex in existing)
            {
                if (PayrollParameterRules.PeriodsOverlap(request.EffectiveFrom, request.EffectiveTo, ex.EffectiveFrom, ex.EffectiveTo))
                {
                    throw new AppException(409, $"Nhân viên đã được gán phụ cấp này với khoảng thời gian trùng lặp ({ex.EffectiveFrom:dd/MM/yyyy} - {ex.EffectiveTo:dd/MM/yyyy}).");
                }
            }
        }

        var oldSnapshot = new
        {
            entity.StaffId,
            entity.AllowanceId,
            entity.ValueType,
            entity.AmountValue,
            entity.CalcMethod,
            entity.EffectiveFrom,
            entity.EffectiveTo,
            entity.Status
        };

        entity.AllowanceId = request.AllowanceId;
        entity.ValueType = valueType;
        entity.AmountValue = request.AmountValue;
        entity.CalcMethod = calcMethod;
        entity.EffectiveFrom = request.EffectiveFrom;
        entity.EffectiveTo = request.EffectiveTo;
        entity.Status = status;
        entity.ApprovedBy = approverId;

        var newSnapshot = new
        {
            entity.StaffId,
            entity.AllowanceId,
            entity.ValueType,
            entity.AmountValue,
            entity.CalcMethod,
            entity.EffectiveFrom,
            entity.EffectiveTo,
            entity.Status
        };
        auditHelper.Log("update", "StaffAllowance", staffAllowanceId, oldSnapshot, newSnapshot);

        await SaveChangesWithDeadlockHandlingAsync(ct);
        await tx.CommitAsync(ct);

        var openMonths = await parameterRepository.GetOpenMonthsAsync(ct);
        var affectedPeriods = PayrollParameterRules.AffectedOpenPeriods(openMonths, request.EffectiveFrom, request.EffectiveTo);

        var all = await repository.ListStaffAllowancesAsync(contract.StaffId, ct);
        return all.First(x => x.StaffAllowanceId == staffAllowanceId) with { AffectedOpenPeriods = affectedPeriods };
    }

    public async Task<StaffAllowanceDto> DeactivateStaffAllowanceAsync(
        Guid contractId, Guid staffAllowanceId, DeactivateParameterRequest request, CancellationToken ct)
    {
        var contract = await repository.FindContractAsync(contractId, ct)
            ?? throw new AppException(404, "Không tìm thấy hợp đồng lao động.");

        var entity = await repository.FindStaffAllowanceAsync(staffAllowanceId, ct)
            ?? throw new AppException(404, "Không tìm thấy phụ cấp nhân viên.");

        if (entity.StaffId != contract.StaffId)
        {
            throw new AppException(404, "Phụ cấp không thuộc hợp đồng này.");
        }

        await using var tx = await unitOfWork.BeginTransactionAsync(ct, IsolationLevel.Serializable);

        var lockedMonths = await parameterRepository.GetLockedMonthsAsync(ct);
        var (effFrom, effTo, newStatus) = PayrollParameterRules.ComputeDeactivation(
            entity.EffectiveFrom, entity.EffectiveTo, request.EffectiveTo, lockedMonths);

        var oldSnapshot = new { entity.EffectiveFrom, entity.EffectiveTo, entity.Status };

        entity.EffectiveFrom = effFrom;
        entity.EffectiveTo = effTo;
        entity.Status = newStatus;

        var newSnapshot = new { entity.EffectiveFrom, entity.EffectiveTo, entity.Status };
        auditHelper.Log("deactivate", "StaffAllowance", staffAllowanceId, oldSnapshot, newSnapshot);

        await SaveChangesWithDeadlockHandlingAsync(ct);
        await tx.CommitAsync(ct);

        var openMonths = await parameterRepository.GetOpenMonthsAsync(ct);
        var affectedPeriods = PayrollParameterRules.AffectedOpenPeriods(openMonths, effFrom, effTo);

        var all = await repository.ListStaffAllowancesAsync(contract.StaffId, ct);
        return all.First(x => x.StaffAllowanceId == staffAllowanceId) with { AffectedOpenPeriods = affectedPeriods };
    }

    /// <summary>The clinic-wide standard_working_days parameter in force today, else the default.</summary>
    private async Task<decimal> ConfiguredStandardWorkingDaysAsync(CancellationToken ct)
    {
        var configs = await parameterRepository.ListRateConfigsAsync(
            new PayrollRateConfigFilter("standard_working_days", null, null, PayrollParameterRules.Active, PayrollParameterRules.TodayVn(), null), ct);
        return configs.FirstOrDefault(x => x.PositionId == null && x.StaffId == null)?.Value ?? PayrollDefaults.StandardWorkingDays;
    }

    private async Task SaveChangesWithDeadlockHandlingAsync(CancellationToken ct)
    {
        try
        {
            await unitOfWork.SaveChangesAsync(ct);
        }
        catch (DbUpdateException ex) when (ex.InnerException is SqlException sql && sql.Number == 1205)
        {
            throw new AppException(409, "Dữ liệu đang được cập nhật đồng thời. Vui lòng thử lại.");
        }
        catch (SqlException sql) when (sql.Number == 1205)
        {
            throw new AppException(409, "Dữ liệu đang được cập nhật đồng thời. Vui lòng thử lại.");
        }
    }
}
