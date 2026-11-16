using Vnc.HRMS.Common.Exceptions;
using Vnc.HRMS.Models;
using System.Security.Cryptography;
using System.Text.Json;
namespace Vnc.HRMS.Services;

public static class ScheduleRules
{
    // Existing audit entries use this prefix; keep it stable when changing display text.
    public const string ReopenAuditPrefix = "HR Staff mở lại lịch tuần để sửa sai: ";
    public static readonly string[] Shifts = ["morning", "noon", "afternoon", "evening"];
    public static DateOnly Today => DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7));
    public static DateOnly Monday(DateOnly date) => date.AddDays(-(((int)date.DayOfWeek + 6) % 7));
    public static bool IsDuty(string shift) => shift is "noon" or "evening";
    public static string AssignmentVersion(ScheduleAssignment item)
    {
        var snapshot = JsonSerializer.SerializeToUtf8Bytes(new {
            item.Id, item.WeekId, item.StaffId, item.CoverageId, item.Date, item.Shift,
            item.Reason, item.TransferConsent, item.Cancelled, item.PatientConfirmed,
            item.PatientEvidence, item.ConfirmedBy, item.ConfirmedAt,
            actualEndAt = item.ActualEndAt?.ToUniversalTime(),
            item.EndNote, item.EndRecordedBy, item.EndRecordedAt
        });
        return Convert.ToHexString(SHA256.HashData(snapshot));
    }
    public static void CheckAssignmentVersion(ScheduleAssignment item, string? expected)
    {
        // Older API clients may omit the token; current UI sends it for existing assignments.
        if (expected is not null && !string.Equals(expected, AssignmentVersion(item), StringComparison.Ordinal))
            throw new AppException(409, "Phân công đã được cập nhật. Hãy tải lại lịch trước khi thực hiện thay đổi.");
    }
    public static string ShiftName(string shift) => shift switch {
        "morning" => "Sáng", "noon" => "Trực trưa", "afternoon" => "Chiều", "evening" => "Trực tối", _ => shift
    };
    public static (DateOnly Date, string Shift)[] ExpandWeek(DateOnly monday, int[]? days, string[]? shifts)
    {
        if (monday != Monday(monday)) throw new AppException(400, "Tuần phải bắt đầu vào thứ Hai.");
        if (days is null || days.Length == 0 || days.Length > 7 || days.Any(x => x < 0 || x > 6) || days.Distinct().Count() != days.Length)
            throw new AppException(400, "Chọn ít nhất một ngày, từ thứ Hai đến Chủ nhật, không lặp ngày.");
        if (shifts is null || shifts.Length == 0 || shifts.Length > 4 || shifts.Any(x => !Shifts.Contains(x)) || shifts.Distinct().Count() != shifts.Length)
            throw new AppException(400, "Chọn ít nhất một ca hợp lệ, không lặp ca.");
        return days.Order().SelectMany(day => Shifts.Where(shifts.Contains).Select(shift => (monday.AddDays(day), shift))).ToArray();
    }
    public static (TimeOnly Start, TimeOnly End) Hours(DateOnly date, string shift)
    {
        var summer = date >= new DateOnly(date.Year, 4, 15) && date < new DateOnly(date.Year, 12, 1);
        return shift switch {
            "morning" => (new(7, summer ? 0 : 10), new(11, summer ? 30 : 45)),
            "noon" => (new(11, summer ? 30 : 45), new(13, 30)),
            "afternoon" => (new(13, 30), new(17, 0)),
            "evening" => (new(17, 0), new(19, 0)),
            _ => throw new AppException(400, "Ca làm việc không hợp lệ.")
        };
    }
    private static void ValidateWeek(DateOnly monday)
    {
        if (monday != Monday(monday) || monday.DayNumber < 7 || monday.DayNumber > DateOnly.MaxValue.DayNumber - 7)
            throw new AppException(400, "Tuần phải bắt đầu vào thứ Hai và nằm trong khoảng ngày hợp lệ.");
    }
    public static DateTimeOffset PlanningStart(DateOnly monday)
    {
        ValidateWeek(monday);
        return new(monday.AddDays(-7).ToDateTime(TimeOnly.MinValue), TimeSpan.FromHours(7));
    }
    public static DateTimeOffset PublishDeadline(DateOnly monday)
    {
        ValidateWeek(monday);
        return new(monday.ToDateTime(TimeOnly.MinValue), TimeSpan.FromHours(7));
    }
    public static DateTimeOffset CorrectionEnd(DateOnly monday)
    {
        ValidateWeek(monday);
        return new(monday.AddDays(7).ToDateTime(TimeOnly.MinValue), TimeSpan.FromHours(7));
    }
    public static void Editable(DateOnly monday, DateTimeOffset now, bool isCorrection = false)
    {
        var start = PlanningStart(monday);
        var end = isCorrection ? CorrectionEnd(monday) : PublishDeadline(monday);
        if (now < start || now >= end)
            throw new AppException(400, isCorrection
                ? "Chỉ điều chỉnh lịch đã mở lại từ tuần trước đến hết Chủ nhật của tuần làm việc."
                : "Lập và chốt lịch cho tuần kế tiếp từ thứ Hai tuần trước, trước 00:00 thứ Hai của tuần được phân công.");
    }
    public static DateTimeOffset ShiftStart(DateOnly date, string shift)
        => new(date.ToDateTime(Hours(date, shift).Start), TimeSpan.FromHours(7));

    public static void ValidateAffectedShift(DateOnly date, string shift, DateTimeOffset now)
    {
        var start = ShiftStart(date, shift);
        if (now >= PublishDeadline(Monday(date)) && start - now < TimeSpan.FromHours(24))
            throw new AppException(400, $"Ngày {date:dd/MM/yyyy}, ca {ShiftName(shift)}: Ca bị ảnh hưởng phải bắt đầu ít nhất 24 giờ sau khi lưu thay đổi.");
    }

    public static bool SamePlan(ScheduleAssignment left, ScheduleAssignment right)
        => left.WeekId == right.WeekId && left.StaffId == right.StaffId && left.CoverageId == right.CoverageId
            && left.Date == right.Date && left.Shift == right.Shift && left.Cancelled == right.Cancelled
            && left.Reason == right.Reason && left.TransferConsent == right.TransferConsent;
    public static void Reopenable(DateOnly monday, DateTimeOffset now)
    {
        if (now < PlanningStart(monday) || now >= CorrectionEnd(monday))
            throw new AppException(400, "Chỉ mở lại lịch đã chốt từ tuần trước đến hết Chủ nhật của tuần làm việc.");
    }
    private static DateTimeOffset DutyStart(DateOnly date, string shift)
    {
        if (!IsDuty(shift)) throw new AppException(400, "Chỉ áp dụng cho ca trực trưa hoặc trực tối.");
        return new DateTimeOffset(date.ToDateTime(Hours(date, shift).Start), TimeSpan.FromHours(7));
    }
    public static void ValidateDutyStarted(DateOnly date, string shift, DateTimeOffset now)
    {
        if (now < DutyStart(date, shift))
            throw new AppException(400, "Ca trực chưa bắt đầu. Chỉ xác nhận phục vụ bệnh nhân từ giờ bắt đầu ca trực.");
    }
    public static void ValidateDutyEnd(DateOnly date, string shift, DateTimeOffset endedAt, DateTimeOffset now)
    {
        var start = DutyStart(date, shift);
        if (endedAt < start || endedAt > now)
            throw new AppException(400, "Giờ kết thúc phải từ lúc bắt đầu ca đến thời điểm hiện tại.");
        if (DateOnly.FromDateTime(endedAt.ToOffset(TimeSpan.FromHours(7)).DateTime) != date)
            throw new AppException(400, "Giờ kết thúc phải trong ngày trực (không có ca qua đêm).");
    }
}
