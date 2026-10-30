using System.ComponentModel.DataAnnotations;

namespace Vnc.HRMS.DTOs.Payroll;

public sealed record PayrollRateConfigDto(
    Guid Id,
    string Code,
    Guid? PositionId,
    string? PositionName,
    Guid? StaffId,
    string? StaffCode,
    string? StaffName,
    decimal Value,
    string Unit,
    string? Description,
    DateOnly EffectiveFrom,
    DateOnly? EffectiveTo,
    string Status,
    Guid? CreatedBy,
    DateTime? CreatedAt,
    IReadOnlyList<string>? AffectedOpenPeriods = null);

public sealed record SavePayrollRateConfigRequest(
    [Required, StringLength(50)] string? Code,
    Guid? PositionId,
    Guid? StaffId,
    [Range(0, 1_000_000_000)] decimal Value,
    [Required, StringLength(20)] string? Unit,
    [StringLength(255)] string? Description,
    DateOnly EffectiveFrom,
    DateOnly? EffectiveTo,
    string? Status);

public sealed record PayrollRateConfigFilter(
    string? Code,
    Guid? PositionId,
    Guid? StaffId,
    string? Status,
    DateOnly? EffectiveOn,
    string? Q);

public sealed record DeactivateParameterRequest(
    DateOnly? EffectiveTo = null);

