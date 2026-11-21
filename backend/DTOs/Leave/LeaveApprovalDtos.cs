namespace Vnc.HRMS.DTOs.Leave;

public sealed record LeaveApprovalFilter(
    string? Status = "pending",
    Guid? DepartmentId = null,
    string? Search = null,
    string? LeaveType = null,
    DateOnly? FromDate = null,
    DateOnly? ToDate = null
);

public sealed record LeaveApprovalSummaryDto(
    Guid RequestId,
    Guid StaffId,
    string StaffCode,
    string StaffName,
    Guid DepartmentId,
    string DepartmentName,
    string? PositionName,
    string LeaveType,
    string LeaveTypeName,
    DateOnly StartDate,
    DateOnly EndDate,
    decimal TotalDays,
    string? Reason,
    string? AttachmentUrl,
    string Status,
    DateTime? CreatedAt,
    string? ApprovedByName,
    DateTime? ApprovedAt,
    string? RejectedReason,
    decimal? AnnualLeaveBalance,
    bool HasShiftConflict,
    int ShiftConflictCount,
    bool HasLeaveConflict
);

public sealed record LeaveApprovalDetailDto(
    Guid RequestId,
    Guid StaffId,
    string StaffCode,
    string StaffName,
    string? StaffEmail,
    string? StaffPhone,
    Guid DepartmentId,
    string DepartmentName,
    string? PositionName,
    string LeaveType,
    string LeaveTypeName,
    DateOnly StartDate,
    DateOnly EndDate,
    decimal TotalDays,
    string? Reason,
    string? AttachmentUrl,
    string Status,
    DateTime? CreatedAt,
    string? ApprovedByName,
    DateTime? ApprovedAt,
    string? RejectedReason,
    decimal AnnualLeaveEntitlement,
    decimal AnnualLeaveUsed,
    decimal AnnualLeaveRemaining,
    bool HasShiftConflict,
    IReadOnlyList<string> ConflictingShifts,
    bool HasLeaveConflict,
    IReadOnlyList<string> ConflictingLeaves
);

public sealed record RejectLeaveRequestDto(
    string RejectedReason
);

