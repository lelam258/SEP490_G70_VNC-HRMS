using System.Data;
using Vnc.HRMS.Common.Exceptions;
using Vnc.HRMS.DTOs.Employees;
using Vnc.HRMS.DTOs.Payroll;
using Vnc.HRMS.Models.Employees;
using Vnc.HRMS.Repositories.Interfaces;
using Vnc.HRMS.Services.Interfaces;
using Vnc.HRMS.Services.Rules;

namespace Vnc.HRMS.Services;

/// <summary>Employment contracts maintained by HR. Salary changes after creation belong to compensation settings.</summary>
public sealed class ContractService(
    IContractRepository repository,
    IPayrollParameterRepository parameterRepository,
    IUnitOfWork unitOfWork,
    IAuditLogHelper auditHelper) : IContractService
{
    private const int MaxContractTypeLength = 50;
    private const int MaxFileUrlLength = 500;

    public async Task<ContractListItemDto[]> ListAsync(CancellationToken ct)
    {
        var today = PayrollParameterRules.TodayVn();
        var rows = await repository.ListAsync(ct);
        return rows.Select(x => x with { DisplayStatus = ContractRules.DisplayStatus(x.Status, x.EffectiveFrom, x.EffectiveTo, today) }).ToArray();
    }

    public async Task<ContractDetailDto> GetAsync(Guid contractId, CancellationToken ct)
    {
        var detail = await repository.GetDetailAsync(contractId, ct)
            ?? throw new AppException(404, "Không tìm thấy hợp đồng lao động.");
        return detail with { DisplayStatus = ContractRules.DisplayStatus(detail.Status, detail.EffectiveFrom, detail.EffectiveTo, PayrollParameterRules.TodayVn()) };
    }

    public async Task<ContractDetailDto> CreateAsync(CreateContractRequest request, CancellationToken ct)
    {
        var code = NormalizeContractCode(request.ContractCode);
        var contractType = PayrollParameterRules.RequireText(request.ContractType, "Loại hợp đồng", MaxContractTypeLength);
        ContractRules.EnsureTerm(contractType, request.EffectiveFrom, request.EffectiveTo);
        var salaryType = PayrollParameterRules.RequireOption(request.SalaryType, PayrollParameterRules.SalaryTypes, "Kiểu lương");
        var standardWorkingDays = request.StandardWorkingDays ?? await ConfiguredStandardWorkingDaysAsync(ct);
        var (dailyRate, monthlySalary) = ContractRules.SalaryFromBase(salaryType, request.BaseSalary, standardWorkingDays);
        var fileUrl = OptionalFileUrl(request.FileUrl);

        await using var tx = await unitOfWork.BeginTransactionAsync(ct, IsolationLevel.Serializable);

        var staff = await repository.FindStaffAsync(request.StaffId, ct)
            ?? throw new AppException(404, "Không tìm thấy nhân viên.", "staffId");
        if (staff.Status != PayrollParameterRules.Active)
            throw new AppException(400, "Chỉ tạo hợp đồng cho nhân viên đang làm việc.", "staffId");
        if (await repository.CodeExistsAsync(code, null, ct))
            throw new AppException(409, $"Số hợp đồng {code} đã tồn tại.", "contractCode");
        if (await repository.HasOverlappingActiveAsync(staff.StaffId, request.EffectiveFrom, request.EffectiveTo, null, ct))
            throw new AppException(409, "Nhân viên đã có hợp đồng đang hiệu lực trùng thời gian này.", "effectiveFrom");

        var now = DateTime.UtcNow;
        var contract = new Contract
        {
            ContractId = Guid.NewGuid(),
            StaffId = staff.StaffId,
            ContractCode = code,
            ContractType = contractType,
            SalaryType = salaryType,
            DailyRate = dailyRate,
            MonthlySalary = monthlySalary,
            StandardWorkingDays = standardWorkingDays,
            TaxMethod = "progressive",
            // Insurance defaults to the agreed salary; the accountant refines it in compensation settings.
            IsInsuranceEligible = true,
            InsuranceSalaryBasis = monthlySalary,
            EffectiveFrom = request.EffectiveFrom,
            EffectiveTo = request.EffectiveTo,
            Status = PayrollParameterRules.Active,
            FileUrl = fileUrl,
            CreatedAt = now,
            UpdatedAt = now
        };
        repository.Add(contract);
        auditHelper.Log("create", "Contract", contract.ContractId, null, Snapshot(contract));

        await unitOfWork.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return await GetAsync(contract.ContractId, ct);
    }

    public async Task<ContractDetailDto> UpdateAsync(Guid contractId, UpdateContractRequest request, CancellationToken ct)
    {
        var code = NormalizeContractCode(request.ContractCode);
        var contractType = PayrollParameterRules.RequireText(request.ContractType, "Loại hợp đồng", MaxContractTypeLength);
        ContractRules.EnsureTerm(contractType, request.EffectiveFrom, request.EffectiveTo);
        var status = PayrollParameterRules.NormalizeStatus(request.Status);
        var fileUrl = OptionalFileUrl(request.FileUrl);

        await using var tx = await unitOfWork.BeginTransactionAsync(ct, IsolationLevel.Serializable);

        var contract = await repository.FindAsync(contractId, ct)
            ?? throw new AppException(404, "Không tìm thấy hợp đồng lao động.");
        if (await repository.CodeExistsAsync(code, contractId, ct))
            throw new AppException(409, $"Số hợp đồng {code} đã tồn tại.", "contractCode");
        if (status == PayrollParameterRules.Active
            && await repository.HasOverlappingActiveAsync(contract.StaffId, request.EffectiveFrom, request.EffectiveTo, contractId, ct))
            throw new AppException(409, "Nhân viên đã có hợp đồng đang hiệu lực trùng thời gian này.", "effectiveFrom");

        // Months already paid from this contract keep the period they were paid under.
        var lockedMonths = await parameterRepository.GetLockedMonthsAsync(ct);
        PayrollParameterRules.EnsureLockedPeriodRule(
            lockedMonths,
            new LockedPeriodState(contract.EffectiveFrom, contract.EffectiveTo, contract.Status),
            new LockedPeriodState(request.EffectiveFrom, request.EffectiveTo, status),
            false);

        // Salary history must stay inside the contract; the open-ended latest entry follows the new end date.
        var histories = await repository.ListSalaryHistoriesAsync(contractId, ct);
        if (histories.Any(h => !PayrollParameterRules.PeriodWithin(h.EffectiveFrom, h.EffectiveFrom, request.EffectiveFrom, request.EffectiveTo)))
            throw new AppException(409, "Thời hạn mới không bao trùm các lần điều chỉnh lương đã ghi nhận của hợp đồng.", "effectiveFrom");
        foreach (var history in histories.Where(h => h.EffectiveTo == contract.EffectiveTo))
            history.EffectiveTo = request.EffectiveTo;

        var before = Snapshot(contract);
        contract.ContractCode = code;
        contract.ContractType = contractType;
        contract.EffectiveFrom = request.EffectiveFrom;
        contract.EffectiveTo = request.EffectiveTo;
        contract.Status = status;
        contract.FileUrl = fileUrl;
        contract.UpdatedAt = DateTime.UtcNow;
        auditHelper.Log("update", "Contract", contract.ContractId, before, Snapshot(contract));

        await unitOfWork.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return await GetAsync(contractId, ct);
    }

    private static string NormalizeContractCode(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) throw new AppException(400, "Số hợp đồng là bắt buộc.", "contractCode");
        return PayrollParameterRules.NormalizeCode(value);
    }

    private static string? OptionalFileUrl(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var url = value.Trim();
        if (url.Length > MaxFileUrlLength) throw new AppException(400, $"Đường dẫn tệp hợp đồng tối đa {MaxFileUrlLength} ký tự.", "fileUrl");
        return url;
    }

    private static object Snapshot(Contract c) => new
    {
        c.ContractCode, c.ContractType, c.SalaryType, c.DailyRate, c.MonthlySalary, c.StandardWorkingDays,
        c.EffectiveFrom, c.EffectiveTo, c.Status, c.FileUrl
    };

    private async Task<decimal> ConfiguredStandardWorkingDaysAsync(CancellationToken ct)
    {
        var configs = await parameterRepository.ListRateConfigsAsync(
            new PayrollRateConfigFilter("standard_working_days", null, null, PayrollParameterRules.Active, PayrollParameterRules.TodayVn(), null), ct);
        return configs.FirstOrDefault(x => x.PositionId == null && x.StaffId == null)?.Value ?? PayrollDefaults.StandardWorkingDays;
    }
}
