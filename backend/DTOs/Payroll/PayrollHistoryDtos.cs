namespace Vnc.HRMS.DTOs.Payroll;

/// <summary>
/// Bộ lọc tra cứu lịch sử các kỳ tính lương (SRS 6.14 / Task 74).
/// </summary>
public sealed record PayrollHistoryFilter(
    string? FromMonth = null,
    string? ToMonth = null,
    Guid? DepartmentId = null,
    string? Status = null
);

/// <summary>
/// Tùy chọn khoa/phòng trong bộ lọc lịch sử tính lương.
/// </summary>
public sealed record PayrollHistoryDepartmentOptionDto(
    Guid DepartmentId,
    string Name
);

/// <summary>
/// Một kỳ tính lương trong danh sách lịch sử (kèm số lần chạy & tổng hợp tiền).
/// </summary>
public sealed record PayrollHistoryItemDto(
    Guid LockId,
    string PayMonth,
    string Status,
    int RunCount,
    bool IsLate,
    bool HasWarning,
    string? WarningMessage,
    int EmployeeCount,
    decimal TotalWorkDays,
    decimal TotalCommission,
    decimal TotalGrossPay,
    decimal TotalInsurance,
    decimal TotalTax,
    decimal TotalNetPay,
    DateTime? LastCalculatedAt,
    DateTime? LockedAt,
    string? LockedByName
);

/// <summary>
/// Kết quả danh sách lịch sử tính lương kèm danh sách khoa/phòng lọc.
/// </summary>
public sealed record PayrollHistoryResponseDto(
    List<PayrollHistoryItemDto> Items,
    List<PayrollHistoryDepartmentOptionDto> Departments
);

/// <summary>
/// Tổng hợp số liệu của một khoa/phòng trong kỳ tính lương lịch sử.
/// </summary>
public sealed record PayrollHistoryDepartmentBreakdownDto(
    Guid? DepartmentId,
    string DepartmentName,
    int EmployeeCount,
    decimal TotalWorkDays,
    decimal TotalCommission,
    decimal TotalGrossPay,
    decimal TotalInsurance,
    decimal TotalTax,
    decimal TotalNetPay
);

/// <summary>
/// Một sự kiện lịch sử thao tác trên kỳ lương (từ AuditLogs).
/// </summary>
public sealed record PayrollHistoryEventDto(
    Guid LogId,
    string Action,
    string ActionLabel,
    string ActorName,
    DateTime? CreatedAt,
    string? Summary
);

/// <summary>
/// Chi tiết lịch sử tính lương của một tháng (chỉ đọc).
/// </summary>
public sealed record PayrollHistoryDetailDto(
    PayrollHistoryItemDto Summary,
    List<PayrollHistoryDepartmentBreakdownDto> DepartmentBreakdowns,
    List<PayrollHistoryEventDto> Events
);
