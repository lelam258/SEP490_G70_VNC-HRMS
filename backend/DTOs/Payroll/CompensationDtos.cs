namespace Vnc.HRMS.DTOs.Payroll;

public sealed record ContractSummaryDto(
    Guid ContractId,
    Guid StaffId,
    string? ContractCode,
    string StaffCode,
    string StaffName,
    string? DepartmentName,
    string ContractType,
    decimal DailyRate,
    bool IsInsuranceEligible,
    decimal? InsuranceSalaryBasis,
    DateOnly EffectiveFrom,
    DateOnly? EffectiveTo,
    string Status);

public sealed record StaffAllowanceDto(
    Guid StaffAllowanceId,
    Guid StaffId,
    Guid AllowanceId,
    string AllowanceCode,
    string AllowanceName,
    string ValueType,
    decimal AmountValue,
    DateOnly EffectiveFrom,
    DateOnly? EffectiveTo,
    string Status,
    Guid? ApprovedBy,
    DateTime CreatedAt,
    IReadOnlyList<string>? AffectedOpenPeriods = null);

public sealed record ContractCompensationDto(
    Guid ContractId,
    Guid StaffId,
    string? ContractCode,
    string StaffCode,
    string StaffName,
    string? DepartmentName,
    string ContractType,
    decimal DailyRate,
    bool IsInsuranceEligible,
    decimal? InsuranceSalaryBasis,
    DateOnly EffectiveFrom,
    DateOnly? EffectiveTo,
    string Status,
    StaffAllowanceDto[] Allowances,
    IReadOnlyList<string>? AffectedOpenPeriods = null);

public sealed record UpdateContractCompensationRequest(
    decimal DailyRate,
    bool IsInsuranceEligible,
    decimal? InsuranceSalaryBasis);

public sealed record SaveStaffAllowanceRequest(
    Guid AllowanceId,
    string? ValueType,
    decimal AmountValue,
    DateOnly EffectiveFrom,
    DateOnly? EffectiveTo,
    string? Status);
