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

public sealed class PayrollParameterService(
    IPayrollParameterRepository repository,
    IUnitOfWork unitOfWork,
    IAuditLogHelper auditHelper) : IPayrollParameterService
{
    // =========================================================================
    // Allowances
    // =========================================================================

    public Task<AllowanceTypeDto[]> ListAllowancesAsync(PayrollParameterFilter filter, CancellationToken ct)
        => repository.ListAllowancesAsync(filter, ct);

    public async Task<AllowanceTypeDto> GetAllowanceAsync(Guid id, CancellationToken ct)
    {
        var item = await repository.FindAllowanceAsync(id, ct)
            ?? throw new AppException(404, "Không tìm thấy loại phụ cấp.");

        return new AllowanceTypeDto(
            item.AllowanceId,
            item.Code,
            item.Name,
            item.ValueType,
            item.DefaultValue,
            item.AppliesTo ?? "all",
            item.DefaultCalcMethod ?? "fixed",
            item.MinServiceYears,
            item.IsTaxable ?? false,
            item.IsInsuranceBasis ?? false,
            item.Status ?? "active",
            item.CreatedAt);
    }

    public async Task<AllowanceTypeDto> CreateAllowanceAsync(SaveAllowanceTypeRequest request, CancellationToken ct)
    {
        var code = PayrollParameterRules.NormalizeCode(request.Code);
        var name = PayrollParameterRules.RequireText(request.Name, "Tên loại phụ cấp", 100);
        var valueType = PayrollParameterRules.RequireOption(request.ValueType, PayrollParameterRules.AllowanceValueTypes, "Loại giá trị");
        var calcMethod = PayrollParameterRules.RequireOption(request.DefaultCalcMethod ?? "fixed", PayrollParameterRules.AllowanceCalcMethods, "Phương thức tính");
        var status = PayrollParameterRules.NormalizeStatus(request.Status);
        var appliesTo = PayrollParameterRules.OptionalText(request.AppliesTo, "Đối tượng áp dụng", 50, "all");

        if (request.DefaultValue.HasValue)
        {
            PayrollParameterRules.EnsureTypedValue(valueType, request.DefaultValue.Value, "Giá trị mặc định");
        }

        if (calcMethod == "per_service_year" && request.MinServiceYears.HasValue && request.MinServiceYears.Value < 0)
        {
            throw new AppException(400, "Số năm thâm niên tối thiểu không được âm.");
        }

        await using var tx = await unitOfWork.BeginTransactionAsync(ct, IsolationLevel.Serializable);

        if (await repository.AllowanceCodeExistsAsync(code, null, ct))
        {
            throw new AppException(409, $"Mã phụ cấp '{code}' đã tồn tại.");
        }

        var entity = new AllowanceType
        {
            AllowanceId = Guid.NewGuid(),
            Code = code,
            Name = name,
            ValueType = valueType,
            DefaultValue = request.DefaultValue,
            AppliesTo = appliesTo,
            DefaultCalcMethod = calcMethod,
            MinServiceYears = request.MinServiceYears,
            IsTaxable = request.IsTaxable,
            IsInsuranceBasis = request.IsInsuranceBasis,
            Status = status,
            CreatedAt = DateTime.UtcNow
        };

        repository.AddAllowance(entity);

        var newSnapshot = new
        {
            entity.Code,
            entity.Name,
            entity.ValueType,
            entity.DefaultValue,
            entity.AppliesTo,
            entity.DefaultCalcMethod,
            entity.MinServiceYears,
            entity.IsTaxable,
            entity.IsInsuranceBasis,
            entity.Status
        };
        auditHelper.Log("create", "AllowanceType", entity.AllowanceId, null, newSnapshot);

        await SaveChangesWithDeadlockHandlingAsync(ct);
        await tx.CommitAsync(ct);

        return await GetAllowanceAsync(entity.AllowanceId, ct);
    }

    public async Task<AllowanceTypeDto> UpdateAllowanceAsync(Guid id, SaveAllowanceTypeRequest request, CancellationToken ct)
    {
        await using var tx = await unitOfWork.BeginTransactionAsync(ct, IsolationLevel.Serializable);

        var entity = await repository.FindAllowanceAsync(id, ct)
            ?? throw new AppException(404, "Không tìm thấy loại phụ cấp.");

        var code = PayrollParameterRules.NormalizeCode(request.Code);
        var name = PayrollParameterRules.RequireText(request.Name, "Tên loại phụ cấp", 100);
        var valueType = PayrollParameterRules.RequireOption(request.ValueType, PayrollParameterRules.AllowanceValueTypes, "Loại giá trị");
        var calcMethod = PayrollParameterRules.RequireOption(request.DefaultCalcMethod ?? "fixed", PayrollParameterRules.AllowanceCalcMethods, "Phương thức tính");
        var status = PayrollParameterRules.NormalizeStatus(request.Status);
        var appliesTo = PayrollParameterRules.OptionalText(request.AppliesTo, "Đối tượng áp dụng", 50, "all");

        if (request.DefaultValue.HasValue)
        {
            PayrollParameterRules.EnsureTypedValue(valueType, request.DefaultValue.Value, "Giá trị mặc định");
        }

        if (calcMethod == "per_service_year" && request.MinServiceYears.HasValue && request.MinServiceYears.Value < 0)
        {
            throw new AppException(400, "Số năm thâm niên tối thiểu không được âm.");
        }

        if (await repository.AllowanceCodeExistsAsync(code, id, ct))
        {
            throw new AppException(409, $"Mã phụ cấp '{code}' đã được sử dụng bởi loại phụ cấp khác.");
        }

        var oldSnapshot = new
        {
            entity.Code,
            entity.Name,
            entity.ValueType,
            entity.DefaultValue,
            entity.AppliesTo,
            entity.DefaultCalcMethod,
            entity.MinServiceYears,
            entity.IsTaxable,
            entity.IsInsuranceBasis,
            entity.Status
        };

        entity.Code = code;
        entity.Name = name;
        entity.ValueType = valueType;
        entity.DefaultValue = request.DefaultValue;
        entity.AppliesTo = appliesTo;
        entity.DefaultCalcMethod = calcMethod;
        entity.MinServiceYears = request.MinServiceYears;
        entity.IsTaxable = request.IsTaxable;
        entity.IsInsuranceBasis = request.IsInsuranceBasis;
        entity.Status = status;

        var newSnapshot = new
        {
            entity.Code,
            entity.Name,
            entity.ValueType,
            entity.DefaultValue,
            entity.AppliesTo,
            entity.DefaultCalcMethod,
            entity.MinServiceYears,
            entity.IsTaxable,
            entity.IsInsuranceBasis,
            entity.Status
        };
        auditHelper.Log("update", "AllowanceType", id, oldSnapshot, newSnapshot);

        await SaveChangesWithDeadlockHandlingAsync(ct);
        await tx.CommitAsync(ct);

        return await GetAllowanceAsync(id, ct);
    }

    public async Task<AllowanceTypeDto> DeactivateAllowanceAsync(Guid id, DeactivateParameterRequest request, CancellationToken ct)
    {
        await using var tx = await unitOfWork.BeginTransactionAsync(ct, IsolationLevel.Serializable);

        var entity = await repository.FindAllowanceAsync(id, ct)
            ?? throw new AppException(404, "Không tìm thấy loại phụ cấp.");

        var oldSnapshot = new { entity.Status };
        entity.Status = PayrollParameterRules.Inactive;
        var newSnapshot = new { entity.Status };
        auditHelper.Log("deactivate", "AllowanceType", id, oldSnapshot, newSnapshot);

        await SaveChangesWithDeadlockHandlingAsync(ct);
        await tx.CommitAsync(ct);

        return await GetAllowanceAsync(id, ct);
    }

    // =========================================================================
    // Insurances
    // =========================================================================

    public Task<InsuranceConfigDto[]> ListInsurancesAsync(PayrollParameterFilter filter, CancellationToken ct)
        => repository.ListInsurancesAsync(filter, ct);

    public async Task<InsuranceConfigDto> GetInsuranceAsync(Guid id, CancellationToken ct)
    {
        var item = await repository.FindInsuranceAsync(id, ct)
            ?? throw new AppException(404, "Không tìm thấy cấu hình bảo hiểm.");

        return new InsuranceConfigDto(
            item.ConfigId,
            item.InsuranceType,
            item.Payer,
            item.RatePercent,
            item.AppliesTo ?? "all",
            item.EffectiveFrom,
            item.EffectiveTo,
            item.Status ?? "active");
    }

    public async Task<InsuranceConfigDto> CreateInsuranceAsync(SaveInsuranceConfigRequest request, CancellationToken ct)
    {
        var insType = PayrollParameterRules.RequireOption(request.InsuranceType, PayrollParameterRules.InsuranceTypes, "Loại bảo hiểm");
        var payer = PayrollParameterRules.RequireOption(request.Payer, PayrollParameterRules.InsurancePayers, "Bên đóng bảo hiểm");
        PayrollParameterRules.EnsurePercent(request.RatePercent, "Tỷ lệ đóng");
        PayrollParameterRules.EnsureEffectiveRange(request.EffectiveFrom, request.EffectiveTo);
        var status = PayrollParameterRules.NormalizeStatus(request.Status);
        var appliesTo = PayrollParameterRules.OptionalText(request.AppliesTo, "Đối tượng áp dụng", 50, "all");

        await using var tx = await unitOfWork.BeginTransactionAsync(ct, IsolationLevel.Serializable);

        var lockedMonths = await repository.GetLockedMonthsAsync(ct);
        PayrollParameterRules.EnsureLockedPeriodRule(
            lockedMonths, null, new LockedPeriodState(request.EffectiveFrom, request.EffectiveTo, status), true);

        if (status == PayrollParameterRules.Active)
        {
            var existing = await repository.GetOverlappingInsurancesAsync(insType, payer, appliesTo, request.EffectiveFrom, request.EffectiveTo, null, ct);
            foreach (var ex in existing)
            {
                if (PayrollParameterRules.PeriodsOverlap(request.EffectiveFrom, request.EffectiveTo, ex.EffectiveFrom, ex.EffectiveTo))
                {
                    throw new AppException(409, $"Đã có cấu hình bảo hiểm '{insType}' cho '{payer}' trùng lặp thời gian hiệu lực ({ex.EffectiveFrom:dd/MM/yyyy} - {ex.EffectiveTo:dd/MM/yyyy}).");
                }
            }
        }

        var entity = new PayrollInsuranceConfig
        {
            ConfigId = Guid.NewGuid(),
            InsuranceType = insType,
            Payer = payer,
            RatePercent = request.RatePercent,
            AppliesTo = appliesTo,
            EffectiveFrom = request.EffectiveFrom,
            EffectiveTo = request.EffectiveTo,
            Status = status
        };

        repository.AddInsurance(entity);

        var newSnapshot = new
        {
            entity.InsuranceType,
            entity.Payer,
            entity.RatePercent,
            entity.AppliesTo,
            entity.EffectiveFrom,
            entity.EffectiveTo,
            entity.Status
        };
        auditHelper.Log("create", "PayrollInsuranceConfig", entity.ConfigId, null, newSnapshot);

        await SaveChangesWithDeadlockHandlingAsync(ct);
        await tx.CommitAsync(ct);

        var openMonths = await repository.GetOpenMonthsAsync(ct);
        var affectedPeriods = PayrollParameterRules.AffectedOpenPeriods(openMonths, request.EffectiveFrom, request.EffectiveTo);

        var dto = await GetInsuranceAsync(entity.ConfigId, ct);
        return dto with { AffectedOpenPeriods = affectedPeriods };
    }

    public async Task<InsuranceConfigDto> UpdateInsuranceAsync(Guid id, SaveInsuranceConfigRequest request, CancellationToken ct)
    {
        await using var tx = await unitOfWork.BeginTransactionAsync(ct, IsolationLevel.Serializable);

        var entity = await repository.FindInsuranceAsync(id, ct)
            ?? throw new AppException(404, "Không tìm thấy cấu hình bảo hiểm.");

        var insType = PayrollParameterRules.RequireOption(request.InsuranceType, PayrollParameterRules.InsuranceTypes, "Loại bảo hiểm");
        var payer = PayrollParameterRules.RequireOption(request.Payer, PayrollParameterRules.InsurancePayers, "Bên đóng bảo hiểm");
        PayrollParameterRules.EnsurePercent(request.RatePercent, "Tỷ lệ đóng");
        PayrollParameterRules.EnsureEffectiveRange(request.EffectiveFrom, request.EffectiveTo);
        var status = PayrollParameterRules.NormalizeStatus(request.Status);
        var appliesTo = PayrollParameterRules.OptionalText(request.AppliesTo, "Đối tượng áp dụng", 50, "all");

        bool valuesChanged = entity.InsuranceType != insType
            || entity.Payer != payer
            || entity.RatePercent != request.RatePercent
            || (entity.AppliesTo ?? "all") != appliesTo;

        var lockedMonths = await repository.GetLockedMonthsAsync(ct);
        PayrollParameterRules.EnsureLockedPeriodRule(
            lockedMonths,
            new LockedPeriodState(entity.EffectiveFrom, entity.EffectiveTo, entity.Status ?? "active"),
            new LockedPeriodState(request.EffectiveFrom, request.EffectiveTo, status),
            valuesChanged);

        if (status == PayrollParameterRules.Active)
        {
            var existing = await repository.GetOverlappingInsurancesAsync(insType, payer, appliesTo, request.EffectiveFrom, request.EffectiveTo, id, ct);
            foreach (var ex in existing)
            {
                if (PayrollParameterRules.PeriodsOverlap(request.EffectiveFrom, request.EffectiveTo, ex.EffectiveFrom, ex.EffectiveTo))
                {
                    throw new AppException(409, $"Đã có cấu hình bảo hiểm '{insType}' cho '{payer}' trùng lặp thời gian hiệu lực ({ex.EffectiveFrom:dd/MM/yyyy} - {ex.EffectiveTo:dd/MM/yyyy}).");
                }
            }
        }

        var oldSnapshot = new
        {
            entity.InsuranceType,
            entity.Payer,
            entity.RatePercent,
            entity.AppliesTo,
            entity.EffectiveFrom,
            entity.EffectiveTo,
            entity.Status
        };

        entity.InsuranceType = insType;
        entity.Payer = payer;
        entity.RatePercent = request.RatePercent;
        entity.AppliesTo = appliesTo;
        entity.EffectiveFrom = request.EffectiveFrom;
        entity.EffectiveTo = request.EffectiveTo;
        entity.Status = status;

        var newSnapshot = new
        {
            entity.InsuranceType,
            entity.Payer,
            entity.RatePercent,
            entity.AppliesTo,
            entity.EffectiveFrom,
            entity.EffectiveTo,
            entity.Status
        };
        auditHelper.Log("update", "PayrollInsuranceConfig", id, oldSnapshot, newSnapshot);

        await SaveChangesWithDeadlockHandlingAsync(ct);
        await tx.CommitAsync(ct);

        var openMonths = await repository.GetOpenMonthsAsync(ct);
        var affectedPeriods = PayrollParameterRules.AffectedOpenPeriods(openMonths, request.EffectiveFrom, request.EffectiveTo);

        var dto = await GetInsuranceAsync(id, ct);
        return dto with { AffectedOpenPeriods = affectedPeriods };
    }

    public async Task<InsuranceConfigDto> DeactivateInsuranceAsync(Guid id, DeactivateParameterRequest request, CancellationToken ct)
    {
        await using var tx = await unitOfWork.BeginTransactionAsync(ct, IsolationLevel.Serializable);

        var entity = await repository.FindInsuranceAsync(id, ct)
            ?? throw new AppException(404, "Không tìm thấy cấu hình bảo hiểm.");

        var lockedMonths = await repository.GetLockedMonthsAsync(ct);
        var (effFrom, effTo, newStatus) = PayrollParameterRules.ComputeDeactivation(
            entity.EffectiveFrom, entity.EffectiveTo, request.EffectiveTo, lockedMonths);

        var oldSnapshot = new { entity.EffectiveFrom, entity.EffectiveTo, entity.Status };
        entity.EffectiveFrom = effFrom;
        entity.EffectiveTo = effTo;
        entity.Status = newStatus;
        var newSnapshot = new { entity.EffectiveFrom, entity.EffectiveTo, entity.Status };
        auditHelper.Log("deactivate", "PayrollInsuranceConfig", id, oldSnapshot, newSnapshot);

        await SaveChangesWithDeadlockHandlingAsync(ct);
        await tx.CommitAsync(ct);

        var openMonths = await repository.GetOpenMonthsAsync(ct);
        var affectedPeriods = PayrollParameterRules.AffectedOpenPeriods(openMonths, effFrom, effTo);

        var dto = await GetInsuranceAsync(id, ct);
        return dto with { AffectedOpenPeriods = affectedPeriods };
    }

    // =========================================================================
    // Tax Brackets & Policy
    // =========================================================================

    public Task<TaxBracketDto[]> ListTaxBracketsAsync(PayrollParameterFilter filter, CancellationToken ct)
        => repository.ListTaxBracketsAsync(filter, ct);

    public async Task<TaxBracketDto> GetTaxBracketAsync(Guid id, CancellationToken ct)
    {
        var item = await repository.FindTaxBracketAsync(id, ct)
            ?? throw new AppException(404, "Không tìm thấy bậc thuế.");

        return new TaxBracketDto(
            item.BracketId,
            item.IncomeFrom,
            item.IncomeTo,
            item.TaxRatePercent,
            item.EffectiveFrom,
            item.EffectiveTo,
            item.Status ?? "active");
    }

    public async Task<TaxBracketDto> CreateTaxBracketAsync(SaveTaxBracketRequest request, CancellationToken ct)
    {
        PayrollParameterRules.EnsureTaxBracket(request.IncomeFrom, request.IncomeTo, request.TaxRatePercent);
        PayrollParameterRules.EnsureEffectiveRange(request.EffectiveFrom, request.EffectiveTo);
        var status = PayrollParameterRules.NormalizeStatus(request.Status);

        await using var tx = await unitOfWork.BeginTransactionAsync(ct, IsolationLevel.Serializable);

        var lockedMonths = await repository.GetLockedMonthsAsync(ct);
        PayrollParameterRules.EnsureLockedPeriodRule(
            lockedMonths, null, new LockedPeriodState(request.EffectiveFrom, request.EffectiveTo, status), true);

        if (status == PayrollParameterRules.Active)
        {
            var active = await repository.GetActiveTaxBracketsAsync(request.EffectiveFrom, request.EffectiveTo, null, ct);
            foreach (var ex in active)
            {
                if (PayrollParameterRules.PeriodsOverlap(request.EffectiveFrom, request.EffectiveTo, ex.EffectiveFrom, ex.EffectiveTo)
                    && PayrollParameterRules.IncomeRangesOverlap(request.IncomeFrom, request.IncomeTo, ex.IncomeFrom, ex.IncomeTo))
                {
                    throw new AppException(409, $"Khoảng thu nhập ({request.IncomeFrom:N0} - {(request.IncomeTo.HasValue ? request.IncomeTo.Value.ToString("N0") : "vô cùng")}) trùng lặp với bậc thuế hiện có ({ex.IncomeFrom:N0} - {(ex.IncomeTo.HasValue ? ex.IncomeTo.Value.ToString("N0") : "vô cùng")}).");
                }
            }
        }

        var entity = new PayrollTaxBracket
        {
            BracketId = Guid.NewGuid(),
            IncomeFrom = request.IncomeFrom,
            IncomeTo = request.IncomeTo,
            TaxRatePercent = request.TaxRatePercent,
            EffectiveFrom = request.EffectiveFrom,
            EffectiveTo = request.EffectiveTo,
            Status = status
        };

        repository.AddTaxBracket(entity);

        var newSnapshot = new
        {
            entity.IncomeFrom,
            entity.IncomeTo,
            entity.TaxRatePercent,
            entity.EffectiveFrom,
            entity.EffectiveTo,
            entity.Status
        };
        auditHelper.Log("create", "PayrollTaxBracket", entity.BracketId, null, newSnapshot);

        await SaveChangesWithDeadlockHandlingAsync(ct);
        await tx.CommitAsync(ct);

        var openMonths = await repository.GetOpenMonthsAsync(ct);
        var affectedPeriods = PayrollParameterRules.AffectedOpenPeriods(openMonths, request.EffectiveFrom, request.EffectiveTo);

        var dto = await GetTaxBracketAsync(entity.BracketId, ct);
        return dto with { AffectedOpenPeriods = affectedPeriods };
    }

    public async Task<TaxBracketDto> UpdateTaxBracketAsync(Guid id, SaveTaxBracketRequest request, CancellationToken ct)
    {
        await using var tx = await unitOfWork.BeginTransactionAsync(ct, IsolationLevel.Serializable);

        var entity = await repository.FindTaxBracketAsync(id, ct)
            ?? throw new AppException(404, "Không tìm thấy bậc thuế.");

        PayrollParameterRules.EnsureTaxBracket(request.IncomeFrom, request.IncomeTo, request.TaxRatePercent);
        PayrollParameterRules.EnsureEffectiveRange(request.EffectiveFrom, request.EffectiveTo);
        var status = PayrollParameterRules.NormalizeStatus(request.Status);

        bool valuesChanged = entity.IncomeFrom != request.IncomeFrom
            || entity.IncomeTo != request.IncomeTo
            || entity.TaxRatePercent != request.TaxRatePercent;

        var lockedMonths = await repository.GetLockedMonthsAsync(ct);
        PayrollParameterRules.EnsureLockedPeriodRule(
            lockedMonths,
            new LockedPeriodState(entity.EffectiveFrom, entity.EffectiveTo, entity.Status ?? "active"),
            new LockedPeriodState(request.EffectiveFrom, request.EffectiveTo, status),
            valuesChanged);

        if (status == PayrollParameterRules.Active)
        {
            var active = await repository.GetActiveTaxBracketsAsync(request.EffectiveFrom, request.EffectiveTo, id, ct);
            foreach (var ex in active)
            {
                if (PayrollParameterRules.PeriodsOverlap(request.EffectiveFrom, request.EffectiveTo, ex.EffectiveFrom, ex.EffectiveTo)
                    && PayrollParameterRules.IncomeRangesOverlap(request.IncomeFrom, request.IncomeTo, ex.IncomeFrom, ex.IncomeTo))
                {
                    throw new AppException(409, $"Khoảng thu nhập ({request.IncomeFrom:N0} - {(request.IncomeTo.HasValue ? request.IncomeTo.Value.ToString("N0") : "vô cùng")}) trùng lặp với bậc thuế hiện có ({ex.IncomeFrom:N0} - {(ex.IncomeTo.HasValue ? ex.IncomeTo.Value.ToString("N0") : "vô cùng")}).");
                }
            }
        }

        var oldSnapshot = new
        {
            entity.IncomeFrom,
            entity.IncomeTo,
            entity.TaxRatePercent,
            entity.EffectiveFrom,
            entity.EffectiveTo,
            entity.Status
        };

        entity.IncomeFrom = request.IncomeFrom;
        entity.IncomeTo = request.IncomeTo;
        entity.TaxRatePercent = request.TaxRatePercent;
        entity.EffectiveFrom = request.EffectiveFrom;
        entity.EffectiveTo = request.EffectiveTo;
        entity.Status = status;

        var newSnapshot = new
        {
            entity.IncomeFrom,
            entity.IncomeTo,
            entity.TaxRatePercent,
            entity.EffectiveFrom,
            entity.EffectiveTo,
            entity.Status
        };
        auditHelper.Log("update", "PayrollTaxBracket", id, oldSnapshot, newSnapshot);

        await SaveChangesWithDeadlockHandlingAsync(ct);
        await tx.CommitAsync(ct);

        var openMonths = await repository.GetOpenMonthsAsync(ct);
        var affectedPeriods = PayrollParameterRules.AffectedOpenPeriods(openMonths, request.EffectiveFrom, request.EffectiveTo);

        var dto = await GetTaxBracketAsync(id, ct);
        return dto with { AffectedOpenPeriods = affectedPeriods };
    }

    public async Task<TaxBracketDto> DeactivateTaxBracketAsync(Guid id, DeactivateParameterRequest request, CancellationToken ct)
    {
        await using var tx = await unitOfWork.BeginTransactionAsync(ct, IsolationLevel.Serializable);

        var entity = await repository.FindTaxBracketAsync(id, ct)
            ?? throw new AppException(404, "Không tìm thấy bậc thuế.");

        var lockedMonths = await repository.GetLockedMonthsAsync(ct);
        var (effFrom, effTo, newStatus) = PayrollParameterRules.ComputeDeactivation(
            entity.EffectiveFrom, entity.EffectiveTo, request.EffectiveTo, lockedMonths);

        var oldSnapshot = new { entity.EffectiveFrom, entity.EffectiveTo, entity.Status };
        entity.EffectiveFrom = effFrom;
        entity.EffectiveTo = effTo;
        entity.Status = newStatus;
        var newSnapshot = new { entity.EffectiveFrom, entity.EffectiveTo, entity.Status };
        auditHelper.Log("deactivate", "PayrollTaxBracket", id, oldSnapshot, newSnapshot);

        await SaveChangesWithDeadlockHandlingAsync(ct);
        await tx.CommitAsync(ct);

        var openMonths = await repository.GetOpenMonthsAsync(ct);
        var affectedPeriods = PayrollParameterRules.AffectedOpenPeriods(openMonths, effFrom, effTo);

        var dto = await GetTaxBracketAsync(id, ct);
        return dto with { AffectedOpenPeriods = affectedPeriods };
    }

    public Task<TaxDeductionPolicyDto> GetTaxDeductionPolicyAsync(CancellationToken ct)
        => repository.GetTaxDeductionPolicyAsync(ct);

    public Task<TaxPolicySummaryDto> GetTaxPolicySummaryAsync(CancellationToken ct)
        => repository.GetTaxPolicySummaryAsync(ct);

    public async Task<TaxPolicySummaryDto> UpdateTaxPolicyFlagsAsync(UpdateTaxPolicyFlagsRequest request, CancellationToken ct)
    {
        var oldSummary = await repository.GetTaxPolicySummaryAsync(ct);
        var oldSnapshot = new
        {
            oldSummary.DeductInsuranceBeforeTax,
            oldSummary.DeductUnionFeeBeforeTax,
            oldSummary.DeductOtherBeforeTax,
            oldSummary.FlatTaxBase
        };

        var newSummary = await repository.UpdateTaxPolicyFlagsAsync(request, Guid.Empty, ct);
        var newSnapshot = new
        {
            newSummary.DeductInsuranceBeforeTax,
            newSummary.DeductUnionFeeBeforeTax,
            newSummary.DeductOtherBeforeTax,
            newSummary.FlatTaxBase
        };

        auditHelper.Log("update", "TaxPolicyFlags", Guid.Empty, oldSnapshot, newSnapshot);
        await unitOfWork.SaveChangesAsync(ct);

        return newSummary;
    }

    public async Task<TaxCalculationResultDto> PreviewTaxCalculationAsync(TaxCalculationPreviewRequest request, CancellationToken ct)
    {
        var summary = await repository.GetTaxPolicySummaryAsync(ct);
        var today = PayrollParameterRules.TodayVn();

        // 1. Get active employee insurance rate
        var insurances = await repository.ListInsurancesAsync(new PayrollParameterFilter("active", today, null), ct);
        decimal employeeInsRate = insurances
            .Where(i => string.Equals(i.Payer, "employee", StringComparison.OrdinalIgnoreCase))
            .Sum(i => i.RatePercent);
        if (employeeInsRate <= 0m)
        {
            employeeInsRate = PayrollDefaults.EmployeeInsuranceRatePercent;
        }

        // 2. Get active union fee
        var rateConfigs = await repository.ListRateConfigsAsync(
            new PayrollRateConfigFilter("union_fee", null, null, "active", today, null), ct);
        // Only the clinic-wide union fee applies here; position/staff-specific configs are excluded.
        decimal unionFee = rateConfigs.FirstOrDefault(x => x.PositionId == null && x.StaffId == null)?.Value ?? PayrollDefaults.UnionFee;

        // 3. Map brackets
        var bracketItems = summary.Brackets
            .OrderBy(b => b.IncomeFrom)
            .Select((b, idx) => new TaxBracketItem(idx + 1, b.IncomeFrom, b.IncomeTo, b.TaxRatePercent))
            .ToList();

        var formulaInput = new PayrollFormulaInput(
            TotalIncome: request.TotalIncome,
            InsuranceSalary: request.InsuranceSalary,
            IsUnionMember: request.IsUnionMember,
            DependentCount: request.DependentCount,
            TaxMethod: request.TaxMethod ?? "progressive",
            OtherDeductions: request.OtherDeductions,
            InsuranceEmployeeRatePercent: employeeInsRate,
            UnionFeeFixed: unionFee,
            PersonalDeduction: summary.PersonalDeduction,
            DependentDeduction: summary.DependentDeduction,
            FlatThreshold: summary.TaxFlatThreshold,
            FlatRatePercent: summary.TaxFlatRate,
            RoundingUnit: summary.RoundingUnit,
            DeductInsuranceBeforeTax: summary.DeductInsuranceBeforeTax,
            DeductUnionFeeBeforeTax: summary.DeductUnionFeeBeforeTax,
            DeductOtherBeforeTax: summary.DeductOtherBeforeTax,
            FlatTaxBase: summary.FlatTaxBase,
            Brackets: bracketItems);

        var res = PayrollFormula.Calculate(formulaInput);

        return new TaxCalculationResultDto(
            TotalIncome: res.Step1_TotalIncome,
            BeforeTaxDeductions: res.Step2_BeforeTaxDeduction,
            InsuranceDeduction: res.Step2_InsuranceDeduction,
            UnionFeeDeduction: res.Step2_UnionFeeDeduction,
            OtherBeforeTaxDeduction: res.Step2_OtherBeforeTaxDeduction,
            IncomeAfterDeductions: res.Step3_IncomeAfterDeductions,
            TaxableIncome: res.Step4_TaxableIncome,
            PersonalDeductionAmount: res.Step4_PersonalDeductionAmount,
            DependentDeductionAmount: res.Step4_DependentDeductionAmount,
            TotalFamilyDeductions: res.Step4_TotalFamilyDeductions,
            TaxableIncomeNote: res.Step4_Note,
            PitTax: res.Step5_PitTax,
            TaxMethod: res.Step5_TaxMethod,
            BracketBreakdowns: res.Step5_BracketBreakdowns.Select(b => new TaxBracketBreakdownDto(
                b.BracketIndex, b.RangeText, b.TaxableAmount, b.RatePercent, b.TaxAmount)).ToList(),
            TaxNote: res.Step5_Note,
            TakeHome: res.Step6_TakeHome,
            TakeHomeRaw: res.Step6_TakeHomeRaw,
            RoundingUnit: res.Step6_RoundingUnit);
    }

    // =========================================================================
    // Payroll Rate Configs
    // =========================================================================

    public Task<PayrollRateConfigDto[]> ListRateConfigsAsync(PayrollRateConfigFilter filter, CancellationToken ct)
        => repository.ListRateConfigsAsync(filter, ct);

    public async Task<PayrollRateConfigDto> GetRateConfigAsync(Guid id, CancellationToken ct)
    {
        var filter = new PayrollRateConfigFilter(null, null, null, null, null, null);
        var all = await repository.ListRateConfigsAsync(filter, ct);
        var match = all.FirstOrDefault(x => x.Id == id)
            ?? throw new AppException(404, "Không tìm thấy tham số trực / công đoàn.");
        return match;
    }

    public async Task<PayrollRateConfigDto> CreateRateConfigAsync(SavePayrollRateConfigRequest request, Guid? creatorId, CancellationToken ct)
    {
        var code = PayrollParameterRules.RequireOption(request.Code, PayrollParameterRules.RateConfigCodes, "Mã tham số trực/công");
        var unit = PayrollParameterRules.RequireOption(request.Unit, PayrollParameterRules.RateConfigUnits, "Đơn vị tính");
        PayrollParameterRules.EnsureTypedValue(unit == "percent" ? "percent" : "fixed", request.Value, "Giá trị tham số");
        PayrollParameterRules.EnsureEffectiveRange(request.EffectiveFrom, request.EffectiveTo);
        var status = PayrollParameterRules.NormalizeStatus(request.Status);

        if (request.PositionId.HasValue && !await repository.PositionExistsAndActiveAsync(request.PositionId.Value, ct))
        {
            throw new AppException(404, "Chức danh không tồn tại hoặc đã ngừng hoạt động.");
        }

        if (request.StaffId.HasValue && !await repository.StaffExistsAndActiveAsync(request.StaffId.Value, ct))
        {
            throw new AppException(404, "Nhân viên không tồn tại hoặc đã ngừng hoạt động.");
        }

        await using var tx = await unitOfWork.BeginTransactionAsync(ct, IsolationLevel.Serializable);

        var lockedMonths = await repository.GetLockedMonthsAsync(ct);
        PayrollParameterRules.EnsureLockedPeriodRule(
            lockedMonths, null, new LockedPeriodState(request.EffectiveFrom, request.EffectiveTo, status), true);

        if (status == PayrollParameterRules.Active)
        {
            var existing = await repository.GetOverlappingRateConfigsAsync(code, request.PositionId, request.StaffId, request.EffectiveFrom, request.EffectiveTo, null, ct);
            foreach (var ex in existing)
            {
                if (PayrollParameterRules.PeriodsOverlap(request.EffectiveFrom, request.EffectiveTo, ex.EffectiveFrom, ex.EffectiveTo))
                {
                    throw new AppException(409, $"Đã có tham số '{code}' trùng lặp thời gian hiệu lực ({ex.EffectiveFrom:dd/MM/yyyy} - {ex.EffectiveTo:dd/MM/yyyy}).");
                }
            }
        }

        var entity = new PayrollRateConfig
        {
            ConfigId = Guid.NewGuid(),
            Code = code,
            PositionId = request.PositionId,
            StaffId = request.StaffId,
            Value = request.Value,
            Unit = unit,
            Description = request.Description,
            EffectiveFrom = request.EffectiveFrom,
            EffectiveTo = request.EffectiveTo,
            Status = status,
            CreatedBy = creatorId,
            CreatedAt = DateTime.UtcNow
        };

        repository.AddRateConfig(entity);

        var newSnapshot = new
        {
            entity.Code,
            entity.PositionId,
            entity.StaffId,
            entity.Value,
            entity.Unit,
            entity.Description,
            entity.EffectiveFrom,
            entity.EffectiveTo,
            entity.Status
        };
        auditHelper.Log("create", "PayrollRateConfig", entity.ConfigId, null, newSnapshot);

        await SaveChangesWithDeadlockHandlingAsync(ct);
        await tx.CommitAsync(ct);

        var openMonths = await repository.GetOpenMonthsAsync(ct);
        var affectedPeriods = PayrollParameterRules.AffectedOpenPeriods(openMonths, request.EffectiveFrom, request.EffectiveTo);

        var dto = await GetRateConfigAsync(entity.ConfigId, ct);
        return dto with { AffectedOpenPeriods = affectedPeriods };
    }

    public async Task<PayrollRateConfigDto> UpdateRateConfigAsync(Guid id, SavePayrollRateConfigRequest request, CancellationToken ct)
    {
        await using var tx = await unitOfWork.BeginTransactionAsync(ct, IsolationLevel.Serializable);

        var entity = await repository.FindRateConfigAsync(id, ct)
            ?? throw new AppException(404, "Không tìm thấy tham số trực / công đoàn.");

        var code = PayrollParameterRules.RequireOption(request.Code, PayrollParameterRules.RateConfigCodes, "Mã tham số trực/công");
        var unit = PayrollParameterRules.RequireOption(request.Unit, PayrollParameterRules.RateConfigUnits, "Đơn vị tính");
        PayrollParameterRules.EnsureTypedValue(unit == "percent" ? "percent" : "fixed", request.Value, "Giá trị tham số");
        PayrollParameterRules.EnsureEffectiveRange(request.EffectiveFrom, request.EffectiveTo);
        var status = PayrollParameterRules.NormalizeStatus(request.Status);

        if (request.PositionId.HasValue && !await repository.PositionExistsAndActiveAsync(request.PositionId.Value, ct))
        {
            throw new AppException(404, "Chức danh không tồn tại hoặc đã ngừng hoạt động.");
        }

        if (request.StaffId.HasValue && !await repository.StaffExistsAndActiveAsync(request.StaffId.Value, ct))
        {
            throw new AppException(404, "Nhân viên không tồn tại hoặc đã ngừng hoạt động.");
        }

        bool valuesChanged = entity.Code != code
            || entity.PositionId != request.PositionId
            || entity.StaffId != request.StaffId
            || entity.Value != request.Value
            || entity.Unit != unit
            || entity.Description != request.Description;

        var lockedMonths = await repository.GetLockedMonthsAsync(ct);
        PayrollParameterRules.EnsureLockedPeriodRule(
            lockedMonths,
            new LockedPeriodState(entity.EffectiveFrom, entity.EffectiveTo, entity.Status ?? "active"),
            new LockedPeriodState(request.EffectiveFrom, request.EffectiveTo, status),
            valuesChanged);

        if (status == PayrollParameterRules.Active)
        {
            var existing = await repository.GetOverlappingRateConfigsAsync(code, request.PositionId, request.StaffId, request.EffectiveFrom, request.EffectiveTo, id, ct);
            foreach (var ex in existing)
            {
                if (PayrollParameterRules.PeriodsOverlap(request.EffectiveFrom, request.EffectiveTo, ex.EffectiveFrom, ex.EffectiveTo))
                {
                    throw new AppException(409, $"Đã có tham số '{code}' trùng lặp thời gian hiệu lực ({ex.EffectiveFrom:dd/MM/yyyy} - {ex.EffectiveTo:dd/MM/yyyy}).");
                }
            }
        }

        var oldSnapshot = new
        {
            entity.Code,
            entity.PositionId,
            entity.StaffId,
            entity.Value,
            entity.Unit,
            entity.Description,
            entity.EffectiveFrom,
            entity.EffectiveTo,
            entity.Status
        };

        entity.Code = code;
        entity.PositionId = request.PositionId;
        entity.StaffId = request.StaffId;
        entity.Value = request.Value;
        entity.Unit = unit;
        entity.Description = request.Description;
        entity.EffectiveFrom = request.EffectiveFrom;
        entity.EffectiveTo = request.EffectiveTo;
        entity.Status = status;

        var newSnapshot = new
        {
            entity.Code,
            entity.PositionId,
            entity.StaffId,
            entity.Value,
            entity.Unit,
            entity.Description,
            entity.EffectiveFrom,
            entity.EffectiveTo,
            entity.Status
        };
        auditHelper.Log("update", "PayrollRateConfig", id, oldSnapshot, newSnapshot);

        await SaveChangesWithDeadlockHandlingAsync(ct);
        await tx.CommitAsync(ct);

        var openMonths = await repository.GetOpenMonthsAsync(ct);
        var affectedPeriods = PayrollParameterRules.AffectedOpenPeriods(openMonths, request.EffectiveFrom, request.EffectiveTo);

        var dto = await GetRateConfigAsync(id, ct);
        return dto with { AffectedOpenPeriods = affectedPeriods };
    }

    public async Task<PayrollRateConfigDto> DeactivateRateConfigAsync(Guid id, DeactivateParameterRequest request, CancellationToken ct)
    {
        await using var tx = await unitOfWork.BeginTransactionAsync(ct, IsolationLevel.Serializable);

        var entity = await repository.FindRateConfigAsync(id, ct)
            ?? throw new AppException(404, "Không tìm thấy tham số trực / công đoàn.");

        var lockedMonths = await repository.GetLockedMonthsAsync(ct);
        var (effFrom, effTo, newStatus) = PayrollParameterRules.ComputeDeactivation(
            entity.EffectiveFrom, entity.EffectiveTo, request.EffectiveTo, lockedMonths);

        var oldSnapshot = new { entity.EffectiveFrom, entity.EffectiveTo, entity.Status };
        entity.EffectiveFrom = effFrom;
        entity.EffectiveTo = effTo;
        entity.Status = newStatus;
        var newSnapshot = new { entity.EffectiveFrom, entity.EffectiveTo, entity.Status };
        auditHelper.Log("deactivate", "PayrollRateConfig", id, oldSnapshot, newSnapshot);

        await SaveChangesWithDeadlockHandlingAsync(ct);
        await tx.CommitAsync(ct);

        var openMonths = await repository.GetOpenMonthsAsync(ct);
        var affectedPeriods = PayrollParameterRules.AffectedOpenPeriods(openMonths, effFrom, effTo);

        var dto = await GetRateConfigAsync(id, ct);
        return dto with { AffectedOpenPeriods = affectedPeriods };
    }

    // =========================================================================
    // Commission Rules
    // =========================================================================

    public Task<CommissionRuleDto[]> ListCommissionRulesAsync(CommissionRuleFilter filter, CancellationToken ct)
        => repository.ListCommissionRulesAsync(filter, ct);

    public async Task<CommissionRuleDto> GetCommissionRuleAsync(Guid id, CancellationToken ct)
    {
        var filter = new CommissionRuleFilter(null, null, null, null, null, null, null, null);
        var all = await repository.ListCommissionRulesAsync(filter, ct);
        var match = all.FirstOrDefault(x => x.Id == id)
            ?? throw new AppException(404, "Không tìm thấy quy tắc hoa hồng.");
        return match;
    }

    public async Task<CommissionRuleDto> CreateCommissionRuleAsync(SaveCommissionRuleRequest request, Guid? creatorId, CancellationToken ct)
    {
        if (!request.ServiceId.HasValue && string.IsNullOrWhiteSpace(request.ServiceCategory))
        {
            throw new AppException(400, "Quy tắc hoa hồng phải áp dụng cho một dịch vụ cụ thể hoặc theo nhóm dịch vụ.");
        }

        var role = PayrollParameterRules.RequireOption(request.Role, PayrollParameterRules.CommissionRoles, "Vai trò thực hiện");
        var valueType = PayrollParameterRules.RequireOption(request.ValueType, PayrollParameterRules.CommissionValueTypes, "Loại hoa hồng");
        var timeCondition = PayrollParameterRules.RequireOption(request.TimeCondition ?? "all", PayrollParameterRules.TimeConditions, "Điều kiện thời gian");
        PayrollParameterRules.EnsureTypedValue(valueType == "fixed" || valueType == "per_hour" ? "fixed" : "percentage", request.CommissionValue, "Mức hoa hồng");
        PayrollParameterRules.EnsureEffectiveRange(request.EffectiveFrom, request.EffectiveTo);
        var status = PayrollParameterRules.NormalizeStatus(request.Status);

        if (request.ServiceId.HasValue && !await repository.ServiceExistsAndActiveAsync(request.ServiceId.Value, ct))
        {
            throw new AppException(404, "Dịch vụ thủ thuật không tồn tại hoặc đã ngừng hoạt động.");
        }

        if (request.PositionId.HasValue && !await repository.PositionExistsAndActiveAsync(request.PositionId.Value, ct))
        {
            throw new AppException(404, "Chức danh áp dụng không tồn tại hoặc đã ngừng hoạt động.");
        }

        await using var tx = await unitOfWork.BeginTransactionAsync(ct, IsolationLevel.Serializable);

        var lockedMonths = await repository.GetLockedMonthsAsync(ct);
        PayrollParameterRules.EnsureLockedPeriodRule(
            lockedMonths, null, new LockedPeriodState(request.EffectiveFrom, request.EffectiveTo, status), true);

        if (status == PayrollParameterRules.Active)
        {
            var existing = await repository.GetOverlappingCommissionRulesAsync(
                request.ServiceId, request.ServiceCategory, role, request.PositionId, timeCondition, request.EffectiveFrom, request.EffectiveTo, null, ct);
            foreach (var ex in existing)
            {
                if (PayrollParameterRules.PeriodsOverlap(request.EffectiveFrom, request.EffectiveTo, ex.EffectiveFrom, ex.EffectiveTo))
                {
                    throw new AppException(409, $"Đã có quy tắc hoa hồng cho vai trò '{role}' trùng lặp thời gian hiệu lực ({ex.EffectiveFrom:dd/MM/yyyy} - {ex.EffectiveTo:dd/MM/yyyy}).");
                }
            }
        }

        var entity = new CommissionRule
        {
            RuleId = Guid.NewGuid(),
            ServiceId = request.ServiceId,
            ServiceCategory = request.ServiceCategory,
            PositionId = request.PositionId,
            Role = role,
            TimeCondition = timeCondition,
            ValueType = valueType,
            CommissionValue = request.CommissionValue,
            EffectiveFrom = request.EffectiveFrom,
            EffectiveTo = request.EffectiveTo,
            Status = status,
            CreatedBy = creatorId,
            CreatedAt = DateTime.UtcNow
        };

        repository.AddCommissionRule(entity);

        var newSnapshot = new
        {
            entity.ServiceId,
            entity.ServiceCategory,
            entity.PositionId,
            entity.Role,
            entity.TimeCondition,
            entity.ValueType,
            entity.CommissionValue,
            entity.EffectiveFrom,
            entity.EffectiveTo,
            entity.Status
        };
        auditHelper.Log("create", "CommissionRule", entity.RuleId, null, newSnapshot);

        await SaveChangesWithDeadlockHandlingAsync(ct);
        await tx.CommitAsync(ct);

        var openMonths = await repository.GetOpenMonthsAsync(ct);
        var affectedPeriods = PayrollParameterRules.AffectedOpenPeriods(openMonths, request.EffectiveFrom, request.EffectiveTo);

        var dto = await GetCommissionRuleAsync(entity.RuleId, ct);
        return dto with { AffectedOpenPeriods = affectedPeriods };
    }

    public async Task<CommissionRuleDto> UpdateCommissionRuleAsync(Guid id, SaveCommissionRuleRequest request, CancellationToken ct)
    {
        await using var tx = await unitOfWork.BeginTransactionAsync(ct, IsolationLevel.Serializable);

        var entity = await repository.FindCommissionRuleAsync(id, ct)
            ?? throw new AppException(404, "Không tìm thấy quy tắc hoa hồng.");

        if (!request.ServiceId.HasValue && string.IsNullOrWhiteSpace(request.ServiceCategory))
        {
            throw new AppException(400, "Quy tắc hoa hồng phải áp dụng cho một dịch vụ cụ thể hoặc theo nhóm dịch vụ.");
        }

        var role = PayrollParameterRules.RequireOption(request.Role, PayrollParameterRules.CommissionRoles, "Vai trò thực hiện");
        var valueType = PayrollParameterRules.RequireOption(request.ValueType, PayrollParameterRules.CommissionValueTypes, "Loại hoa hồng");
        var timeCondition = PayrollParameterRules.RequireOption(request.TimeCondition ?? "all", PayrollParameterRules.TimeConditions, "Điều kiện thời gian");
        PayrollParameterRules.EnsureTypedValue(valueType == "fixed" || valueType == "per_hour" ? "fixed" : "percentage", request.CommissionValue, "Mức hoa hồng");
        PayrollParameterRules.EnsureEffectiveRange(request.EffectiveFrom, request.EffectiveTo);
        var status = PayrollParameterRules.NormalizeStatus(request.Status);

        if (request.ServiceId.HasValue && entity.ServiceId != request.ServiceId && !await repository.ServiceExistsAndActiveAsync(request.ServiceId.Value, ct))
        {
            throw new AppException(404, "Dịch vụ thủ thuật không tồn tại hoặc đã ngừng hoạt động.");
        }

        if (request.PositionId.HasValue && entity.PositionId != request.PositionId && !await repository.PositionExistsAndActiveAsync(request.PositionId.Value, ct))
        {
            throw new AppException(404, "Chức danh áp dụng không tồn tại hoặc đã ngừng hoạt động.");
        }

        bool valuesChanged = entity.ServiceId != request.ServiceId
            || entity.ServiceCategory != request.ServiceCategory
            || entity.PositionId != request.PositionId
            || entity.Role != role
            || (entity.TimeCondition ?? "all") != timeCondition
            || entity.ValueType != valueType
            || entity.CommissionValue != request.CommissionValue;

        var lockedMonths = await repository.GetLockedMonthsAsync(ct);
        PayrollParameterRules.EnsureLockedPeriodRule(
            lockedMonths,
            new LockedPeriodState(entity.EffectiveFrom, entity.EffectiveTo, entity.Status ?? "active"),
            new LockedPeriodState(request.EffectiveFrom, request.EffectiveTo, status),
            valuesChanged);

        if (status == PayrollParameterRules.Active)
        {
            var existing = await repository.GetOverlappingCommissionRulesAsync(
                request.ServiceId, request.ServiceCategory, role, request.PositionId, timeCondition, request.EffectiveFrom, request.EffectiveTo, id, ct);
            foreach (var ex in existing)
            {
                if (PayrollParameterRules.PeriodsOverlap(request.EffectiveFrom, request.EffectiveTo, ex.EffectiveFrom, ex.EffectiveTo))
                {
                    throw new AppException(409, $"Đã có quy tắc hoa hồng cho vai trò '{role}' trùng lặp thời gian hiệu lực ({ex.EffectiveFrom:dd/MM/yyyy} - {ex.EffectiveTo:dd/MM/yyyy}).");
                }
            }
        }

        var oldSnapshot = new
        {
            entity.ServiceId,
            entity.ServiceCategory,
            entity.PositionId,
            entity.Role,
            entity.TimeCondition,
            entity.ValueType,
            entity.CommissionValue,
            entity.EffectiveFrom,
            entity.EffectiveTo,
            entity.Status
        };

        entity.ServiceId = request.ServiceId;
        entity.ServiceCategory = request.ServiceCategory;
        entity.PositionId = request.PositionId;
        entity.Role = role;
        entity.TimeCondition = timeCondition;
        entity.ValueType = valueType;
        entity.CommissionValue = request.CommissionValue;
        entity.EffectiveFrom = request.EffectiveFrom;
        entity.EffectiveTo = request.EffectiveTo;
        entity.Status = status;

        var newSnapshot = new
        {
            entity.ServiceId,
            entity.ServiceCategory,
            entity.PositionId,
            entity.Role,
            entity.TimeCondition,
            entity.ValueType,
            entity.CommissionValue,
            entity.EffectiveFrom,
            entity.EffectiveTo,
            entity.Status
        };
        auditHelper.Log("update", "CommissionRule", id, oldSnapshot, newSnapshot);

        await SaveChangesWithDeadlockHandlingAsync(ct);
        await tx.CommitAsync(ct);

        var openMonths = await repository.GetOpenMonthsAsync(ct);
        var affectedPeriods = PayrollParameterRules.AffectedOpenPeriods(openMonths, request.EffectiveFrom, request.EffectiveTo);

        var dto = await GetCommissionRuleAsync(id, ct);
        return dto with { AffectedOpenPeriods = affectedPeriods };
    }

    public async Task<CommissionRuleDto> DeactivateCommissionRuleAsync(Guid id, DeactivateParameterRequest request, CancellationToken ct)
    {
        await using var tx = await unitOfWork.BeginTransactionAsync(ct, IsolationLevel.Serializable);

        var entity = await repository.FindCommissionRuleAsync(id, ct)
            ?? throw new AppException(404, "Không tìm thấy quy tắc hoa hồng.");

        var lockedMonths = await repository.GetLockedMonthsAsync(ct);
        var (effFrom, effTo, newStatus) = PayrollParameterRules.ComputeDeactivation(
            entity.EffectiveFrom, entity.EffectiveTo, request.EffectiveTo, lockedMonths);

        var oldSnapshot = new { entity.EffectiveFrom, entity.EffectiveTo, entity.Status };
        entity.EffectiveFrom = effFrom;
        entity.EffectiveTo = effTo;
        entity.Status = newStatus;
        var newSnapshot = new { entity.EffectiveFrom, entity.EffectiveTo, entity.Status };
        auditHelper.Log("deactivate", "CommissionRule", id, oldSnapshot, newSnapshot);

        await SaveChangesWithDeadlockHandlingAsync(ct);
        await tx.CommitAsync(ct);

        var openMonths = await repository.GetOpenMonthsAsync(ct);
        var affectedPeriods = PayrollParameterRules.AffectedOpenPeriods(openMonths, effFrom, effTo);

        var dto = await GetCommissionRuleAsync(id, ct);
        return dto with { AffectedOpenPeriods = affectedPeriods };
    }

    public Task<CommissionMatrixDto> GetCommissionMatrixAsync(CancellationToken ct)
        => repository.GetCommissionMatrixAsync(ct);

    public Task<ProcedureServiceOptionDto[]> ListActiveProcedureServicesAsync(CancellationToken ct)
        => repository.ListActiveProcedureServicesAsync(ct);

    // =========================================================================
    // Staff Commission Overrides
    // =========================================================================

    public Task<StaffCommissionOverrideDto[]> ListStaffCommissionOverridesAsync(StaffCommissionOverrideFilter filter, CancellationToken ct)
        => repository.ListStaffCommissionOverridesAsync(filter, ct);

    public async Task<StaffCommissionOverrideDto> GetStaffCommissionOverrideAsync(Guid id, CancellationToken ct)
    {
        var filter = new StaffCommissionOverrideFilter(null, null, null, null, null, null, null);
        var all = await repository.ListStaffCommissionOverridesAsync(filter, ct);
        var match = all.FirstOrDefault(x => x.Id == id)
            ?? throw new AppException(404, "Không tìm thấy hoa hồng riêng của nhân viên.");
        return match;
    }

    public async Task<StaffCommissionOverrideDto> CreateStaffCommissionOverrideAsync(SaveStaffCommissionOverrideRequest request, Guid? creatorId, CancellationToken ct)
    {
        if (!request.ServiceId.HasValue && string.IsNullOrWhiteSpace(request.ServiceCategory))
        {
            throw new AppException(400, "Đơn giá hoa hồng riêng phải áp dụng cho một dịch vụ cụ thể hoặc theo nhóm dịch vụ.");
        }

        if (!await repository.StaffExistsAndActiveAsync(request.StaffId, ct))
        {
            throw new AppException(404, "Nhân viên không tồn tại hoặc đã ngừng hoạt động.");
        }

        if (request.ServiceId.HasValue && !await repository.ServiceExistsAndActiveAsync(request.ServiceId.Value, ct))
        {
            throw new AppException(404, "Dịch vụ thủ thuật không tồn tại hoặc đã ngừng hoạt động.");
        }

        var role = PayrollParameterRules.RequireOption(request.Role, PayrollParameterRules.CommissionRoles, "Vai trò thực hiện");
        var valueType = PayrollParameterRules.RequireOption(request.ValueType, PayrollParameterRules.CommissionValueTypes, "Loại hoa hồng");
        var timeCondition = PayrollParameterRules.RequireOption(request.TimeCondition ?? "all", PayrollParameterRules.TimeConditions, "Điều kiện thời gian");
        PayrollParameterRules.EnsureTypedValue(valueType == "fixed" || valueType == "per_hour" ? "fixed" : "percentage", request.CommissionValue, "Mức hoa hồng");
        PayrollParameterRules.EnsureEffectiveRange(request.EffectiveFrom, request.EffectiveTo);
        var status = PayrollParameterRules.NormalizeStatus(request.Status);

        await using var tx = await unitOfWork.BeginTransactionAsync(ct, IsolationLevel.Serializable);

        var lockedMonths = await repository.GetLockedMonthsAsync(ct);
        PayrollParameterRules.EnsureLockedPeriodRule(
            lockedMonths, null, new LockedPeriodState(request.EffectiveFrom, request.EffectiveTo, status), true);

        if (status == PayrollParameterRules.Active)
        {
            var existing = await repository.GetOverlappingStaffCommissionOverridesAsync(
                request.StaffId, request.ServiceId, request.ServiceCategory, role, timeCondition, request.EffectiveFrom, request.EffectiveTo, null, ct);
            foreach (var ex in existing)
            {
                if (PayrollParameterRules.PeriodsOverlap(request.EffectiveFrom, request.EffectiveTo, ex.EffectiveFrom, ex.EffectiveTo))
                {
                    throw new AppException(409, $"Nhân viên đã có đơn giá hoa hồng riêng cho vai trò '{role}' trùng lặp thời gian hiệu lực ({ex.EffectiveFrom:dd/MM/yyyy} - {ex.EffectiveTo:dd/MM/yyyy}).");
                }
            }
        }

        var entity = new StaffCommissionOverride
        {
            OverrideId = Guid.NewGuid(),
            StaffId = request.StaffId,
            ServiceId = request.ServiceId,
            ServiceCategory = request.ServiceCategory,
            Role = role,
            TimeCondition = timeCondition,
            ValueType = valueType,
            CommissionValue = request.CommissionValue,
            EffectiveFrom = request.EffectiveFrom,
            EffectiveTo = request.EffectiveTo,
            Status = status,
            CreatedBy = creatorId,
            CreatedAt = DateTime.UtcNow
        };

        repository.AddStaffCommissionOverride(entity);

        var newSnapshot = new
        {
            entity.StaffId,
            entity.ServiceId,
            entity.ServiceCategory,
            entity.Role,
            entity.TimeCondition,
            entity.ValueType,
            entity.CommissionValue,
            entity.EffectiveFrom,
            entity.EffectiveTo,
            entity.Status
        };
        auditHelper.Log("create", "StaffCommissionOverride", entity.OverrideId, null, newSnapshot);

        await SaveChangesWithDeadlockHandlingAsync(ct);
        await tx.CommitAsync(ct);

        var openMonths = await repository.GetOpenMonthsAsync(ct);
        var affectedPeriods = PayrollParameterRules.AffectedOpenPeriods(openMonths, request.EffectiveFrom, request.EffectiveTo);

        var dto = await GetStaffCommissionOverrideAsync(entity.OverrideId, ct);
        return dto with { AffectedOpenPeriods = affectedPeriods };
    }

    public async Task<StaffCommissionOverrideDto> UpdateStaffCommissionOverrideAsync(Guid id, SaveStaffCommissionOverrideRequest request, CancellationToken ct)
    {
        await using var tx = await unitOfWork.BeginTransactionAsync(ct, IsolationLevel.Serializable);

        var entity = await repository.FindStaffCommissionOverrideAsync(id, ct)
            ?? throw new AppException(404, "Không tìm thấy hoa hồng riêng của nhân viên.");

        if (!request.ServiceId.HasValue && string.IsNullOrWhiteSpace(request.ServiceCategory))
        {
            throw new AppException(400, "Đơn giá hoa hồng riêng phải áp dụng cho một dịch vụ cụ thể hoặc theo nhóm dịch vụ.");
        }

        if (entity.StaffId != request.StaffId && !await repository.StaffExistsAndActiveAsync(request.StaffId, ct))
        {
            throw new AppException(404, "Nhân viên không tồn tại hoặc đã ngừng hoạt động.");
        }

        if (request.ServiceId.HasValue && entity.ServiceId != request.ServiceId && !await repository.ServiceExistsAndActiveAsync(request.ServiceId.Value, ct))
        {
            throw new AppException(404, "Dịch vụ thủ thuật không tồn tại hoặc đã ngừng hoạt động.");
        }

        var role = PayrollParameterRules.RequireOption(request.Role, PayrollParameterRules.CommissionRoles, "Vai trò thực hiện");
        var valueType = PayrollParameterRules.RequireOption(request.ValueType, PayrollParameterRules.CommissionValueTypes, "Loại hoa hồng");
        var timeCondition = PayrollParameterRules.RequireOption(request.TimeCondition ?? "all", PayrollParameterRules.TimeConditions, "Điều kiện thời gian");
        PayrollParameterRules.EnsureTypedValue(valueType == "fixed" || valueType == "per_hour" ? "fixed" : "percentage", request.CommissionValue, "Mức hoa hồng");
        PayrollParameterRules.EnsureEffectiveRange(request.EffectiveFrom, request.EffectiveTo);
        var status = PayrollParameterRules.NormalizeStatus(request.Status);

        bool valuesChanged = entity.StaffId != request.StaffId
            || entity.ServiceId != request.ServiceId
            || entity.ServiceCategory != request.ServiceCategory
            || entity.Role != role
            || (entity.TimeCondition ?? "all") != timeCondition
            || entity.ValueType != valueType
            || entity.CommissionValue != request.CommissionValue;

        var lockedMonths = await repository.GetLockedMonthsAsync(ct);
        PayrollParameterRules.EnsureLockedPeriodRule(
            lockedMonths,
            new LockedPeriodState(entity.EffectiveFrom, entity.EffectiveTo, entity.Status ?? "active"),
            new LockedPeriodState(request.EffectiveFrom, request.EffectiveTo, status),
            valuesChanged);

        if (status == PayrollParameterRules.Active)
        {
            var existing = await repository.GetOverlappingStaffCommissionOverridesAsync(
                request.StaffId, request.ServiceId, request.ServiceCategory, role, timeCondition, request.EffectiveFrom, request.EffectiveTo, id, ct);
            foreach (var ex in existing)
            {
                if (PayrollParameterRules.PeriodsOverlap(request.EffectiveFrom, request.EffectiveTo, ex.EffectiveFrom, ex.EffectiveTo))
                {
                    throw new AppException(409, $"Nhân viên đã có đơn giá hoa hồng riêng cho vai trò '{role}' trùng lặp thời gian hiệu lực ({ex.EffectiveFrom:dd/MM/yyyy} - {ex.EffectiveTo:dd/MM/yyyy}).");
                }
            }
        }

        var oldSnapshot = new
        {
            entity.StaffId,
            entity.ServiceId,
            entity.ServiceCategory,
            entity.Role,
            entity.TimeCondition,
            entity.ValueType,
            entity.CommissionValue,
            entity.EffectiveFrom,
            entity.EffectiveTo,
            entity.Status
        };

        entity.StaffId = request.StaffId;
        entity.ServiceId = request.ServiceId;
        entity.ServiceCategory = request.ServiceCategory;
        entity.Role = role;
        entity.TimeCondition = timeCondition;
        entity.ValueType = valueType;
        entity.CommissionValue = request.CommissionValue;
        entity.EffectiveFrom = request.EffectiveFrom;
        entity.EffectiveTo = request.EffectiveTo;
        entity.Status = status;

        var newSnapshot = new
        {
            entity.StaffId,
            entity.ServiceId,
            entity.ServiceCategory,
            entity.Role,
            entity.TimeCondition,
            entity.ValueType,
            entity.CommissionValue,
            entity.EffectiveFrom,
            entity.EffectiveTo,
            entity.Status
        };
        auditHelper.Log("update", "StaffCommissionOverride", id, oldSnapshot, newSnapshot);

        await SaveChangesWithDeadlockHandlingAsync(ct);
        await tx.CommitAsync(ct);

        var openMonths = await repository.GetOpenMonthsAsync(ct);
        var affectedPeriods = PayrollParameterRules.AffectedOpenPeriods(openMonths, request.EffectiveFrom, request.EffectiveTo);

        var dto = await GetStaffCommissionOverrideAsync(id, ct);
        return dto with { AffectedOpenPeriods = affectedPeriods };
    }

    public async Task<StaffCommissionOverrideDto> DeactivateStaffCommissionOverrideAsync(Guid id, DeactivateParameterRequest request, CancellationToken ct)
    {
        await using var tx = await unitOfWork.BeginTransactionAsync(ct, IsolationLevel.Serializable);

        var entity = await repository.FindStaffCommissionOverrideAsync(id, ct)
            ?? throw new AppException(404, "Không tìm thấy hoa hồng riêng của nhân viên.");

        var lockedMonths = await repository.GetLockedMonthsAsync(ct);
        var (effFrom, effTo, newStatus) = PayrollParameterRules.ComputeDeactivation(
            entity.EffectiveFrom, entity.EffectiveTo, request.EffectiveTo, lockedMonths);

        var oldSnapshot = new { entity.EffectiveFrom, entity.EffectiveTo, entity.Status };
        entity.EffectiveFrom = effFrom;
        entity.EffectiveTo = effTo;
        entity.Status = newStatus;
        var newSnapshot = new { entity.EffectiveFrom, entity.EffectiveTo, entity.Status };
        auditHelper.Log("deactivate", "StaffCommissionOverride", id, oldSnapshot, newSnapshot);

        await SaveChangesWithDeadlockHandlingAsync(ct);
        await tx.CommitAsync(ct);

        var openMonths = await repository.GetOpenMonthsAsync(ct);
        var affectedPeriods = PayrollParameterRules.AffectedOpenPeriods(openMonths, effFrom, effTo);

        var dto = await GetStaffCommissionOverrideAsync(id, ct);
        return dto with { AffectedOpenPeriods = affectedPeriods };
    }

    // =========================================================================
    // Lookups
    // =========================================================================

    public Task<PositionOptionDto[]> ListPositionsAsync(CancellationToken ct)
        => repository.ListPositionsAsync(ct);

    public Task<SiteOptionDto[]> ListSitesAsync(CancellationToken ct)
        => repository.ListSitesAsync(ct);

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
