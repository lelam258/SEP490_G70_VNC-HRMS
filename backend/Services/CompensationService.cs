using System.Data;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Vnc.HRMS.Common.Exceptions;
using Vnc.HRMS.DTOs.Payroll;
using Vnc.HRMS.Models;
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
        PayrollParameterRules.EnsureMoney(request.DailyRate, "Lương ngày (DailyRate)");

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

        await using var tx = await unitOfWork.BeginTransactionAsync(ct, IsolationLevel.Serializable);

        var contract = await repository.FindContractAsync(contractId, ct)
            ?? throw new AppException(404, "Không tìm thấy hợp đồng lao động.");

        bool valuesChanged = contract.DailyRate != request.DailyRate
            || contract.IsInsuranceEligible != request.IsInsuranceEligible
            || contract.InsuranceSalaryBasis != insuranceBasis;

        var lockedMonths = await parameterRepository.GetLockedMonthsAsync(ct);
        PayrollParameterRules.EnsureLockedPeriodRule(
            lockedMonths,
            new LockedPeriodState(contract.EffectiveFrom, contract.EffectiveTo, contract.Status),
            new LockedPeriodState(contract.EffectiveFrom, contract.EffectiveTo, contract.Status),
            valuesChanged);

        var oldSnapshot = new
        {
            contract.DailyRate,
            contract.IsInsuranceEligible,
            contract.InsuranceSalaryBasis
        };

        contract.DailyRate = request.DailyRate;
        contract.IsInsuranceEligible = request.IsInsuranceEligible;
        contract.InsuranceSalaryBasis = insuranceBasis;
        contract.UpdatedAt = DateTime.UtcNow;

        var newSnapshot = new
        {
            DailyRate = request.DailyRate,
            IsInsuranceEligible = request.IsInsuranceEligible,
            InsuranceSalaryBasis = insuranceBasis
        };
        auditHelper.Log("update", "Contract", contract.ContractId, oldSnapshot, newSnapshot);

        await SaveChangesWithDeadlockHandlingAsync(ct);
        await tx.CommitAsync(ct);

        var openMonths = await parameterRepository.GetOpenMonthsAsync(ct);
        var affectedPeriods = PayrollParameterRules.AffectedOpenPeriods(openMonths, contract.EffectiveFrom, contract.EffectiveTo);

        var result = await GetContractCompensationAsync(contractId, ct);
        return result with { AffectedOpenPeriods = affectedPeriods };
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
            || entity.AmountValue != request.AmountValue;

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
            entity.EffectiveFrom,
            entity.EffectiveTo,
            entity.Status
        };

        entity.AllowanceId = request.AllowanceId;
        entity.ValueType = valueType;
        entity.AmountValue = request.AmountValue;
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
