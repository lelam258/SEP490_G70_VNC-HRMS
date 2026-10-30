using System.ComponentModel.DataAnnotations;

namespace Vnc.HRMS.DTOs.Payroll;

public sealed record StaffCommissionOverrideDto(
    Guid Id,
    Guid StaffId,
    string StaffCode,
    string StaffName,
    Guid? ServiceId,
    string? ServiceCode,
    string? ServiceName,
    string? ServiceCategory,
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

public sealed record SaveStaffCommissionOverrideRequest(
    [Required] Guid StaffId,
    Guid? ServiceId,
    [StringLength(100)] string? ServiceCategory,
    [Required, StringLength(50)] string? Role,
    [StringLength(20)] string? TimeCondition,
    [Required, StringLength(20)] string? ValueType,
    [Range(0, 1_000_000_000)] decimal CommissionValue,
    DateOnly EffectiveFrom,
    DateOnly? EffectiveTo,
    string? Status);

public sealed record StaffCommissionOverrideFilter(
    Guid? StaffId,
    Guid? ServiceId,
    string? ServiceCategory,
    string? Role,
    string? Status,
    DateOnly? EffectiveOn,
    string? Q);

