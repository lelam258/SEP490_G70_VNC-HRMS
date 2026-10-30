using System.Text.RegularExpressions;
using Vnc.HRMS.Common.Exceptions;
using Vnc.HRMS.DTOs.Payroll;
using Vnc.HRMS.Models;
using Vnc.HRMS.Repositories.Interfaces;
using Vnc.HRMS.Services.Interfaces;

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
        if (string.IsNullOrWhiteSpace(payMonth) || !MonthRegex.IsMatch(payMonth.Trim()))
        {
            throw new AppException(400, "Định dạng tháng không hợp lệ (định dạng đúng: YYYY-MM).");
        }
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

        return new PayrollPeriodDto(
            entity.LockId,
            entity.PayMonth,
            "draft",
            0,
            0m,
            null,
            entity.CreatedAt
        );
    }
}
