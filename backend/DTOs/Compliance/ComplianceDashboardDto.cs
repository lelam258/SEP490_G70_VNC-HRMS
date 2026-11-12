namespace Vnc.HRMS.DTOs.Compliance;

public sealed record ComplianceDepartmentOptionDto(
    Guid Id,
    string Name
);

public sealed record CompliancePositionOptionDto(
    string Value,
    string Label
);

public sealed record ComplianceSelectOptionDto(
    string Value,
    string Label
);

public sealed record OperationalComplianceFilterRequestDto
{
    public Guid? DepartmentId { get; init; }
    public string? Position { get; init; }
    public string? StaffStatus { get; init; }
    public string? ContractType { get; init; }
    public string? Keyword { get; init; }
    public DateOnly? FromDate { get; init; }
    public DateOnly? ToDate { get; init; }
    public string? PayMonth { get; init; }
    public string? ComplianceStatus { get; init; }
    public string? ItemType { get; init; }
    public int? MaxDaysLeft { get; init; }
    public string? SortBy { get; init; }
    public string? SortDir { get; init; }
}

public sealed record ReportFilterOptionsDto(
    ComplianceDepartmentOptionDto[] Departments,
    CompliancePositionOptionDto[] Positions,
    ComplianceSelectOptionDto[] ContractTypes,
    ComplianceSelectOptionDto[] StaffStatuses,
    string[] AvailablePayMonths,
    Guid? LockedDepartmentId
);

public sealed record OperationalKpiSummaryDto(
    int TotalActiveStaff,
    int ExpiringContractsCount,
    int PendingLeaveRequestsCount,
    int OnCallShiftsCount,
    decimal TotalWorkDaysInPeriod
);

public sealed record ComplianceKpiSummaryDto(
    int TotalStaff,
    int ValidCount,
    int ExpiringCount,
    int ExpiredCount,
    int LegacyCount,
    int CmeAtRiskCount,
    int CertExpiringThresholdDays,
    int CmeAlertThresholdDays
);

public sealed record ComplianceAttentionRowDto(
    Guid StaffId,
    string StaffCode,
    string StaffName,
    Guid? DepartmentId,
    string DepartmentName,
    string Position,
    Guid? CertificateId,
    Guid? CmeCycleId,
    string Item,
    string ItemType,
    DateOnly? Deadline,
    string DeadlineDisplay,
    int? DaysLeft,
    decimal? CmeEarned,
    decimal? CmeRequired,
    string CmeDisplay,
    string Status,
    string CertWorstStatus,
    bool IsCmeAtRisk,
    bool RequiresAttention,
    string ActionUrl,
    string? CmeItem,
    DateOnly? CmeDeadline,
    string? CmeDeadlineDisplay,
    int? CmeDaysLeft,
    bool HasCmeCreditsRequirement = false,
    string? StaffStatus = "active",
    string? ContractType = null,
    string? CertificateNumber = null
);

public sealed record ComplianceChartItemDto(
    string DepartmentName,
    int ValidCount,
    int ExpiringCount,
    int ExpiredCount,
    int LegacyCount,
    int CmeAtRiskCount
);

public sealed record ComplianceDashboardResponseDto(
    ComplianceKpiSummaryDto Kpis,
    OperationalKpiSummaryDto OperationalKpis,
    ComplianceAttentionRowDto[] StaffItems,
    ComplianceAttentionRowDto[] CmeItems,
    ComplianceChartItemDto[] DepartmentChart,
    ComplianceDepartmentOptionDto[] Departments,
    CompliancePositionOptionDto[] Positions,
    ComplianceSelectOptionDto[] ContractTypes,
    ComplianceSelectOptionDto[] StaffStatuses,
    string[] AvailablePayMonths,
    Guid? LockedDepartmentId
);

public sealed record SendComplianceReminderRequest(
    Guid[]? StaffIds,
    Guid? DepartmentId,
    string? Position,
    string? StatusFilter
);

public sealed record SendComplianceReminderResponseDto(
    int SentCount,
    DateTime SentAt,
    string Message
);
