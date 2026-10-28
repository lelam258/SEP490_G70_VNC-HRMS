using Vnc.HRMS.Common.Exceptions;

namespace Vnc.HRMS.Services.Rules;

/// <summary>
/// Pure validation and business rules for payroll parameters (UC-05).
/// No I/O: every method takes plain values so it can be unit tested directly.
/// Violations are reported as <see cref="AppException"/> with a Vietnamese message.
/// </summary>
public static class PayrollParameterRules
{
    public const string Active = "active";
    public const string Inactive = "inactive";

    public static readonly IReadOnlyList<string> Statuses = [Active, Inactive];
    public static readonly IReadOnlyList<string> AllowanceValueTypes = ["fixed", "percentage"];
    public static readonly IReadOnlyList<string> InsuranceTypes = ["social", "health", "unemployment", "accident"];
    public static readonly IReadOnlyList<string> InsurancePayers = ["employee", "employer"];
    public static readonly IReadOnlyList<string> CommissionRoles = ["indicating", "performing", "assisting"];
    public static readonly IReadOnlyList<string> CommissionValueTypes = ["fixed", "percent_service", "percent_profit"];

    /// <summary>Earliest accepted effective date; also rejects an omitted DateOnly (0001-01-01).</summary>
    public static readonly DateOnly MinEffectiveDate = new(2000, 1, 1);
    public const decimal MaxMoney = 9_999_999_999_999.99m; // decimal(15,2)

    // ---------- Normalization ----------

    public static string NormalizeStatus(string? value)
    {
        var status = string.IsNullOrWhiteSpace(value) ? Active : value.Trim().ToLowerInvariant();
        if (!Statuses.Contains(status)) throw new AppException(400, "Trạng thái chỉ được là active hoặc inactive.");
        return status;
    }

    public static string NormalizeCode(string? value, int maxLength = 30)
    {
        if (string.IsNullOrWhiteSpace(value)) throw new AppException(400, "Mã là bắt buộc.");
        var code = value.Trim().ToUpperInvariant();
        if (code.Length > maxLength) throw new AppException(400, $"Mã tối đa {maxLength} ký tự.");
        return code;
    }

    public static string RequireText(string? value, string field, int maxLength)
    {
        if (string.IsNullOrWhiteSpace(value)) throw new AppException(400, $"{field} là bắt buộc.");
        var text = value.Trim();
        if (text.Length > maxLength) throw new AppException(400, $"{field} tối đa {maxLength} ký tự.");
        return text;
    }

    public static string OptionalText(string? value, string field, int maxLength, string fallback)
    {
        if (string.IsNullOrWhiteSpace(value)) return fallback;
        var text = value.Trim();
        if (text.Length > maxLength) throw new AppException(400, $"{field} tối đa {maxLength} ký tự.");
        return text;
    }

    public static string RequireOption(string? value, IReadOnlyList<string> options, string field)
    {
        var option = value?.Trim().ToLowerInvariant() ?? string.Empty;
        if (!options.Contains(option)) throw new AppException(400, $"{field} không hợp lệ. Giá trị cho phép: {string.Join(", ", options)}.");
        return option;
    }

    // ---------- Values ----------

    public static void EnsureMoney(decimal value, string field)
    {
        if (value < 0) throw new AppException(400, $"{field} không được âm.");
        if (value > MaxMoney) throw new AppException(400, $"{field} vượt quá giới hạn cho phép.");
    }

    public static void EnsurePercent(decimal value, string field)
    {
        if (value is < 0 or > 100) throw new AppException(400, $"{field} phải nằm trong khoảng 0–100%.");
    }

    /// <summary>Fixed values are VND amounts; any percentage type is limited to 0–100.</summary>
    public static void EnsureTypedValue(string valueType, decimal value, string field)
    {
        if (valueType == "fixed") EnsureMoney(value, field);
        else EnsurePercent(value, field);
    }

    public static void EnsureEffectiveRange(DateOnly from, DateOnly? to)
    {
        if (from < MinEffectiveDate) throw new AppException(400, "Ngày bắt đầu hiệu lực là bắt buộc và phải từ năm 2000 trở đi.");
        if (to is not null && to < from) throw new AppException(400, "Ngày kết thúc hiệu lực phải sau hoặc bằng ngày bắt đầu.");
    }

    public static void EnsureTaxBracket(decimal incomeFrom, decimal? incomeTo, decimal ratePercent)
    {
        EnsureMoney(incomeFrom, "Thu nhập từ");
        if (incomeTo is not null)
        {
            EnsureMoney(incomeTo.Value, "Thu nhập đến");
            if (incomeTo <= incomeFrom) throw new AppException(400, "Thu nhập đến phải lớn hơn thu nhập từ.");
        }
        EnsurePercent(ratePercent, "Thuế suất");
    }

    // ---------- Ranges ----------

