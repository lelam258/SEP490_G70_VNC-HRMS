namespace Vnc.HRMS.Services.Rules;

/// <summary>
/// Input data for pure payroll & PIT tax calculation.
/// </summary>
public sealed record PayrollFormulaInput(
    decimal TotalIncome,
    decimal InsuranceSalary,
    bool IsUnionMember,
    int DependentCount,
    string TaxMethod = "progressive",
    decimal OtherDeductions = 0,
    decimal InsuranceEmployeeRatePercent = PayrollDefaults.EmployeeInsuranceRatePercent,
    decimal UnionFeeFixed = PayrollDefaults.UnionFee,
    decimal PersonalDeduction = PayrollDefaults.PersonalDeduction,
    decimal DependentDeduction = PayrollDefaults.DependentDeduction,
    decimal FlatThreshold = PayrollDefaults.FlatTaxThreshold,
    decimal FlatRatePercent = PayrollDefaults.FlatTaxRatePercent,
    decimal RoundingUnit = PayrollDefaults.RoundingUnit,
    bool DeductInsuranceBeforeTax = PayrollDefaults.DeductInsuranceBeforeTax,
    bool DeductUnionFeeBeforeTax = PayrollDefaults.DeductUnionFeeBeforeTax,
    bool DeductOtherBeforeTax = PayrollDefaults.DeductOtherBeforeTax,
    string FlatTaxBase = PayrollDefaults.FlatTaxBase,
    IReadOnlyList<TaxBracketItem>? Brackets = null);

public sealed record TaxBracketItem(
    int BracketIndex,
    decimal IncomeFrom,
    decimal? IncomeTo,
    decimal TaxRatePercent);

public sealed record TaxBracketBreakdownItem(
    int BracketIndex,
    string RangeText,
    decimal TaxableAmount,
    decimal RatePercent,
    decimal TaxAmount);

public sealed record PayrollFormulaResult(
    decimal Step1_TotalIncome,
    decimal Step2_BeforeTaxDeduction,
    decimal Step2_InsuranceDeduction,
    decimal Step2_UnionFeeDeduction,
    decimal Step2_OtherBeforeTaxDeduction,
    decimal Step3_IncomeAfterDeductions,
    decimal Step4_TaxableIncome,
    decimal Step4_PersonalDeductionAmount,
    decimal Step4_DependentDeductionAmount,
    decimal Step4_TotalFamilyDeductions,
    string? Step4_Note,
    decimal Step5_PitTax,
    string Step5_TaxMethod,
    IReadOnlyList<TaxBracketBreakdownItem> Step5_BracketBreakdowns,
    string? Step5_Note,
    decimal Step6_TakeHome,
    decimal Step6_TakeHomeRaw,
    decimal Step6_RoundingUnit);

