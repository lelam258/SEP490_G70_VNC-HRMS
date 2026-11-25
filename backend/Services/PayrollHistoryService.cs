using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Vnc.HRMS.Common.Exceptions;
using Vnc.HRMS.DTOs.Payroll;
using Vnc.HRMS.Models;
using Vnc.HRMS.Repositories.Interfaces;
using Vnc.HRMS.Services.Interfaces;

namespace Vnc.HRMS.Services;

public sealed partial class PayrollHistoryService(IPayrollHistoryRepository repository) : IPayrollHistoryService
{
    private static readonly Regex MonthRegex = MonthPattern();

    [GeneratedRegex(@"^\d{4}-(0[1-9]|1[0-2])$")]
    private static partial Regex MonthPattern();

    public async Task<PayrollHistoryResponseDto> ListHistoryAsync(
        PayrollHistoryFilter filter, CancellationToken ct)
    {
        ValidateOptionalMonth(filter.FromMonth);
        ValidateOptionalMonth(filter.ToMonth);

        var locks = await repository.ListLocksAsync(ct);
        var filteredLocks = locks.Where(l => MatchLockFilter(l, filter)).ToList();

        var departments = await repository.ListActiveDepartmentsAsync(ct);
        if (filteredLocks.Count == 0)
        {
            return new PayrollHistoryResponseDto([], departments);
        }

        var months = filteredLocks.Select(l => l.PayMonth).ToList();
        var lockIds = filteredLocks.Select(l => l.LockId).ToList();

        var payslips = await repository.ListPayslipsByMonthsAsync(months, filter.DepartmentId, ct);
        var logs = await repository.ListPayrollLockLogsAsync(lockIds, ct);

        var userIds = filteredLocks.Where(l => l.LockedBy.HasValue).Select(l => l.LockedBy!.Value);
        var userNames = await repository.GetUserNamesAsync(userIds, ct);

        var payslipsByMonth = payslips.ToLookup(p => p.PayMonth);
        var logsByLock = logs.Where(a => a.EntityId.HasValue).ToLookup(a => a.EntityId!.Value);

        var items = new List<PayrollHistoryItemDto>();
        foreach (var periodLock in filteredLocks)
        {
            var monthPayslips = payslipsByMonth[periodLock.PayMonth].ToList();
            if (filter.DepartmentId.HasValue && monthPayslips.Count == 0)
            {
                continue;
            }

            items.Add(BuildHistoryItem(periodLock, monthPayslips, logsByLock[periodLock.LockId], userNames));
        }

        return new PayrollHistoryResponseDto(items, departments);
    }

    public async Task<PayrollHistoryDetailDto> GetMonthHistoryDetailAsync(
        string payMonth, Guid? departmentId, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(payMonth) || !MonthRegex.IsMatch(payMonth.Trim()))
        {
            throw new AppException(400, "Định dạng tháng không hợp lệ (YYYY-MM).");
        }

        var normalizedMonth = payMonth.Trim();
        var periodLock = await repository.FindLockByMonthAsync(normalizedMonth, ct)
            ?? throw new AppException(404, "Không tìm thấy lịch sử kỳ tính lương cho tháng đã chọn.");

        var payslips = await repository.ListPayslipsByMonthsAsync([normalizedMonth], departmentId, ct);
        var logs = await repository.ListPayrollLockLogsAsync([periodLock.LockId], ct);
        var deptNames = await repository.GetDepartmentNamesAsync(ct);

        var userIds = new List<Guid>();
        if (periodLock.LockedBy.HasValue) userIds.Add(periodLock.LockedBy.Value);
        userIds.AddRange(logs.Where(l => l.UserId.HasValue).Select(l => l.UserId!.Value));
        var userNames = await repository.GetUserNamesAsync(userIds, ct);

        var summary = BuildHistoryItem(periodLock, payslips, logs, userNames);

