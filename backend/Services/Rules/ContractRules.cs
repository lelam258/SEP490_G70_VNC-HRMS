using Vnc.HRMS.Common.Exceptions;

namespace Vnc.HRMS.Services.Rules;

/// <summary>Pure rules for the employment contract lifecycle shown to HR.</summary>
public static class ContractRules
{
    public const string Indefinite = "Hợp đồng không xác định thời hạn";
    public const string FixedTerm = "Hợp đồng xác định thời hạn";
    public const string Probation = "Hợp đồng thử việc";

    /// <summary>Days before the end date at which a contract counts as expiring.</summary>
    public const int ExpiringWithinDays = 30;

    /// <summary>
    /// Status shown on screen, derived from the stored status and the contract dates:
    /// inactive, upcoming, expired, expiring or active.
    /// </summary>
    public static string DisplayStatus(string status, DateOnly from, DateOnly? to, DateOnly today)
    {
        if (!string.Equals(status, PayrollParameterRules.Active, StringComparison.OrdinalIgnoreCase)) return "inactive";
        if (from > today) return "upcoming";
        if (to is { } end && end < today) return "expired";
        if (to is { } soon && soon <= today.AddDays(ExpiringWithinDays)) return "expiring";
        return "active";
    }

    /// <summary>A contract without a fixed term ("không xác định thời hạn") never has an end date.</summary>
    public static bool IsIndefinite(string contractType)
        => contractType.Contains("không xác định", StringComparison.OrdinalIgnoreCase);

    /// <summary>Validates the contract term against its type.</summary>
    public static void EnsureTerm(string contractType, DateOnly from, DateOnly? to)
    {
        PayrollParameterRules.EnsureEffectiveRange(from, to);
        if (IsIndefinite(contractType) && to is not null)
            throw new AppException(400, "Hợp đồng không xác định thời hạn không có ngày kết thúc.", "effectiveTo");
        if (!IsIndefinite(contractType) && to is null)
            throw new AppException(400, "Hợp đồng có thời hạn phải có ngày kết thúc.", "effectiveTo");
    }

    /// <summary>Daily rate and monthly salary derived from the agreed base salary, as compensation settings do.</summary>
    public static (decimal DailyRate, decimal MonthlySalary) SalaryFromBase(string salaryType, decimal baseSalary, decimal standardWorkingDays)
    {
        if (baseSalary <= 0) throw new AppException(400, "Mức lương cơ bản phải lớn hơn 0.", "baseSalary");
        PayrollParameterRules.EnsureMoney(baseSalary, "Mức lương cơ bản");
        if (standardWorkingDays is <= 0 or > 31) throw new AppException(400, "Số ngày công chuẩn phải nằm trong khoảng từ 1 đến 31.", "standardWorkingDays");
        return salaryType == "daily"
            ? (baseSalary, baseSalary * standardWorkingDays)
            : (Math.Round(baseSalary / standardWorkingDays, 2), baseSalary);
    }
}
