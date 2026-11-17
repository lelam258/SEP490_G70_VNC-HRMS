namespace Vnc.HRMS.DTOs.Payroll;

public sealed record PayrollPeriodDto(
    Guid LockId,
    string PayMonth,
    string Status,
    int EmployeeCount,
    decimal TotalGrossPay,
    decimal TotalNetPay,
    bool AttendanceLocked,
    bool ProceduresVerified,
    bool IsLate,
    DateTime? LockedAt,
    DateTime? CreatedAt,
    DateOnly OpenDate,
    DateOnly StandardLockDate,
    DateOnly CorrectionDeadline
);

public sealed record CreatePayrollPeriodRequest(
    string PayMonth
);

public sealed record ReopenPayrollPeriodRequest(
    string Reason
);

public sealed record PayrollPeriodDetailDto(
    Guid LockId,
    string PayMonth,
    string Status,
    int EmployeeCount,
    decimal TotalGrossPay,
    decimal TotalNetPay,
    bool AttendanceLocked,
    bool ProceduresVerified,
    bool IsLate,
    string? ReopenReason,
    DateTime? LockedAt,
    DateTime? CreatedAt,
    DateOnly OpenDate,
    DateOnly StandardLockDate,
    DateOnly CorrectionDeadline,
    List<PayslipSummaryItemDto> Payslips
);

public sealed record PayslipSummaryItemDto(
    Guid PayslipId,
    Guid StaffId,
    string? StaffCode,
    string? StaffName,
    string? DepartmentName,
    decimal WorkDays,
    decimal OnCallDays,
    decimal BasePay,
    decimal AllowanceTotal,
    decimal CommissionTotal,
    decimal GrossPay,
    decimal InsuranceDeduction,
    decimal TaxDeduction,
    decimal NetPay,
    string? Status,
    string? ContractType,
    bool HasContract,
    bool AttendanceConfirmed,
    bool ProcedureConfirmed
);