        var breakdowns = payslips
            .GroupBy(p => p.DepartmentId)
            .Select(g => new PayrollHistoryDepartmentBreakdownDto(
                DepartmentId: g.Key,
                DepartmentName: g.Key.HasValue && deptNames.TryGetValue(g.Key.Value, out var name)
                    ? name
                    : "Chưa phân khoa",
                EmployeeCount: g.Count(),
                TotalWorkDays: g.Sum(x => x.WorkDays ?? 0m),
                TotalCommission: g.Sum(x => x.CommissionTotal ?? 0m),
                TotalGrossPay: g.Sum(x => x.GrossPay ?? 0m),
                TotalInsurance: g.Sum(x => x.InsuranceDeduction ?? 0m),
                TotalTax: g.Sum(x => x.TaxDeduction ?? 0m),
                TotalNetPay: g.Sum(x => x.NetPay ?? 0m)
            ))
            .OrderBy(b => b.DepartmentName)
            .ToList();

        var events = logs.Select(l => new PayrollHistoryEventDto(
            LogId: l.LogId,
            Action: l.Action,
            ActionLabel: MapActionLabel(l.Action),
            ActorName: l.UserId.HasValue && userNames.TryGetValue(l.UserId.Value, out var actor)
                ? actor
                : (l.Username ?? "Hệ thống"),
            CreatedAt: l.CreatedAt,
            Summary: ExtractAuditSummary(l.NewValue)
        )).ToList();

