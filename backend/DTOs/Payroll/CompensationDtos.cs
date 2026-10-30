namespace Vnc.HRMS.DTOs.Payroll;

public sealed record ContractSummaryDto(
    Guid ContractId,
    Guid StaffId,
    string? ContractCode,
    string StaffCode,
    string StaffName,
    string? DepartmentName,
    string ContractType,
    string SalaryType,
    decimal DailyRate,
    decimal? MonthlySalary,
    decimal? StandardWorkingDays,
    bool IsInsuranceEligible,
    decimal? InsuranceSalaryBasis,
    string TaxMethod,
    Guid? SiteId,
    string? SiteName,
    bool IsUnionMember,
    DateOnly EffectiveFrom,
    DateOnly? EffectiveTo,
    string Status,
    ContractSalaryHistoryDto? PendingSalaryChange = null);

public sealed record StaffAllowanceDto(
    Guid StaffAllowanceId,
    Guid StaffId,
    Guid AllowanceId,
    string AllowanceCode,
    string AllowanceName,
    string ValueType,
    decimal AmountValue,
    string CalcMethod,
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
    string SalaryType,
    decimal DailyRate,
    decimal? MonthlySalary,
    decimal? StandardWorkingDays,
    bool IsInsuranceEligible,
    decimal? InsuranceSalaryBasis,
    string TaxMethod,
    Guid? SiteId,
    string? SiteName,
    bool IsUnionMember,
    DateOnly EffectiveFrom,
    DateOnly? EffectiveTo,
    string Status,
    StaffAllowanceDto[] Allowances,
    ContractSalaryHistoryDto? PendingSalaryChange = null,
    IReadOnlyList<string>? AffectedOpenPeriods = null);

public sealed record UpdateContractCompensationRequest(
    string? SalaryType,
    decimal DailyRate,
    decimal? MonthlySalary,
    decimal? StandardWorkingDays,
    bool IsInsuranceEligible,
    decimal? InsuranceSalaryBasis,
    string? TaxMethod,
    Guid? SiteId,
    bool? IsUnionMember,
    DateOnly? EffectiveFrom = null,
    string? Note = null);

public sealed record SaveStaffAllowanceRequest(
    Guid AllowanceId,
    string? ValueType,
    decimal AmountValue,
    string? CalcMethod,
    DateOnly EffectiveFrom,
    DateOnly? EffectiveTo,
    string? Status);

public sealed record ContractSalaryHistoryDto(
    Guid HistoryId,
    Guid ContractId,
    string SalaryType,
    decimal DailyRate,
    decimal? MonthlySalary,
    decimal? StandardWorkingDays,
    decimal? InsuranceSalaryBasis,
    string TaxMethod,
    DateOnly EffectiveFrom,
    DateOnly? EffectiveTo,
    string? Note,
    DateTime CreatedAt);

/// <summary>A date range within which one salary setting applies. HistoryId is null when taken from the contract itself.</summary>
public sealed record ContractSalarySegmentDto(
    DateOnly From,
    DateOnly To,
    string SalaryType,
    decimal DailyRate,
    decimal? MonthlySalary,
    decimal? StandardWorkingDays,
    decimal? InsuranceSalaryBasis,
    string TaxMethod,
    Guid? HistoryId);