/// <summary>
/// Pure static formula engine for payroll and PIT calculations (Phòng khám VNC).
/// Single source of truth across Iteration 1 (Parameter Preview) and Iteration 2 (Payroll Engine).
/// </summary>
public static class PayrollFormula
{
    /// <summary>
    /// Executes the standard 6-step payroll & PIT calculation.
    /// All intermediate steps maintain decimal precision without premature rounding.
    /// Only Step 6 is rounded using MidpointRounding.AwayFromZero (matching Excel ROUND).
    /// </summary>
    public static PayrollFormulaResult Calculate(PayrollFormulaInput input)
    {
        // -------------------------------------------------------------
        // (1) Tổng thu nhập
        // -------------------------------------------------------------
        decimal totalIncome = input.TotalIncome;

        // -------------------------------------------------------------
        // (2) Khoản trừ trước thuế
        // -------------------------------------------------------------
        decimal insuranceDeduction = 0m;
        if (input.DeductInsuranceBeforeTax && input.InsuranceSalary > 0m && input.InsuranceEmployeeRatePercent > 0m)
        {
            insuranceDeduction = input.InsuranceSalary * (input.InsuranceEmployeeRatePercent / 100m);
        }

        decimal unionFeeDeduction = 0m;
        if (input.DeductUnionFeeBeforeTax && input.IsUnionMember)
        {
            unionFeeDeduction = input.UnionFeeFixed;
        }

        decimal otherBeforeTaxDeduction = 0m;
        // Reserved for future before-tax other deductions when confirmed by clinic

        decimal beforeTaxTotal = insuranceDeduction + unionFeeDeduction + otherBeforeTaxDeduction;

        // -------------------------------------------------------------
        // (3) Thu nhập sau trừ = (1) - (2)
        // -------------------------------------------------------------
        decimal incomeAfterDeductions = totalIncome - beforeTaxTotal;

        // -------------------------------------------------------------
        // (4) Thu nhập tính thuế & (5) Thuế TNCN
        // -------------------------------------------------------------
        decimal taxableIncome = 0m;
        decimal personalDeductionAmount = 0m;
        decimal dependentDeductionAmount = 0m;
        decimal totalFamilyDeductions = 0m;
        string? taxableIncomeNote = null;
        decimal pitTax = 0m;
        string? taxNote = null;
        var breakdowns = new List<TaxBracketBreakdownItem>();

        string method = input.TaxMethod?.ToLowerInvariant() == "flat_10" ? "flat_10" : "progressive";

        if (method == "flat_10")
        {
            // Flat tax method (10% flat rate)
            decimal flatBase = (input.FlatTaxBase?.ToLowerInvariant() == "after_deductions")
                ? incomeAfterDeductions
                : totalIncome;

            string baseName = (input.FlatTaxBase?.ToLowerInvariant() == "after_deductions")
                ? "Thu nhập sau trừ"
                : "Tổng thu nhập";

            if (flatBase >= input.FlatThreshold)
            {
                taxableIncome = flatBase;
                pitTax = flatBase * (input.FlatRatePercent / 100m);
                taxNote = $"Khấu trừ {input.FlatRatePercent:0.#}% trên {baseName} (≥ ngưỡng {input.FlatThreshold:N0} ₫ theo NĐ 253/2026/NĐ-CP).";
                breakdowns.Add(new TaxBracketBreakdownItem(
                    1,
                    $"Cơ sở {baseName} (≥ {input.FlatThreshold:N0} ₫)",
                    flatBase,
                    input.FlatRatePercent,
                    pitTax));
            }
            else
            {
                taxableIncome = 0m;
                pitTax = 0m;
                taxNote = $"Không khấu trừ thuế vì cơ sở tính thuế ({flatBase:N0} ₫) dưới ngưỡng {input.FlatThreshold:N0} ₫ (Nghị định 253/2026/NĐ-CP).";
            }

            taxableIncomeNote = "Không áp dụng giảm trừ gia cảnh đối với phương pháp khấu trừ 10%.";
        }
        else
        {
            // Progressive tax method (Biểu lũy tiến từng phần 5 bậc)
            personalDeductionAmount = input.PersonalDeduction;
            dependentDeductionAmount = Math.Max(0, input.DependentCount) * input.DependentDeduction;
            totalFamilyDeductions = personalDeductionAmount + dependentDeductionAmount;

            decimal taxableRaw = incomeAfterDeductions - totalFamilyDeductions;

            if (taxableRaw <= 0m)
            {
                // GB-23: Thu nhập tính thuế = 0 và thuế = 0 khi thu nhập sau trừ <= tổng giảm trừ
                taxableIncome = 0m;
                taxableIncomeNote = "Thu nhập tính thuế bằng 0 do thu nhập sau trừ không vượt quá tổng giảm trừ gia cảnh (GB-23).";
                pitTax = 0m;
                taxNote = "Thuế TNCN bằng 0 khi thu nhập tính thuế ≤ 0 (GB-23).";
            }
            else
            {
                taxableIncome = taxableRaw;

                var brackets = (input.Brackets != null && input.Brackets.Count > 0)
                    ? input.Brackets.OrderBy(b => b.IncomeFrom).ToList()
                    : PayrollDefaults.TaxBrackets;

                decimal accumulatedTax = 0m;
                foreach (var b in brackets)
                {
                    if (taxableRaw <= b.IncomeFrom)
                    {
                        continue;
                    }

                    decimal lower = b.IncomeFrom;
                    decimal upper = b.IncomeTo.HasValue ? Math.Min(taxableRaw, b.IncomeTo.Value) : taxableRaw;
                    decimal taxableInBracket = Math.Max(0m, upper - lower);

                    if (taxableInBracket > 0m)
                    {
                        decimal taxInBracket = taxableInBracket * (b.TaxRatePercent / 100m);
                        accumulatedTax += taxInBracket;

                        string rangeText = b.IncomeTo.HasValue
                            ? $"Từ {b.IncomeFrom / 1_000_000m:0.#} tr đến {b.IncomeTo.Value / 1_000_000m:0.#} tr"
                            : $"Trên {b.IncomeFrom / 1_000_000m:0.#} tr";

                        breakdowns.Add(new TaxBracketBreakdownItem(
                            b.BracketIndex,
                            rangeText,
                            taxableInBracket,
                            b.TaxRatePercent,
                            taxInBracket));
                    }
                }

                pitTax = accumulatedTax;
            }
        }

        // -------------------------------------------------------------
        // (6) Thực lĩnh = (3) - (5) - các khoản trừ sau thuế
        // -------------------------------------------------------------
        decimal takeHomeRaw = incomeAfterDeductions - pitTax - input.OtherDeductions;
        decimal takeHomeRounded = RoundTakeHome(takeHomeRaw, input.RoundingUnit);

        return new PayrollFormulaResult(
            Step1_TotalIncome: totalIncome,
            Step2_BeforeTaxDeduction: beforeTaxTotal,
            Step2_InsuranceDeduction: insuranceDeduction,
            Step2_UnionFeeDeduction: unionFeeDeduction,
            Step2_OtherBeforeTaxDeduction: otherBeforeTaxDeduction,
            Step3_IncomeAfterDeductions: incomeAfterDeductions,
            Step4_TaxableIncome: taxableIncome,
            Step4_PersonalDeductionAmount: personalDeductionAmount,
            Step4_DependentDeductionAmount: dependentDeductionAmount,
            Step4_TotalFamilyDeductions: totalFamilyDeductions,
            Step4_Note: taxableIncomeNote,
            Step5_PitTax: pitTax,
            Step5_TaxMethod: method,
            Step5_BracketBreakdowns: breakdowns,
            Step5_Note: taxNote,
            Step6_TakeHome: takeHomeRounded,
            Step6_TakeHomeRaw: takeHomeRaw,
            Step6_RoundingUnit: input.RoundingUnit);
    }

    /// <summary>
    /// Rounds the take-home pay using MidpointRounding.AwayFromZero (matching Excel ROUND).
    /// </summary>
    public static decimal RoundTakeHome(decimal amount, decimal roundingUnit)
    {
        if (roundingUnit <= 1m)
        {
            return Math.Round(amount, 0, MidpointRounding.AwayFromZero);
        }

        return Math.Round(amount / roundingUnit, 0, MidpointRounding.AwayFromZero) * roundingUnit;
    }
}