        return new PayrollHistoryDetailDto(summary, breakdowns, events);
    }

    public async Task<string> ExportHistoryCsvAsync(PayrollHistoryFilter filter, CancellationToken ct)
    {
        var data = await ListHistoryAsync(filter, ct);
        var sb = new StringBuilder();
        sb.AppendLine("Ky luong,Trang thai,So lan tinh,Tre han,So nhan su,Tong cong,Tong hoa hong,Tong Gross,Tong bao hiem,Tong thue TNCN,Tong thuc linh,Tinh lan cuoi (UTC),Chot luc (UTC),Nguoi chot");

        foreach (var item in data.Items)
        {
            sb.AppendLine(string.Join(",",
                Csv(item.PayMonth),
                Csv(MapStatusLabel(item.Status)),
                item.RunCount.ToString(CultureInfo.InvariantCulture),
                Csv(item.IsLate ? "Co" : "Khong"),
                item.EmployeeCount.ToString(CultureInfo.InvariantCulture),
                item.TotalWorkDays.ToString("0.##", CultureInfo.InvariantCulture),
                item.TotalCommission.ToString("0.##", CultureInfo.InvariantCulture),
                item.TotalGrossPay.ToString("0.##", CultureInfo.InvariantCulture),
                item.TotalInsurance.ToString("0.##", CultureInfo.InvariantCulture),
                item.TotalTax.ToString("0.##", CultureInfo.InvariantCulture),
                item.TotalNetPay.ToString("0.##", CultureInfo.InvariantCulture),
                Csv(item.LastCalculatedAt?.ToString("yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture) ?? ""),
                Csv(item.LockedAt?.ToString("yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture) ?? ""),
                Csv(item.LockedByName ?? "")
            ));
        }

        return sb.ToString();
    }

    private static PayrollHistoryItemDto BuildHistoryItem(
        PayrollLock periodLock,
        List<Payslip> payslips,
        IEnumerable<AuditLog> lockLogs,
        Dictionary<Guid, string> userNames)
    {
        var logList = lockLogs.ToList();
        var calcLogs = logList
            .Where(l => string.Equals(l.Action, "calculate", StringComparison.OrdinalIgnoreCase))
            .ToList();
        var isLate = logList.Any(l => string.Equals(l.Action, "reopen", StringComparison.OrdinalIgnoreCase));

        var missingContractCount = payslips.Count(p => !p.ContractId.HasValue);
        var status = periodLock.Status?.Trim().ToLowerInvariant() ?? "draft";

        string? warning = null;
        if (missingContractCount > 0)
        {
            warning = $"Có {missingContractCount} phiếu lương chưa gắn hợp đồng trong kỳ này.";
        }
        else if (status is not ("finalized" or "locked" or "paid") && payslips.Count > 0)
        {
            warning = "Kỳ lương chưa chốt chính thức; số liệu có thể thay đổi khi tính lại.";
        }

        var lockedByName = periodLock.LockedBy.HasValue && userNames.TryGetValue(periodLock.LockedBy.Value, out var name)
            ? name
            : null;

        return new PayrollHistoryItemDto(
            LockId: periodLock.LockId,
            PayMonth: periodLock.PayMonth,
            Status: status,
            RunCount: calcLogs.Count,
            IsLate: isLate,
            HasWarning: warning is not null,
            WarningMessage: warning,
            EmployeeCount: payslips.Count,
            TotalWorkDays: payslips.Sum(x => x.WorkDays ?? 0m),
            TotalCommission: payslips.Sum(x => x.CommissionTotal ?? 0m),
            TotalGrossPay: payslips.Sum(x => x.GrossPay ?? 0m),
            TotalInsurance: payslips.Sum(x => x.InsuranceDeduction ?? 0m),
            TotalTax: payslips.Sum(x => x.TaxDeduction ?? 0m),
            TotalNetPay: payslips.Sum(x => x.NetPay ?? 0m),
            LastCalculatedAt: calcLogs.FirstOrDefault()?.CreatedAt,
            LockedAt: periodLock.LockedAt,
            LockedByName: lockedByName
        );
    }

    private static bool MatchLockFilter(PayrollLock periodLock, PayrollHistoryFilter filter)
    {
        if (!string.IsNullOrWhiteSpace(filter.FromMonth) &&
            string.CompareOrdinal(periodLock.PayMonth, filter.FromMonth.Trim()) < 0)
            return false;

        if (!string.IsNullOrWhiteSpace(filter.ToMonth) &&
            string.CompareOrdinal(periodLock.PayMonth, filter.ToMonth.Trim()) > 0)
            return false;

        var statusFilter = filter.Status?.Trim().ToLowerInvariant();
        if (!string.IsNullOrEmpty(statusFilter) && statusFilter != "all")
        {
            var lockStatus = periodLock.Status?.Trim().ToLowerInvariant() ?? "draft";
            if (lockStatus != statusFilter) return false;
        }

        return true;
    }

    private static void ValidateOptionalMonth(string? month)
    {
        if (!string.IsNullOrWhiteSpace(month) && !MonthRegex.IsMatch(month.Trim()))
        {
            throw new AppException(400, "Định dạng tháng lọc không hợp lệ (YYYY-MM).");
        }
    }

    private static string MapActionLabel(string action) => action.ToLowerInvariant() switch
    {
        "create" => "Khởi tạo kỳ lương",
        "calculate" => "Chạy tính lương",
        "review_all_valid" => "Duyệt nhanh tất cả phiếu hợp lệ",
        "confirm" => "Xác nhận bảng lương",
        "finalize" => "Chốt & phát hành phiếu lương",
        "reopen" => "Mở lại kỳ lương",
        _ => action
    };

    private static string MapStatusLabel(string status) => status switch
    {
        "finalized" => "Da chot",
        "locked" => "Da khoa",
        "approved" => "Da xac nhan",
        "pending_approval" => "Cho duyet",
        _ => "Ban nhap"
    };

    private static string? ExtractAuditSummary(string? newValueJson)
    {
        if (string.IsNullOrWhiteSpace(newValueJson)) return null;
        try
        {
            using var doc = JsonDocument.Parse(newValueJson);
            if (doc.RootElement.TryGetProperty("Reason", out var reasonEl) &&
                reasonEl.ValueKind == JsonValueKind.String)
            {
                return $"Lý do: {reasonEl.GetString()}";
            }
            if (doc.RootElement.TryGetProperty("Note", out var noteEl) &&
                noteEl.ValueKind == JsonValueKind.String &&
                !string.IsNullOrWhiteSpace(noteEl.GetString()))
            {
                return noteEl.GetString();
            }
        }
        catch (JsonException)
        {
            // Bỏ qua nếu JSON log không có trường mô tả
        }
        return null;
    }

    private static string Csv(string value)
    {
        var safe = value.Replace("\"", "\"\"");
        return $"\"{safe}\"";
    }
}
