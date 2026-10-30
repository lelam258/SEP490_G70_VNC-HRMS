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

// ---------- Commission rules ----------

public sealed record CommissionRuleDto(
    Guid Id,
    Guid ServiceId,
    string ServiceCode,
    string ServiceName,
    string Role,
    string ValueType,
    decimal CommissionValue,
    DateOnly EffectiveFrom,
    DateOnly? EffectiveTo,
    string Status,
    Guid? CreatedBy,
    DateTime? CreatedAt,
    IReadOnlyList<string>? AffectedOpenPeriods = null);

public sealed record SaveCommissionRuleRequest(
    Guid ServiceId,
    string? Role,
    string? ValueType,
    decimal CommissionValue,
    DateOnly EffectiveFrom,
    DateOnly? EffectiveTo,
    string? Status);

public sealed record ProcedureServiceOptionDto(Guid Id, string Code, string Name, string? Category);

// ---------- Filters ----------

/// <summary>Common list filter: status, records effective on a date, and free-text search.</summary>
public sealed record PayrollParameterFilter(string? Status, DateOnly? EffectiveOn, string? Q);
