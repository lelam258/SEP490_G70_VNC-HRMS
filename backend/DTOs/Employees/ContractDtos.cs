namespace Vnc.HRMS.DTOs.Employees;

/// <summary>One row of the HR contract list. Carries no salary amounts.</summary>
public sealed record ContractListItemDto(
    Guid ContractId,
    string? ContractCode,
    Guid StaffId,
    string StaffCode,
    string StaffName,
    Guid? DepartmentId,
    string? DepartmentName,
    string? PositionName,
    string? SiteName,
    string ContractType,
    string SalaryType,
    DateOnly EffectiveFrom,
    DateOnly? EffectiveTo,
    string Status,
    string? FileUrl,
    string DisplayStatus = "");

public sealed record ContractDetailDto(
    Guid ContractId,
    string? ContractCode,
    Guid StaffId,
    string StaffCode,
    string StaffName,
    string? StaffEmail,
    string? DepartmentName,
    string? PositionName,
    string? SiteName,
    string ContractType,
    string SalaryType,
    decimal DailyRate,
    decimal? MonthlySalary,
    decimal? StandardWorkingDays,
    bool IsInsuranceEligible,
    decimal? InsuranceSalaryBasis,
    string TaxMethod,
    DateOnly EffectiveFrom,
    DateOnly? EffectiveTo,
    string Status,
    string? FileUrl,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    string DisplayStatus = "");

public sealed record CreateContractRequest(
    Guid StaffId,
    string? ContractCode,
    string? ContractType,
    string? SalaryType,
    decimal BaseSalary,
    decimal? StandardWorkingDays,
    DateOnly EffectiveFrom,
    DateOnly? EffectiveTo,
    string? FileUrl);

/// <summary>Fields HR may change on an existing contract. Salary changes go through compensation settings.</summary>
public sealed record UpdateContractRequest(
    string? ContractCode,
    string? ContractType,
    DateOnly EffectiveFrom,
    DateOnly? EffectiveTo,
    string? Status,
    string? FileUrl);
