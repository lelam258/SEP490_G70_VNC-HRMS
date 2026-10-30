using Microsoft.AspNetCore.Http;

namespace Vnc.HRMS.DTOs.SelfService;

public sealed record LeaveTypeDto(string Code, string Name, string? Description = null, bool IsPaid = true);

public sealed record CreateLeaveRequestInput
{
    public string LeaveType { get; init; } = string.Empty;
    public DateOnly StartDate { get; init; }
    public DateOnly EndDate { get; init; }
    public string Reason { get; init; } = string.Empty;
    public IFormFile? Attachment { get; init; }
}

public sealed record LeaveRequestSummaryDto(
    Guid RequestId,
    string LeaveType,
    string LeaveTypeName,
    DateOnly StartDate,
    DateOnly EndDate,
    decimal TotalDays,
    string? Reason,
    string? AttachmentUrl,
    string Status,
    DateTime? CreatedAt
);

public sealed record LeaveRequestDetailDto(
    Guid RequestId,
    string LeaveType,
    string LeaveTypeName,
    DateOnly StartDate,
    DateOnly EndDate,
    decimal TotalDays,
    string? Reason,
    string? AttachmentUrl,
    string Status,
    string? ApprovedByName,
    DateTime? ApprovedAt,
    string? RejectedReason,
    DateTime? CreatedAt,
    DateTime? UpdatedAt
);
