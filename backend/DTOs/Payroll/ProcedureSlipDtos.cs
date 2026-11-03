namespace Vnc.HRMS.DTOs.Payroll;

public sealed record ProcedureSlipListFilter(
    string? PeriodType = null,
    int? Year = null,
    int? Month = null,
    int? Quarter = null,
    DateOnly? FromDate = null,
    DateOnly? ToDate = null,
    Guid? DepartmentId = null,
    Guid? ServiceId = null,
    Guid? StaffId = null,
    string? Status = null,
    bool? IsAfterHours = null,
    string? Q = null,
    string? Scope = null,
    int Page = 1,
    int PageSize = 25);

public sealed record ProcedureAssignmentDto(
    Guid AssignmentId,
    Guid SlipId,
    Guid StaffId,
    string StaffCode,
    string StaffName,
    string? DepartmentName,
    string? PositionName,
    string Role,
    Guid? RuleId,
    string RuleSource,
    string? ValueType,
    decimal? RuleValue,
    decimal CommissionAmount,
    Guid? PayslipId,
    string Status);

public sealed record ProcedureSlipListItemDto(
    Guid SlipId,
    string SlipNumber,
    DateOnly ProcedureDate,
    string? PatientCode,
    Guid ServiceId,
    string ServiceCode,
    string ServiceName,
    string? ServiceCategory,
    Guid? DepartmentId,
    string? DepartmentCode,
    string? DepartmentName,
    decimal ChargedAmount,
    decimal DirectCost,
    decimal NetRevenue,
    bool IsAfterHours,
    decimal? DurationHours,
    Guid? IndicatingStaffId,
    string? IndicatingStaffCode,
    string? IndicatingStaffName,
    int ParticipantCount,
    decimal TotalCommissionAmount,
    string Status,
    Guid? RecordedBy,
    string? RecordedByName,
    Guid? HrCheckedBy,
    string? HrCheckedByName,
    DateTime? HrCheckedAt,
    Guid? VerifiedBy,
    string? VerifiedByName,
    DateTime? VerifiedAt,
    string? RejectedReason,
    DateTime? CreatedAt,
    bool IsPeriodLocked);

public sealed record ProcedureSlipAuditItemDto(
    Guid LogId,
    string Action,
    string? Username,
    string? ActorFullName,
    string? Detail,
    DateTime? CreatedAt);

public sealed record ProcedureSlipDetailDto(
    Guid SlipId,
    string SlipNumber,
    DateOnly ProcedureDate,
    string? PatientCode,
    Guid ServiceId,
    string ServiceCode,
    string ServiceName,
    string? ServiceCategory,
    decimal? ServiceBasePrice,
    Guid? DepartmentId,
    string? DepartmentCode,
    string? DepartmentName,
    decimal ChargedAmount,
    decimal DirectCost,
    decimal NetRevenue,
    bool IsAfterHours,
    decimal? DurationHours,
    Guid? IndicatingStaffId,
    string? IndicatingStaffCode,
    string? IndicatingStaffName,
    int ParticipantCount,
    decimal TotalCommissionAmount,
    string Status,
    Guid? RecordedBy,
    string? RecordedByName,
    Guid? HrCheckedBy,
    string? HrCheckedByName,
    DateTime? HrCheckedAt,
    string? HrCheckNote,
    Guid? VerifiedBy,
    string? VerifiedByName,
    DateTime? VerifiedAt,
    string? VerifyNote,
    string? RejectedReason,
    DateTime? CreatedAt,
    bool IsPeriodLocked,
    bool CanEdit,
    bool CanHrCheck,
    bool CanAccountantVerify,
    IReadOnlyList<ProcedureAssignmentDto> Assignments,
    IReadOnlyList<ProcedureSlipAuditItemDto> AuditHistory);

public sealed record ProcedureDepartmentSummaryDto(
    Guid? DepartmentId,
    string DepartmentCode,
    string DepartmentName,
    int TotalSlips,
    int PendingCount,
    int HrCheckedCount,
    int VerifiedCount,
    int RejectedCount,
    decimal TotalChargedAmount,
    decimal TotalDirectCost,
    decimal TotalNetRevenue,
    decimal TotalCommissionAmount,
    decimal VerifiedCommissionAmount);

