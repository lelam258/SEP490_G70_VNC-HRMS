namespace Vnc.HRMS.Services.Rules;

/// <summary>
/// Fallback payroll values, used only when the matching system policy or parameter is not configured.
/// Every configurable value has its default here so no other code carries its own literal.
/// </summary>
public static class PayrollDefaults
{
    public const decimal PersonalDeduction = 15_500_000m;
    public const decimal DependentDeduction = 6_200_000m;
    public const decimal FlatTaxThreshold = 5_000_000m;
    public const decimal FlatTaxRatePercent = 10m;
    public const decimal RoundingUnit = 1_000m;
    public const decimal UnionFee = 100_000m;

    /// <summary>8% social + 1.5% health + 1% unemployment insurance paid by the employee.</summary>
    public const decimal EmployeeInsuranceRatePercent = 10.5m;

    public const decimal StandardWorkingDays = 26m;

    public const bool DeductInsuranceBeforeTax = true;
    public const bool DeductUnionFeeBeforeTax = true;
    public const bool DeductOtherBeforeTax = false;
    public const string FlatTaxBase = "gross";

    /// <summary>Monthly progressive PIT brackets used when none are configured.</summary>
    public static readonly IReadOnlyList<TaxBracketItem> TaxBrackets =
    [
        new(1, 0m, 10_000_000m, 5m),
        new(2, 10_000_000m, 30_000_000m, 10m),
        new(3, 30_000_000m, 60_000_000m, 20m),
        new(4, 60_000_000m, 100_000_000m, 30m),
        new(5, 100_000_000m, null, 35m),
    ];
}
