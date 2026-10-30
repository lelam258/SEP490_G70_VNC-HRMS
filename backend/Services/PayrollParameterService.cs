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
    // ---------- Allowances ----------

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
        var status = PayrollParameterRules.NormalizeStatus(request.Status);
        var appliesTo = PayrollParameterRules.OptionalText(request.AppliesTo, "Đối tượng áp dụng", 50, "all");

        if (request.DefaultValue.HasValue)
        {
            PayrollParameterRules.EnsureTypedValue(valueType, request.DefaultValue.Value, "Giá trị mặc định");
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
            entity.IsTaxable,
            entity.IsInsuranceBasis,
            entity.Status
        };
        auditHelper.Log("create", "AllowanceType", entity.AllowanceId, null, newSnapshot);

        await SaveChangesWithDeadlockHandlingAsync(ct);
        await tx.CommitAsync(ct);

        var openMonths = await repository.GetOpenMonthsAsync(ct);
        var affectedPeriods = PayrollParameterRules.AffectedOpenPeriods(openMonths, null, null);

        var dto = await GetAllowanceAsync(entity.AllowanceId, ct);
        return dto with { AffectedOpenPeriods = affectedPeriods };
    }

    public async Task<AllowanceTypeDto> UpdateAllowanceAsync(Guid id, SaveAllowanceTypeRequest request, CancellationToken ct)
    {
        await using var tx = await unitOfWork.BeginTransactionAsync(ct, IsolationLevel.Serializable);

        var entity = await repository.FindAllowanceAsync(id, ct)
            ?? throw new AppException(404, "Không tìm thấy loại phụ cấp.");

        var code = PayrollParameterRules.NormalizeCode(request.Code);
        var name = PayrollParameterRules.RequireText(request.Name, "Tên loại phụ cấp", 100);
        var valueType = PayrollParameterRules.RequireOption(request.ValueType, PayrollParameterRules.AllowanceValueTypes, "Loại giá trị");
        var status = PayrollParameterRules.NormalizeStatus(request.Status);
        var appliesTo = PayrollParameterRules.OptionalText(request.AppliesTo, "Đối tượng áp dụng", 50, "all");

        if (request.DefaultValue.HasValue)
        {
            PayrollParameterRules.EnsureTypedValue(valueType, request.DefaultValue.Value, "Giá trị mặc định");
        }

        if (await repository.AllowanceCodeExistsAsync(code, id, ct))
        {
            throw new AppException(409, $"Mã phụ cấp '{code}' đã tồn tại.");
        }

        var oldSnapshot = new
        {
            entity.Code,
            entity.Name,
            entity.ValueType,
            entity.DefaultValue,
            entity.AppliesTo,
            entity.IsTaxable,
            entity.IsInsuranceBasis,
            entity.Status
        };

        entity.Code = code;
        entity.Name = name;
        entity.ValueType = valueType;
        entity.DefaultValue = request.DefaultValue;
        entity.AppliesTo = appliesTo;
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
            entity.IsTaxable,
            entity.IsInsuranceBasis,
            entity.Status
        };
        auditHelper.Log("update", "AllowanceType", id, oldSnapshot, newSnapshot);

        await SaveChangesWithDeadlockHandlingAsync(ct);
        await tx.CommitAsync(ct);

        var openMonths = await repository.GetOpenMonthsAsync(ct);
        var affectedPeriods = PayrollParameterRules.AffectedOpenPeriods(openMonths, null, null);

        var dto = await GetAllowanceAsync(id, ct);
        return dto with { AffectedOpenPeriods = affectedPeriods };
    }

    // ---------- Insurances ----------

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
        var type = PayrollParameterRules.RequireOption(request.InsuranceType, PayrollParameterRules.InsuranceTypes, "Loại bảo hiểm");
        var payer = PayrollParameterRules.RequireOption(request.Payer, PayrollParameterRules.InsurancePayers, "Người đóng bảo hiểm");
        PayrollParameterRules.EnsurePercent(request.RatePercent, "Tỷ lệ đóng bảo hiểm");
        PayrollParameterRules.EnsureEffectiveRange(request.EffectiveFrom, request.EffectiveTo);
        var status = PayrollParameterRules.NormalizeStatus(request.Status);
        var appliesTo = PayrollParameterRules.OptionalText(request.AppliesTo, "Đối tượng áp dụng", 50, "all");

        await using var tx = await unitOfWork.BeginTransactionAsync(ct, IsolationLevel.Serializable);

        var lockedMonths = await repository.GetLockedMonthsAsync(ct);
        PayrollParameterRules.EnsureLockedPeriodRule(
            lockedMonths, null, new LockedPeriodState(request.EffectiveFrom, request.EffectiveTo, status), true);

        if (status == PayrollParameterRules.Active)
        {
            var existing = await repository.GetOverlappingInsurancesAsync(type, payer, appliesTo, request.EffectiveFrom, request.EffectiveTo, null, ct);
            foreach (var ex in existing)
            {
                if (PayrollParameterRules.PeriodsOverlap(request.EffectiveFrom, request.EffectiveTo, ex.EffectiveFrom, ex.EffectiveTo))
                {
                    throw new AppException(409, $"Đã có cấu hình bảo hiểm '{type}' ({payer}) trùng lặp khoảng thời gian hiệu lực ({ex.EffectiveFrom:dd/MM/yyyy} - {ex.EffectiveTo:dd/MM/yyyy}).");
                }
            }
        }

        var entity = new PayrollInsuranceConfig
        {
            ConfigId = Guid.NewGuid(),
            InsuranceType = type,
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
        auditHelper.Log("create", "InsuranceConfig", entity.ConfigId, null, newSnapshot);

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

        var type = PayrollParameterRules.RequireOption(request.InsuranceType, PayrollParameterRules.InsuranceTypes, "Loại bảo hiểm");
        var payer = PayrollParameterRules.RequireOption(request.Payer, PayrollParameterRules.InsurancePayers, "Người đóng bảo hiểm");
        PayrollParameterRules.EnsurePercent(request.RatePercent, "Tỷ lệ đóng bảo hiểm");
        PayrollParameterRules.EnsureEffectiveRange(request.EffectiveFrom, request.EffectiveTo);
        var status = PayrollParameterRules.NormalizeStatus(request.Status);
        var appliesTo = PayrollParameterRules.OptionalText(request.AppliesTo, "Đối tượng áp dụng", 50, "all");

        bool valuesChanged = entity.InsuranceType != type
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
            var existing = await repository.GetOverlappingInsurancesAsync(type, payer, appliesTo, request.EffectiveFrom, request.EffectiveTo, id, ct);
            foreach (var ex in existing)
            {
                if (PayrollParameterRules.PeriodsOverlap(request.EffectiveFrom, request.EffectiveTo, ex.EffectiveFrom, ex.EffectiveTo))
                {
                    throw new AppException(409, $"Đã có cấu hình bảo hiểm '{type}' ({payer}) trùng lặp khoảng thời gian hiệu lực ({ex.EffectiveFrom:dd/MM/yyyy} - {ex.EffectiveTo:dd/MM/yyyy}).");
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

        entity.InsuranceType = type;
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
        auditHelper.Log("update", "InsuranceConfig", id, oldSnapshot, newSnapshot);

        await SaveChangesWithDeadlockHandlingAsync(ct);
        await tx.CommitAsync(ct);

        var openMonths = await repository.GetOpenMonthsAsync(ct);
        var affectedPeriods = PayrollParameterRules.AffectedOpenPeriods(openMonths, request.EffectiveFrom, request.EffectiveTo);

        var dto = await GetInsuranceAsync(id, ct);
        return dto with { AffectedOpenPeriods = affectedPeriods };
    }

    // ---------- Tax Brackets ----------

    public Task<TaxBracketDto[]> ListTaxBracketsAsync(PayrollParameterFilter filter, CancellationToken ct)
        => repository.ListTaxBracketsAsync(filter, ct);

    public async Task<TaxBracketDto> GetTaxBracketAsync(Guid id, CancellationToken ct)
    {
        var item = await repository.FindTaxBracketAsync(id, ct)
            ?? throw new AppException(404, "Không tìm thấy bậc thuế TNCN.");

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
            var existing = await repository.GetActiveTaxBracketsAsync(request.EffectiveFrom, request.EffectiveTo, null, ct);
            foreach (var ex in existing)
            {
                if (PayrollParameterRules.PeriodsOverlap(request.EffectiveFrom, request.EffectiveTo, ex.EffectiveFrom, ex.EffectiveTo))
                {
                    if (PayrollParameterRules.IncomeRangesOverlap(request.IncomeFrom, request.IncomeTo, ex.IncomeFrom, ex.IncomeTo))
                    {
                        throw new AppException(409, $"Khoảng thu nhập ({request.IncomeFrom:N0} - {request.IncomeTo:N0}) bị chồng lấn với bậc thuế hiện có ({ex.IncomeFrom:N0} - {ex.IncomeTo:N0}).");
                    }
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
        auditHelper.Log("create", "TaxBracket", entity.BracketId, null, newSnapshot);

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
            ?? throw new AppException(404, "Không tìm thấy bậc thuế TNCN.");

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
            var existing = await repository.GetActiveTaxBracketsAsync(request.EffectiveFrom, request.EffectiveTo, id, ct);
            foreach (var ex in existing)
            {
                if (PayrollParameterRules.PeriodsOverlap(request.EffectiveFrom, request.EffectiveTo, ex.EffectiveFrom, ex.EffectiveTo))
                {
                    if (PayrollParameterRules.IncomeRangesOverlap(request.IncomeFrom, request.IncomeTo, ex.IncomeFrom, ex.IncomeTo))
                    {
                        throw new AppException(409, $"Khoảng thu nhập ({request.IncomeFrom:N0} - {request.IncomeTo:N0}) bị chồng lấn với bậc thuế hiện có ({ex.IncomeFrom:N0} - {ex.IncomeTo:N0}).");
                    }
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
        auditHelper.Log("update", "TaxBracket", id, oldSnapshot, newSnapshot);

        await SaveChangesWithDeadlockHandlingAsync(ct);
        await tx.CommitAsync(ct);

        var openMonths = await repository.GetOpenMonthsAsync(ct);
        var affectedPeriods = PayrollParameterRules.AffectedOpenPeriods(openMonths, request.EffectiveFrom, request.EffectiveTo);

        var dto = await GetTaxBracketAsync(id, ct);
        return dto with { AffectedOpenPeriods = affectedPeriods };
    }

    public Task<TaxDeductionPolicyDto> GetTaxDeductionPolicyAsync(CancellationToken ct)
        => repository.GetTaxDeductionPolicyAsync(ct);

    // ---------- Commission Rules ----------

    public Task<CommissionRuleDto[]> ListCommissionRulesAsync(PayrollParameterFilter filter, CancellationToken ct)
        => repository.ListCommissionRulesAsync(filter, ct);

    public async Task<CommissionRuleDto> GetCommissionRuleAsync(Guid id, CancellationToken ct)
    {
        var filter = new PayrollParameterFilter(null, null, null);
        var list = await repository.ListCommissionRulesAsync(filter, ct);
        var item = list.FirstOrDefault(x => x.Id == id)
            ?? throw new AppException(404, "Không tìm thấy quy tắc hoa hồng.");
        return item;
    }

    public async Task<CommissionRuleDto> CreateCommissionRuleAsync(SaveCommissionRuleRequest request, Guid? creatorId, CancellationToken ct)
    {
        if (request.ServiceId == Guid.Empty) throw new AppException(400, "Dịch vụ thủ thuật là bắt buộc.");
        var role = PayrollParameterRules.RequireOption(request.Role, PayrollParameterRules.CommissionRoles, "Vai trò thực hiện");
        var valueType = PayrollParameterRules.RequireOption(request.ValueType, PayrollParameterRules.CommissionValueTypes, "Loại hoa hồng");
        PayrollParameterRules.EnsureTypedValue(valueType == "fixed" ? "fixed" : "percentage", request.CommissionValue, "Mức hoa hồng");
        PayrollParameterRules.EnsureEffectiveRange(request.EffectiveFrom, request.EffectiveTo);
        var status = PayrollParameterRules.NormalizeStatus(request.Status);

        if (!await repository.ServiceExistsAndActiveAsync(request.ServiceId, ct))
        {
            throw new AppException(404, "Dịch vụ thủ thuật không tồn tại hoặc đã ngừng hoạt động.");
        }

        await using var tx = await unitOfWork.BeginTransactionAsync(ct, IsolationLevel.Serializable);

        var lockedMonths = await repository.GetLockedMonthsAsync(ct);
        PayrollParameterRules.EnsureLockedPeriodRule(
            lockedMonths, null, new LockedPeriodState(request.EffectiveFrom, request.EffectiveTo, status), true);

        if (status == PayrollParameterRules.Active)
        {
            var existing = await repository.GetOverlappingCommissionRulesAsync(request.ServiceId, role, request.EffectiveFrom, request.EffectiveTo, null, ct);
            foreach (var ex in existing)
            {
                if (PayrollParameterRules.PeriodsOverlap(request.EffectiveFrom, request.EffectiveTo, ex.EffectiveFrom, ex.EffectiveTo))
                {
                    throw new AppException(409, $"Đã có quy tắc hoa hồng cho dịch vụ này với vai trò '{role}' trùng lặp thời gian hiệu lực ({ex.EffectiveFrom:dd/MM/yyyy} - {ex.EffectiveTo:dd/MM/yyyy}).");
                }
            }
        }

        var entity = new CommissionRule
        {
            RuleId = Guid.NewGuid(),
            ServiceId = request.ServiceId,
            Role = role,
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
            entity.Role,
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

        if (request.ServiceId == Guid.Empty) throw new AppException(400, "Dịch vụ thủ thuật là bắt buộc.");
        var role = PayrollParameterRules.RequireOption(request.Role, PayrollParameterRules.CommissionRoles, "Vai trò thực hiện");
        var valueType = PayrollParameterRules.RequireOption(request.ValueType, PayrollParameterRules.CommissionValueTypes, "Loại hoa hồng");
        PayrollParameterRules.EnsureTypedValue(valueType == "fixed" ? "fixed" : "percentage", request.CommissionValue, "Mức hoa hồng");
        PayrollParameterRules.EnsureEffectiveRange(request.EffectiveFrom, request.EffectiveTo);
        var status = PayrollParameterRules.NormalizeStatus(request.Status);

        if (entity.ServiceId != request.ServiceId && !await repository.ServiceExistsAndActiveAsync(request.ServiceId, ct))
        {
            throw new AppException(404, "Dịch vụ thủ thuật không tồn tại hoặc đã ngừng hoạt động.");
        }

        bool valuesChanged = entity.ServiceId != request.ServiceId
            || entity.Role != role
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
            var existing = await repository.GetOverlappingCommissionRulesAsync(request.ServiceId, role, request.EffectiveFrom, request.EffectiveTo, id, ct);
            foreach (var ex in existing)
            {
                if (PayrollParameterRules.PeriodsOverlap(request.EffectiveFrom, request.EffectiveTo, ex.EffectiveFrom, ex.EffectiveTo))
                {
                    throw new AppException(409, $"Đã có quy tắc hoa hồng cho dịch vụ này với vai trò '{role}' trùng lặp thời gian hiệu lực ({ex.EffectiveFrom:dd/MM/yyyy} - {ex.EffectiveTo:dd/MM/yyyy}).");
                }
            }
        }

        var oldSnapshot = new
        {
            entity.ServiceId,
            entity.Role,
            entity.ValueType,
            entity.CommissionValue,
            entity.EffectiveFrom,
            entity.EffectiveTo,
            entity.Status
        };

        entity.ServiceId = request.ServiceId;
        entity.Role = role;
        entity.ValueType = valueType;
        entity.CommissionValue = request.CommissionValue;
        entity.EffectiveFrom = request.EffectiveFrom;
        entity.EffectiveTo = request.EffectiveTo;
        entity.Status = status;

        var newSnapshot = new
        {
            entity.ServiceId,
            entity.Role,
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

    public Task<ProcedureServiceOptionDto[]> ListActiveProcedureServicesAsync(CancellationToken ct)
        => repository.ListActiveProcedureServicesAsync(ct);

    // ---------- Helper for deadlock (1205) ----------

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
