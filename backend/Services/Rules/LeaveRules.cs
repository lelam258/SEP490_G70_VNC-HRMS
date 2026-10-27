using Vnc.HRMS.Common.Exceptions;
using Vnc.HRMS.Common.Utils;

namespace Vnc.HRMS.Services.Rules;

public static class LeaveRules
{
    private static readonly HashSet<string> ValidLeaveTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "annual",
        "personal_paid",
        "sick",
        "maternity",
        "unpaid",
        "other"
    };

    public static void ValidateLeaveType(string? leaveType)
    {
        if (string.IsNullOrWhiteSpace(leaveType) || !ValidLeaveTypes.Contains(leaveType.Trim()))
        {
            throw new AppException(400, "Loại nghỉ phép không hợp lệ.");
        }
    }

    public static void ValidateDates(DateOnly startDate, DateOnly endDate, DateOnly? today = null)
    {
        if (endDate < startDate)
        {
            throw new AppException(400, "Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu.");
        }

        var todayVn = today ?? TimeHelper.TodayInVietnam();
        if (startDate < todayVn)
        {
            throw new AppException(400, "Ngày bắt đầu nghỉ không được ở trong quá khứ.");
        }
    }

    public static decimal CountWorkingDays(DateOnly startDate, DateOnly endDate, DateOnly? today = null)
    {
        ValidateDates(startDate, endDate, today);

        decimal days = 0;
        var current = startDate;
        while (current <= endDate)
        {
            if (current.DayOfWeek != DayOfWeek.Sunday)
            {
                days += 1m;
            }
            current = current.AddDays(1);
        }

        if (days <= 0)
        {
            throw new AppException(400, "Khoảng thời gian đã chọn không có ngày làm việc.");
        }

        return days;
    }

    public static string ValidateAndNormalizeReason(string? reason)
    {
        var trimmed = reason?.Trim() ?? string.Empty;
        if (trimmed.Length < 10 || trimmed.Length > 500)
        {
            throw new AppException(400, "Lý do nghỉ phép phải từ 10 đến 500 ký tự.");
        }
        return trimmed;
    }
}