public sealed record ProcedurePeriodBreakdownDto(
    string PeriodKey,
    string PeriodLabel,
    int TotalSlips,
    int PendingCount,
    int HrCheckedCount,
    int VerifiedCount,
    int RejectedCount,
    decimal TotalChargedAmount,
    decimal TotalDirectCost,
    decimal TotalCommissionAmount,
    decimal VerifiedCommissionAmount);

public sealed record ProcedureSlipListResponseDto(
    int Total,
    int Page,
    int PageSize,
    IReadOnlyList<ProcedureSlipListItemDto> Items,
    int AllCount,
    int PendingCount,
    int HrCheckedCount,
    int VerifiedCount,
    int RejectedCount,
    decimal TotalChargedAmount,
    decimal TotalDirectCost,
    decimal TotalNetRevenue,
    decimal TotalCommissionAmount,
    decimal VerifiedCommissionAmount,
    IReadOnlyList<ProcedureDepartmentSummaryDto> ByDepartment,
    IReadOnlyList<ProcedurePeriodBreakdownDto> ByPeriod);

public sealed record SaveProcedureAssignmentInput(
    Guid StaffId,
    string Role,
    decimal? CustomCommissionAmount = null);

public sealed record SaveProcedureSlipRequest(
    Guid ServiceId,
    Guid? DepartmentId,
    string? SlipNumber,
    DateOnly ProcedureDate,
    string? PatientCode,
    decimal ChargedAmount,
    decimal DirectCost,
    bool IsAfterHours,
    decimal? DurationHours,
    Guid? IndicatingStaffId,
    IReadOnlyList<SaveProcedureAssignmentInput> Assignments);

public sealed record ReviewProcedureSlipRequest(
    string Decision,
    string? Reason = null,
    string? Note = null);

public sealed record PreviewProcedureCommissionRequest(
    Guid ServiceId,
    DateOnly ProcedureDate,
    decimal ChargedAmount,
    decimal DirectCost,
    bool IsAfterHours,
    decimal? DurationHours,
    IReadOnlyList<SaveProcedureAssignmentInput> Assignments);

public sealed record PreviewAssignmentCommissionDto(
    Guid StaffId,
    string StaffCode,
    string StaffName,
    string? PositionName,
    string Role,
    Guid? RuleId,
    string RuleSource,
    string? ValueType,
    decimal? RuleValue,
    decimal CommissionAmount);

public sealed record ProcedureLookupStaffDto(
    Guid StaffId,
    string StaffCode,
    string FullName,
    Guid? DepartmentId,
    string? DepartmentName,
    Guid? PositionId,
    string? PositionName);

public sealed record ProcedureLookupDepartmentDto(
    Guid DepartmentId,
    string DeptCode,
    string Name);

public sealed record ProcedureLookupsDto(
    IReadOnlyList<ProcedureServiceOptionDto> Services,
    IReadOnlyList<ProcedureLookupDepartmentDto> Departments,
    IReadOnlyList<ProcedureLookupStaffDto> Staff,
    Guid? CurrentUserStaffId = null,
    string? CurrentUserStaffCode = null,
    string? CurrentUserFullName = null,
    Guid? CurrentUserDepartmentId = null);

public sealed record CalculateMonthlyCommissionRequest(
    string PayMonth,
    Guid? DepartmentId = null);

public sealed record StaffMonthlyCommissionItemDto(
    Guid StaffId,
    string StaffCode,
    string StaffName,
    Guid? DepartmentId,
    string? DepartmentName,
    int VerifiedSlipCount,
    int AssignmentCount,
    decimal TotalCommissionAmount,
    Guid? PayslipId,
    bool LinkedToPayslip);

public sealed record CalculateMonthlyCommissionResultDto(
    string PayMonth,
    int VerifiedSlipCount,
    int AssignmentCount,
    int StaffCount,
    decimal TotalChargedAmount,
    decimal TotalCommissionCalculated,
    int UpdatedPayslipCount,
    IReadOnlyList<StaffMonthlyCommissionItemDto> StaffSummaries);
