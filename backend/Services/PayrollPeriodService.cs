using System.Text.RegularExpressions;
using Vnc.HRMS.Common.Exceptions;
using Vnc.HRMS.Common.Utils;
using Vnc.HRMS.DTOs.Payroll;
using Vnc.HRMS.Models;
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
}
