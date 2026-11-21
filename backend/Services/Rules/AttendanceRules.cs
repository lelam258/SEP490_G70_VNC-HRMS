using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Vnc.HRMS.Common.Exceptions;
using Vnc.HRMS.DTOs.Attendance;

namespace Vnc.HRMS.Services.Rules;

public static class AttendanceRules
{
    public static (DateOnly Start, DateOnly End) Month(string? month)
    {
        if (!DateOnly.TryParseExact(month + "-01", "yyyy-MM-dd", CultureInfo.InvariantCulture,
            DateTimeStyles.None, out var start) || start.Year < 2000 || start.Year >= 9999)
            throw new AppException(400, "Tháng phải có định dạng YYYY-MM và nằm trong khoảng 2000–9998.");
        return (start, start.AddMonths(1).AddDays(-1));
    }

    public static string Text(string? value, string field, bool required = false, int maximum = 1000)
    {
        var text = value?.Trim() ?? "";
        if ((required && text.Length == 0) || text.Length > maximum)
            throw new AppException(400, $"{field}{(required ? " là bắt buộc và" : "")} tối đa {maximum} ký tự.");
        return text;
    }

    public static string Fold(string text)
    {
        var value = new string(text.Normalize(NormalizationForm.FormD)
            .Where(c => CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark).ToArray());
        return value.ToLowerInvariant().Replace('đ', 'd');
    }
    public static string Key(string text) => Regex.Replace(Fold(text), "[^a-z0-9]", "");
    public static string DeviceKey(string value)
    {
        var key = value.Trim();
        return Regex.IsMatch(key, "^[0-9]+$") ? key.TrimStart('0') is { Length: > 0 } digits ? digits : "0" : key.ToUpperInvariant();
    }

    public static decimal Hours(IReadOnlyList<AttendanceTimePair> pairs, DateOnly date)
    {
        if (pairs.Count is < 1 or > 3 || pairs.Any(p => p.In is null || p.Out is null))
            throw new AppException(400, "Cần từ một đến ba cặp Vào/Ra đầy đủ.");
        DateTime? previousEnd = null;
        decimal hours = 0;
        foreach (var pair in pairs) {
            var start = pair.In!.Value;
            var end = pair.Out!.Value;
            if (DateOnly.FromDateTime(start) != date || DateOnly.FromDateTime(end) != date || end <= start)
                throw new AppException(400, "Giờ ra phải sau giờ vào và trong cùng ngày làm việc.");
            if (previousEnd > start) throw new AppException(400, "Các cặp Vào/Ra bị trùng hoặc không theo thứ tự thời gian.");
            previousEnd = end;
            hours += (decimal)(end - start).TotalHours;
        }
        return Math.Round(hours, 2, MidpointRounding.AwayFromZero);
    }

    public static AttendanceTimePair[] Pairs(DateOnly date, TimePairInput[]? inputs)
    {
        if (inputs is null || inputs.Length is < 1 or > 3) throw new AppException(400, "Cần từ một đến ba cặp Vào/Ra.");
        DateTime? Parse(string? value) => TimeOnly.TryParseExact(value, ["HH:mm", "H:mm", "HH:mm:ss"],
            CultureInfo.InvariantCulture, DateTimeStyles.None, out var time) ? date.ToDateTime(time) : null;
        var pairs = inputs.Select(p => new AttendanceTimePair(Parse(p.In), Parse(p.Out))).ToArray();
        Hours(pairs, date);
        return pairs;
    }

    public static (decimal Hours, bool RepeatedPairs) ImportHours(IReadOnlyList<AttendanceTimePair> pairs, DateOnly date)
    {
        // Some approved device reports repeat exactly the same punches for multiple configured shifts.
        // Keep all source pairs; only their elapsed-hours calculation counts each identical interval once.
        if (pairs.Count is < 1 or > 3) return (Hours(pairs, date), false);
        var unique = pairs.Distinct().ToArray();
        return (Hours(unique, date), unique.Length != pairs.Count);
    }

    public static string Version(object value) => Convert.ToHexString(SHA256.HashData(JsonSerializer.SerializeToUtf8Bytes(value)));
    public static void RequireVersion(byte[] actual, string? expected)
    {
        if (string.IsNullOrWhiteSpace(expected) || !string.Equals(Convert.ToBase64String(actual), expected, StringComparison.Ordinal))
            throw new AppException(409, "Dữ liệu đã được cập nhật. Hãy tải lại trước khi tiếp tục.");
    }

    public static string Csv(string? value)
    {
        var cell = value ?? "";
        if (cell.TrimStart().StartsWith('=') || cell.TrimStart().StartsWith('+') || cell.TrimStart().StartsWith('-') || cell.TrimStart().StartsWith('@')) cell = "'" + cell;
        return "\"" + cell.Replace("\"", "\"\"") + "\"";
    }
}
