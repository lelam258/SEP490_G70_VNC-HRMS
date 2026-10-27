namespace Vnc.HRMS.Common.Utils;

/// <summary>
/// Helper for handling date and time in Vietnam timezone (UTC+7).
/// </summary>
public static class TimeHelper
{
    public static readonly TimeSpan VietnamOffset = TimeSpan.FromHours(7);

    /// <summary>
    /// Returns current date and time in Vietnam timezone (UTC+7).
    /// </summary>
    public static DateTimeOffset NowInVietnam(DateTimeOffset? utcNow = null)
        => (utcNow ?? DateTimeOffset.UtcNow).ToOffset(VietnamOffset);

    /// <summary>
    /// Returns current calendar date in Vietnam timezone (UTC+7).
    /// </summary>
    public static DateOnly TodayInVietnam(DateTimeOffset? utcNow = null)
        => DateOnly.FromDateTime(NowInVietnam(utcNow).Date);
}
