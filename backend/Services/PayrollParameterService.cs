using Vnc.HRMS.Common.Exceptions;
using Vnc.HRMS.DTOs.Payroll;
using Vnc.HRMS.Models.Payroll;
using Vnc.HRMS.Repositories.Interfaces;
using Vnc.HRMS.Services.Interfaces;

namespace Vnc.HRMS.Services;

public sealed class PayrollParameterService(
    IPayrollParameterRepository repository,
    IUnitOfWork unitOfWork
) : IPayrollParameterService
{
    public Task<PayrollParametersSummaryDto> GetSummaryAsync(CancellationToken ct) => repository.GetSummaryAsync(ct);

    // ==========================================
    // 1. ALLOWANCES
    // ==========================================
    public Task<AllowanceTypeDto[]> ListAllowancesAsync(CancellationToken ct) => repository.ListAllowancesAsync(ct);

    public async Task<AllowanceTypeDto> GetAllowanceAsync(Guid id, CancellationToken ct)
    {
        var entity = await repository.FindAllowanceAsync(id, ct)
            ?? throw new AppException(404, "Không tìm thấy loại phụ cấp.");
        return new AllowanceTypeDto(entity.AllowanceId, entity.Code, entity.Name, entity.ValueType, entity.DefaultValue, entity.AppliesTo, entity.IsTaxable, entity.IsInsuranceBasis, entity.Status, entity.CreatedAt);
    }

    public async Task<AllowanceTypeDto> CreateAllowanceAsync(SaveAllowanceTypeRequest request, CancellationToken ct)
    {
        ValidateAllowance(request);
        var code = request.Code.Trim().ToUpperInvariant();
        if (await repository.ExistsAllowanceCodeAsync(code, null, ct))
            throw new AppException(400, $"Mã phụ cấp '{code}' đã tồn tại.");

        var entity = new AllowanceType
        {
            AllowanceId = Guid.NewGuid(),
            Code = code,
            Name = request.Name.Trim(),
            ValueType = request.ValueType.ToLowerInvariant(),
            DefaultValue = request.DefaultValue,
            AppliesTo = string.IsNullOrWhiteSpace(request.AppliesTo) ? "all" : request.AppliesTo.Trim(),
            IsTaxable = request.IsTaxable,
            IsInsuranceBasis = request.IsInsuranceBasis,
            Status = string.IsNullOrWhiteSpace(request.Status) ? "active" : request.Status.ToLowerInvariant(),
            CreatedAt = DateTime.UtcNow
        };

        repository.AddAllowance(entity);
        await unitOfWork.SaveChangesAsync(ct);
        return await GetAllowanceAsync(entity.AllowanceId, ct);
    }

    public async Task<AllowanceTypeDto> UpdateAllowanceAsync(Guid id, SaveAllowanceTypeRequest request, CancellationToken ct)
    {
        ValidateAllowance(request);
        var entity = await repository.FindAllowanceAsync(id, ct)
            ?? throw new AppException(404, "Không tìm thấy loại phụ cấp.");

        var code = request.Code.Trim().ToUpperInvariant();
        if (await repository.ExistsAllowanceCodeAsync(code, id, ct))
            throw new AppException(400, $"Mã phụ cấp '{code}' đã tồn tại.");

        entity.Code = code;
        entity.Name = request.Name.Trim();
        entity.ValueType = request.ValueType.ToLowerInvariant();
        entity.DefaultValue = request.DefaultValue;
        entity.AppliesTo = string.IsNullOrWhiteSpace(request.AppliesTo) ? "all" : request.AppliesTo.Trim();
        entity.IsTaxable = request.IsTaxable;
        entity.IsInsuranceBasis = request.IsInsuranceBasis;
        entity.Status = string.IsNullOrWhiteSpace(request.Status) ? "active" : request.Status.ToLowerInvariant();

        await unitOfWork.SaveChangesAsync(ct);
        return await GetAllowanceAsync(entity.AllowanceId, ct);
    }

    private static void ValidateAllowance(SaveAllowanceTypeRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Code)) throw new AppException(400, "Mã phụ cấp không được để trống.");
        if (string.IsNullOrWhiteSpace(request.Name)) throw new AppException(400, "Tên phụ cấp không được để trống.");
        if (request.ValueType is not ("fixed" or "percentage"))
            throw new AppException(400, "Loại giá trị phụ cấp chỉ nhận 'fixed' (cố định) hoặc 'percentage' (phần trăm).");
        if (request.DefaultValue < 0) throw new AppException(400, "Giá trị mặc định không được âm.");
    }

    // ==========================================
    // 2. INSURANCES
    // ==========================================
    public Task<InsuranceConfigDto[]> ListInsurancesAsync(CancellationToken ct) => repository.ListInsurancesAsync(ct);

    public async Task<InsuranceConfigDto> GetInsuranceAsync(Guid id, CancellationToken ct)
    {
        var entity = await repository.FindInsuranceAsync(id, ct)
            ?? throw new AppException(404, "Không tìm thấy cấu hình bảo hiểm.");
        return new InsuranceConfigDto(entity.ConfigId, entity.InsuranceType, entity.Payer, entity.RatePercent, entity.AppliesTo, entity.EffectiveFrom, entity.EffectiveTo, entity.Status);
    }

    public async Task<InsuranceConfigDto> CreateInsuranceAsync(SaveInsuranceConfigRequest request, CancellationToken ct)
    {
        ValidateInsurance(request);
        var entity = new PayrollInsuranceConfig
        {
            ConfigId = Guid.NewGuid(),
            InsuranceType = request.InsuranceType.Trim().ToUpperInvariant(),
            Payer = request.Payer.Trim().ToLowerInvariant(),
            RatePercent = request.RatePercent,
            AppliesTo = string.IsNullOrWhiteSpace(request.AppliesTo) ? "all" : request.AppliesTo.Trim(),
            EffectiveFrom = request.EffectiveFrom,
            EffectiveTo = request.EffectiveTo,
            Status = string.IsNullOrWhiteSpace(request.Status) ? "active" : request.Status.ToLowerInvariant()
        };

        repository.AddInsurance(entity);
        await unitOfWork.SaveChangesAsync(ct);
        return await GetInsuranceAsync(entity.ConfigId, ct);
    }

    public async Task<InsuranceConfigDto> UpdateInsuranceAsync(Guid id, SaveInsuranceConfigRequest request, CancellationToken ct)
    {
        ValidateInsurance(request);
        var entity = await repository.FindInsuranceAsync(id, ct)
            ?? throw new AppException(404, "Không tìm thấy cấu hình bảo hiểm.");

        entity.InsuranceType = request.InsuranceType.Trim().ToUpperInvariant();
        entity.Payer = request.Payer.Trim().ToLowerInvariant();
        entity.RatePercent = request.RatePercent;
        entity.AppliesTo = string.IsNullOrWhiteSpace(request.AppliesTo) ? "all" : request.AppliesTo.Trim();
        entity.EffectiveFrom = request.EffectiveFrom;
        entity.EffectiveTo = request.EffectiveTo;
        entity.Status = string.IsNullOrWhiteSpace(request.Status) ? "active" : request.Status.ToLowerInvariant();

        await unitOfWork.SaveChangesAsync(ct);
        return await GetInsuranceAsync(entity.ConfigId, ct);
    }

    private static void ValidateInsurance(SaveInsuranceConfigRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.InsuranceType)) throw new AppException(400, "Loại bảo hiểm không được để trống.");
        if (request.RatePercent is < 0 or > 100) throw new AppException(400, "Tỷ lệ phần trăm đóng bảo hiểm phải từ 0 đến 100.");
        if (request.EffectiveTo.HasValue && request.EffectiveTo.Value < request.EffectiveFrom)
            throw new AppException(400, "Ngày kết thúc hiệu lực không được nhỏ hơn ngày bắt đầu.");
    }

    // ==========================================
    // 3. TAX BRACKETS
    // ==========================================
    public Task<TaxBracketDto[]> ListTaxBracketsAsync(CancellationToken ct) => repository.ListTaxBracketsAsync(ct);

    public async Task<TaxBracketDto> GetTaxBracketAsync(Guid id, CancellationToken ct)
    {
        var entity = await repository.FindTaxBracketAsync(id, ct)
            ?? throw new AppException(404, "Không tìm thấy bậc thuế.");
        return new TaxBracketDto(entity.BracketId, entity.IncomeFrom, entity.IncomeTo, entity.TaxRatePercent, entity.EffectiveFrom, entity.EffectiveTo, entity.Status);
    }

    public async Task<TaxBracketDto> CreateTaxBracketAsync(SaveTaxBracketRequest request, CancellationToken ct)
    {
        ValidateTaxBracket(request);
        var entity = new PayrollTaxBracket
        {
            BracketId = Guid.NewGuid(),
            IncomeFrom = request.IncomeFrom,
            IncomeTo = request.IncomeTo,
            TaxRatePercent = request.TaxRatePercent,
            EffectiveFrom = request.EffectiveFrom,
            EffectiveTo = request.EffectiveTo,
            Status = string.IsNullOrWhiteSpace(request.Status) ? "active" : request.Status.ToLowerInvariant()
        };

        repository.AddTaxBracket(entity);
        await unitOfWork.SaveChangesAsync(ct);
        return await GetTaxBracketAsync(entity.BracketId, ct);
    }

    public async Task<TaxBracketDto> UpdateTaxBracketAsync(Guid id, SaveTaxBracketRequest request, CancellationToken ct)
    {
        ValidateTaxBracket(request);
        var entity = await repository.FindTaxBracketAsync(id, ct)
            ?? throw new AppException(404, "Không tìm thấy bậc thuế.");

        entity.IncomeFrom = request.IncomeFrom;
        entity.IncomeTo = request.IncomeTo;
        entity.TaxRatePercent = request.TaxRatePercent;
        entity.EffectiveFrom = request.EffectiveFrom;
        entity.EffectiveTo = request.EffectiveTo;
        entity.Status = string.IsNullOrWhiteSpace(request.Status) ? "active" : request.Status.ToLowerInvariant();

        await unitOfWork.SaveChangesAsync(ct);
        return await GetTaxBracketAsync(entity.BracketId, ct);
    }

    private static void ValidateTaxBracket(SaveTaxBracketRequest request)
    {
        if (request.IncomeFrom < 0) throw new AppException(400, "Mức thu nhập tối thiểu không được âm.");
        if (request.IncomeTo.HasValue && request.IncomeTo.Value <= request.IncomeFrom)
            throw new AppException(400, "Mức thu nhập tối đa phải lớn hơn mức thu nhập tối thiểu.");
        if (request.TaxRatePercent is < 0 or > 100) throw new AppException(400, "Thuế suất phải từ 0 đến 100%.");
    }

    // ==========================================
    // 4. COMMISSION RULES
    // ==========================================
    public Task<CommissionRuleDto[]> ListCommissionRulesAsync(CancellationToken ct) => repository.ListCommissionRulesAsync(ct);

    public async Task<CommissionRuleDto> GetCommissionRuleAsync(Guid id, CancellationToken ct)
    {
        var entity = await repository.FindCommissionRuleAsync(id, ct)
            ?? throw new AppException(404, "Không tìm thấy quy tắc hoa hồng.");
        return new CommissionRuleDto(entity.RuleId, entity.ServiceId, entity.Role, entity.ValueType, entity.CommissionValue, entity.EffectiveFrom, entity.EffectiveTo, entity.Status);
    }

    public async Task<CommissionRuleDto> CreateCommissionRuleAsync(SaveCommissionRuleRequest request, Guid? creatorId, CancellationToken ct)
    {
        if (request.ServiceId == Guid.Empty) throw new AppException(400, "Dịch vụ thủ thuật là bắt buộc.");
        if (string.IsNullOrWhiteSpace(request.Role)) throw new AppException(400, "Vai trò thực hiện là bắt buộc.");
        if (request.CommissionValue < 0) throw new AppException(400, "Mức hoa hồng không được âm.");

        var entity = new CommissionRule
        {
            RuleId = Guid.NewGuid(),
            ServiceId = request.ServiceId,
            Role = request.Role.Trim(),
            ValueType = string.IsNullOrWhiteSpace(request.ValueType) ? "fixed" : request.ValueType.ToLowerInvariant(),
            CommissionValue = request.CommissionValue,
            EffectiveFrom = request.EffectiveFrom,
            EffectiveTo = request.EffectiveTo,
            Status = string.IsNullOrWhiteSpace(request.Status) ? "active" : request.Status.ToLowerInvariant(),
            CreatedBy = creatorId,
            CreatedAt = DateTime.UtcNow
        };

        repository.AddCommissionRule(entity);
        await unitOfWork.SaveChangesAsync(ct);
        return await GetCommissionRuleAsync(entity.RuleId, ct);
    }

    public async Task<CommissionRuleDto> UpdateCommissionRuleAsync(Guid id, SaveCommissionRuleRequest request, CancellationToken ct)
    {
        if (request.ServiceId == Guid.Empty) throw new AppException(400, "Dịch vụ thủ thuật là bắt buộc.");
        if (string.IsNullOrWhiteSpace(request.Role)) throw new AppException(400, "Vai trò thực hiện là bắt buộc.");
        if (request.CommissionValue < 0) throw new AppException(400, "Mức hoa hồng không được âm.");

        var entity = await repository.FindCommissionRuleAsync(id, ct)
            ?? throw new AppException(404, "Không tìm thấy quy tắc hoa hồng.");

        entity.ServiceId = request.ServiceId;
        entity.Role = request.Role.Trim();
        entity.ValueType = string.IsNullOrWhiteSpace(request.ValueType) ? "fixed" : request.ValueType.ToLowerInvariant();
        entity.CommissionValue = request.CommissionValue;
        entity.EffectiveFrom = request.EffectiveFrom;
        entity.EffectiveTo = request.EffectiveTo;
        entity.Status = string.IsNullOrWhiteSpace(request.Status) ? "active" : request.Status.ToLowerInvariant();

        await unitOfWork.SaveChangesAsync(ct);
        return await GetCommissionRuleAsync(entity.RuleId, ct);
    }
}