    /// <summary>Inclusive date ranges; a null end means open-ended.</summary>
    public static bool PeriodsOverlap(DateOnly aFrom, DateOnly? aTo, DateOnly bFrom, DateOnly? bTo)
        => aFrom <= (bTo ?? DateOnly.MaxValue) && bFrom <= (aTo ?? DateOnly.MaxValue);

    /// <summary>Half-open income ranges [from, to); a null upper bound means unlimited.</summary>
    public static bool IncomeRangesOverlap(decimal aFrom, decimal? aTo, decimal bFrom, decimal? bTo)
        => aFrom < (bTo ?? decimal.MaxValue) && bFrom < (aTo ?? decimal.MaxValue);

    /// <summary>True when [innerFrom, innerTo] lies inside [outerFrom, outerTo].</summary>
    public static bool PeriodWithin(DateOnly innerFrom, DateOnly? innerTo, DateOnly outerFrom, DateOnly? outerTo)
        => innerFrom >= outerFrom && (outerTo is null || (innerTo is not null && innerTo <= outerTo));

    // ---------- Locked payroll periods ----------

    /// <summary>Parses a pay month in "yyyy-MM" format; returns null if malformed.</summary>
    public static DateOnly? MonthStart(string payMonth)
        => DateOnly.TryParseExact(payMonth + "-01", "yyyy-MM-dd", out var start) ? start : null;

    /// <summary>Locked months (yyyy-MM, sorted) whose calendar month intersects the given period.</summary>
    public static IReadOnlyList<string> LockedMonthsCovered(IEnumerable<string> lockedMonths, DateOnly from, DateOnly? to)
        => lockedMonths
            .Select(month => (month, start: MonthStart(month)))
            .Where(x => x.start is not null && PeriodsOverlap(from, to, x.start.Value, x.start.Value.AddMonths(1).AddDays(-1)))
            .Select(x => x.month).Distinct().OrderBy(x => x, StringComparer.Ordinal).ToArray();

    /// <summary>Unfinalized open months (yyyy-MM, sorted) whose calendar month intersects the given period.</summary>
    public static IReadOnlyList<string> AffectedOpenPeriods(IEnumerable<string> openMonths, DateOnly? from, DateOnly? to)
    {
        if (from is null)
        {
            return openMonths.Distinct().OrderBy(x => x, StringComparer.Ordinal).ToArray();
        }

        return openMonths
            .Select(month => (month, start: MonthStart(month)))
            .Where(x => x.start is not null && PeriodsOverlap(from.Value, to, x.start.Value, x.start.Value.AddMonths(1).AddDays(-1)))
            .Select(x => x.month)
            .Distinct()
            .OrderBy(x => x, StringComparer.Ordinal)
            .ToArray();
    }

    /// <summary>
    /// Locked-period rule shared by every dated parameter, staff allowance and contract compensation.
    /// <list type="bullet">
    /// <item>Create (<paramref name="original"/> is null): the new period must not touch any locked month.</item>
    /// <item>Update: the record must not start covering a locked month it did not already cover.</item>
    /// <item>Update of a record already covering locked months: values and start date are frozen,
    /// inactive → active is blocked, and the end date may be set or shortened but not before the
    /// last day of the latest locked month it covers.</item>
    /// </list>
    /// </summary>
    public static void EnsureLockedPeriodRule(
        IReadOnlyCollection<string> lockedMonths,
        LockedPeriodState? original,
        LockedPeriodState updated,
        bool valuesChanged)
    {
        var newlyCovered = LockedMonthsCovered(lockedMonths, updated.From, updated.To);
        if (original is null)
        {
            if (newlyCovered.Count > 0) throw LockedError(newlyCovered[^1]);
            return;
        }

        var covered = LockedMonthsCovered(lockedMonths, original.From, original.To);
        var added = newlyCovered.Except(covered).ToArray();
        if (added.Length > 0) throw LockedError(added[^1]);
        if (covered.Count == 0) return;

        var latest = covered[^1];
        if (valuesChanged || updated.From != original.From) throw LockedError(latest);
        if (original.Status == Inactive && updated.Status == Active)
            throw new AppException(409, $"Không thể kích hoạt lại bản ghi đã phủ kỳ lương đã khóa ({latest}). Hãy tạo bản ghi mới với ngày hiệu lực mới.");
        var lastDay = MonthStart(latest)!.Value.AddMonths(1).AddDays(-1);
        if (updated.To is not null && updated.To < lastDay)
            throw new AppException(409, $"Ngày kết thúc hiệu lực không được trước {lastDay:dd/MM/yyyy} vì kỳ lương {latest} đã khóa.");
    }

    private static AppException LockedError(string month)
        => new(409, $"Khoảng hiệu lực giao với kỳ lương đã khóa ({month}). Hãy tạo bản ghi mới với ngày hiệu lực mới.");
}

/// <summary>Effective period and status of a record, as used by the locked-period rule.</summary>
public sealed record LockedPeriodState(DateOnly From, DateOnly? To, string Status);
