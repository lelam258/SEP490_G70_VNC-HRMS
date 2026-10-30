using System.ComponentModel.DataAnnotations;

namespace Vnc.HRMS.DTOs.Payroll;

// ---------- Allowance types ----------

public sealed record AllowanceTypeDto(
    Guid Id,
    string Code,
    string Name,
    string ValueType,
    decimal? DefaultValue,
    string AppliesTo,
    string DefaultCalcMethod,
    int? MinServiceYears,
    bool IsTaxable,
    bool IsInsuranceBasis,
    string Status,
    DateTime? CreatedAt,
    IReadOnlyList<string>? AffectedOpenPeriods = null);

public sealed record SaveAllowanceTypeRequest(
    [StringLength(30)] string? Code,
    [StringLength(100)] string? Name,
    string? ValueType,
    decimal? DefaultValue,
    [StringLength(50)] string? AppliesTo,
    string? DefaultCalcMethod,
    int? MinServiceYears,
    bool IsTaxable,
    bool IsInsuranceBasis,
    string? Status);

// ---------- Insurance configs ----------

public sealed record InsuranceConfigDto(
    Guid Id,
    string InsuranceType,
    string Payer,
    decimal RatePercent,
    string AppliesTo,
    DateOnly EffectiveFrom,
    DateOnly? EffectiveTo,
    string Status,
    IReadOnlyList<string>? AffectedOpenPeriods = null);

public sealed record SaveInsuranceConfigRequest(
    string? InsuranceType,
    string? Payer,
    decimal RatePercent,
    [StringLength(50)] string? AppliesTo,
    DateOnly EffectiveFrom,
    DateOnly? EffectiveTo,
    string? Status);

// ---------- Personal income tax ----------

public sealed record TaxBracketDto(
    Guid Id,
    decimal IncomeFrom,
    decimal? IncomeTo,
    decimal TaxRatePercent,
    DateOnly EffectiveFrom,
    DateOnly? EffectiveTo,
    string Status,
    IReadOnlyList<string>? AffectedOpenPeriods = null);

public sealed record SaveTaxBracketRequest(
    decimal IncomeFrom,
    decimal? IncomeTo,
    decimal TaxRatePercent,
    DateOnly EffectiveFrom,
    DateOnly? EffectiveTo,
    string? Status);

/// <summary>Read-only family deductions from iam.system_policies; null when not configured.</summary>
public sealed record TaxDeductionPolicyDto(decimal? PersonalDeduction, decimal? DependentDeduction);

/// <summary>Full PIT policy summary including brackets, deductions, flat tax settings, and flags.</summary>
public sealed record TaxPolicySummaryDto(
    IReadOnlyList<TaxBracketDto> Brackets,
    decimal PersonalDeduction,
    decimal DependentDeduction,
    decimal TaxFlatThreshold,
    decimal TaxFlatRate,
    decimal RoundingUnit,
    bool DeductInsuranceBeforeTax = true,
    bool DeductUnionFeeBeforeTax = true,
    bool DeductOtherBeforeTax = false,
    string FlatTaxBase = "gross");

/// <summary>Request to update before-tax deduction flags and flat tax base.</summary>
public sealed record UpdateTaxPolicyFlagsRequest(
    bool? DeductUnionFeeBeforeTax,
    bool? DeductOtherBeforeTax,
    string? FlatTaxBase);

/// <summary>Request to preview PIT & Take-Home 6-step calculation.</summary>
public sealed record TaxCalculationPreviewRequest(
    decimal TotalIncome,
    decimal InsuranceSalary,
    bool IsUnionMember,
    int DependentCount,
    string? TaxMethod = "progressive",
    decimal OtherDeductions = 0);

public sealed record TaxBracketBreakdownDto(
    int BracketIndex,
    string RangeText,
    decimal TaxableAmount,
    decimal RatePercent,
    decimal TaxAmount);

public sealed record TaxCalculationResultDto(
    decimal TotalIncome,
    decimal BeforeTaxDeductions,
    decimal InsuranceDeduction,
    decimal UnionFeeDeduction,
    decimal OtherBeforeTaxDeduction,
    decimal IncomeAfterDeductions,
    decimal TaxableIncome,
    decimal PersonalDeductionAmount,
    decimal DependentDeductionAmount,
    decimal TotalFamilyDeductions,
    string? TaxableIncomeNote,
    decimal PitTax,
    string TaxMethod,
    IReadOnlyList<TaxBracketBreakdownDto> BracketBreakdowns,
    string? TaxNote,
    decimal TakeHome,
    decimal TakeHomeRaw,
    decimal RoundingUnit);

// ---------- Commission rules ----------

public sealed record CommissionRuleDto(
    Guid Id,
    Guid? ServiceId,
    string? ServiceCode,
    string? ServiceName,
    string? ServiceCategory,
    Guid? PositionId,
    string? PositionName,
    string Role,
    string TimeCondition,
    string ValueType,
    decimal CommissionValue,
    DateOnly EffectiveFrom,
    DateOnly? EffectiveTo,
    string Status,
    Guid? CreatedBy,
    DateTime? CreatedAt,
    IReadOnlyList<string>? AffectedOpenPeriods = null);

public sealed record SaveCommissionRuleRequest(
    Guid? ServiceId,
    string? ServiceCategory,
    Guid? PositionId,
    string? Role,
    string? TimeCondition,
    string? ValueType,
    decimal CommissionValue,
    DateOnly EffectiveFrom,
    DateOnly? EffectiveTo,
    string? Status);

public sealed record ProcedureServiceOptionDto(Guid Id, string Code, string Name, string? Category, decimal? BasePrice);

public sealed record PositionOptionDto(Guid Id, string Name, string? ScopeTag);

public sealed record SiteOptionDto(Guid Id, string Code, string Name, string? Address);

// ---------- Filters ----------

/// <summary>Common list filter: status, records effective on a date, and free-text search.</summary>
public sealed record PayrollParameterFilter(string? Status, DateOnly? EffectiveOn, string? Q);

public sealed record CommissionRuleFilter(
    Guid? ServiceId,
    string? ServiceCategory,
    Guid? PositionId,
    string? Role,
    string? TimeCondition,
    string? Status,
    DateOnly? EffectiveOn,
    string? Q);
