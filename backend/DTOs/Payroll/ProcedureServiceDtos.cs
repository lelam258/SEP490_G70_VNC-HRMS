using System.ComponentModel.DataAnnotations;

namespace Vnc.HRMS.DTOs.Payroll;

public sealed record ProcedureServiceListFilter(
    string? Q = null,
    string? Category = null,
    string? Status = null);

public sealed record ProcedureServiceListItemDto(
    Guid ServiceId,
    string ServiceCode,
    string ServiceName,
    string? Category,
    decimal? BasePrice,
    string Status,
    int SlipCount,
    int ActiveRuleCount);

public sealed record ProcedureServiceSlipSummaryDto(
    Guid SlipId,
    string SlipNumber,
    DateOnly ProcedureDate,
    string? PatientCode,
    string? DepartmentName,
    decimal ChargedAmount,
    decimal DirectCost,
    bool IsAfterHours,
    decimal TotalCommissionAmount,
    string Status);

public sealed record ProcedureServiceRuleSummaryDto(
    Guid RuleId,
    bool IsDirectRule,
    string? PositionName,
    string Role,
    string TimeCondition,
    string ValueType,
    decimal CommissionValue,
    DateOnly EffectiveFrom,
    DateOnly? EffectiveTo,
    string Status);

public sealed record ProcedureServiceOverrideSummaryDto(
    Guid OverrideId,
    Guid StaffId,
    string StaffCode,
    string StaffName,
    bool IsDirectRule,
    string Role,
    string TimeCondition,
    string ValueType,
    decimal CommissionValue,
    DateOnly EffectiveFrom,
    DateOnly? EffectiveTo,
    string Status);

public sealed record ProcedureServiceDetailDto(
    Guid ServiceId,
    string ServiceCode,
    string ServiceName,
    string? Category,
    decimal? BasePrice,
    string Status,
    int TotalSlips,
    int PendingSlips,
    int HrCheckedSlips,
    int VerifiedSlips,
    int RejectedSlips,
    decimal TotalChargedAmount,
    decimal TotalCommissionAmount,
    int DirectRuleCount,
    int ActiveDirectRuleCount,
    int CategoryRuleCount,
    int OverrideCount,
    IReadOnlyList<ProcedureServiceSlipSummaryDto> RecentSlips,
    IReadOnlyList<ProcedureServiceRuleSummaryDto> CommissionRules,
    IReadOnlyList<ProcedureServiceOverrideSummaryDto> StaffOverrides,
    IReadOnlyList<ProcedureSlipAuditItemDto> AuditHistory);

public sealed record CreateProcedureServiceRequest(
    [StringLength(30)] string? Code,
    [StringLength(200)] string? Name,
    [StringLength(100)] string? Category,
    decimal? BasePrice,
    string? Status = "active");

public sealed record UpdateProcedureServiceRequest(
    [StringLength(30)] string? Code,
    [StringLength(200)] string? Name,
    [StringLength(100)] string? Category,
    decimal? BasePrice,
    string? Status);

public sealed record ProcedureServiceStatusRequest(
    string Status);
