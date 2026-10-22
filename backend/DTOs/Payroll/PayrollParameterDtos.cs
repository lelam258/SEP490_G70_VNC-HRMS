namespace Vnc.HRMS.DTOs.Payroll;

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
    DateTime CreatedAt
);

public sealed record SaveAllowanceTypeRequest(
    string Code,
    string Name,
    string ValueType,
    decimal? DefaultValue,
    string AppliesTo,
    bool IsTaxable,
    bool IsInsuranceBasis,
    string Status
);

public sealed record InsuranceConfigDto(
    Guid Id,
    string InsuranceType,
    string Payer,
    decimal RatePercent,
    string AppliesTo,
    DateOnly EffectiveFrom,
    DateOnly? EffectiveTo,
    string Status
);

public sealed record SaveInsuranceConfigRequest(
    string InsuranceType,
    string Payer,
    decimal RatePercent,
    string AppliesTo,
    DateOnly EffectiveFrom,
    DateOnly? EffectiveTo,
    string Status
);

public sealed record TaxBracketDto(
    Guid Id,
    decimal IncomeFrom,
    decimal? IncomeTo,
    decimal TaxRatePercent,
    DateOnly EffectiveFrom,
    DateOnly? EffectiveTo,
    string Status
);

public sealed record SaveTaxBracketRequest(
    decimal IncomeFrom,
    decimal? IncomeTo,
    decimal TaxRatePercent,
    DateOnly EffectiveFrom,
    DateOnly? EffectiveTo,
    string Status
);

public sealed record CommissionRuleDto(
    Guid Id,
    Guid ServiceId,
    string Role,
    string ValueType,
    decimal CommissionValue,
    DateOnly EffectiveFrom,
    DateOnly? EffectiveTo,
    string Status
);

public sealed record SaveCommissionRuleRequest(
    Guid ServiceId,
    string Role,
    string ValueType,
    decimal CommissionValue,
    DateOnly EffectiveFrom,
    DateOnly? EffectiveTo,
    string Status
);

public sealed record PayrollParametersSummaryDto(
    AllowanceTypeDto[] Allowances,
    InsuranceConfigDto[] Insurances,
    TaxBracketDto[] TaxBrackets,
    CommissionRuleDto[] CommissionRules
);
