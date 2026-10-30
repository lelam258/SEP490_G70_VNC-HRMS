namespace Vnc.HRMS.DTOs.Payroll;

public sealed record PayrollPeriodDto(
    Guid LockId,
    string PayMonth,
    string Status,
    int EmployeeCount,
    decimal TotalNetPay,
    DateTime? LockedAt,
    DateTime? CreatedAt
);

public sealed record CreatePayrollPeriodRequest(
    string PayMonth
);

public sealed record PayrollPeriodDetailDto(
    Guid LockId,
    string PayMonth,
    string Status,
    int EmployeeCount,
    decimal TotalNetPay,
    DateTime? LockedAt,
    DateTime? CreatedAt,
    List<PayslipSummaryItemDto> Payslips
);

public sealed record PayslipSummaryItemDto(
    Guid PayslipId,
    Guid StaffId,
    string? StaffCode,
    string? StaffName,
    string? DepartmentName,
    decimal BasePay,
    decimal AllowanceTotal,
    decimal GrossPay,
    decimal InsuranceDeduction,
    decimal TaxDeduction,
    decimal NetPay,
    string? Status
);
