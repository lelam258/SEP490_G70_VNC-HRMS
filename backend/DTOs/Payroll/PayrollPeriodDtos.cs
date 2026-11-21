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
    bool ProcedureConfirmed,
    decimal OnCallPay,
    decimal OvertimePay,
    decimal OtherDeduction,
    string ReviewStatus,
    string? ReviewNote,
    DateTime? ReviewedAt,
    decimal NoonDutyCount = 0m,
    decimal EveningDutyCount = 0m,
    decimal NoonDutyRate = 50_000m,
    decimal EveningDutyRate = 100_000m
);

public sealed record PayslipAllowanceItemDto(
    Guid Id,
    Guid? AllowanceId,
    string Name,
    decimal Amount
);

public sealed record PayslipDeductionItemDto(
    Guid PayslipDeductionId,
    string DeductionType,
    string DeductionName,
    decimal CalculationBase,
    decimal? RatePercent,
    decimal Amount
);

public sealed record PayslipDetailDto(
    Guid PayslipId,
    Guid StaffId,
    string? StaffCode,
    string? StaffName,
    string? DepartmentName,
    string? PositionName,
    string PayMonth,
    string? Status,
    bool IsLocked,
    string? ContractCode,
    string? ContractType,
    string? SalaryType,
    decimal DailyRate,
    decimal? MonthlySalary,
    decimal StandardWorkingDays,
    string TaxMethod,
    bool IsInsuranceEligible,
    decimal InsuranceSalaryBase,
    bool IsUnionMember,
    int DependentCount,
    decimal WorkDays,
    decimal PaidLeaveDays,
    decimal UnpaidLeaveDays,
    decimal NoonDutyCount,
    decimal EveningDutyCount,
    decimal OvertimeHours,
    decimal OnCallDays,
    decimal BasePay,
    decimal NoonDutyPay,
    decimal EveningDutyPay,
    decimal OvertimePay,
    decimal OnCallPay,
    decimal AllowanceTotal,
    decimal CommissionTotal,
    decimal GrossPay,
    decimal InsuranceDeduction,
    decimal UnionFeeDeduction,
    decimal OtherDeduction,
    decimal PersonalDeduction,
    decimal DependentDeduction,
    decimal TaxableIncome,
    decimal TaxDeduction,
    decimal NetPay,
    bool HasContract,
    bool AttendanceConfirmed,
    bool ProcedureConfirmed,
    string ReviewStatus,
    string? ReviewNote,
    DateTime? ReviewedAt,
    List<PayslipAllowanceItemDto> Allowances,
    List<PayslipDeductionItemDto> Deductions,
    List<Vnc.HRMS.Services.Rules.TaxBracketBreakdownItem> TaxBrackets,
    string? TaxCalculationNote
);

public sealed record ReviewPayslipRequest(
    string ReviewStatus,
    string? Note
);

public sealed record ConfirmPayrollPeriodRequest(
    string? Note
);

public sealed record FinalizePayrollPeriodRequest(
    bool ConfirmLock,
    string? Note
);

public sealed record UpdatePayslipInlineRequest(
    decimal WorkDays,
    decimal OnCallDays,
    decimal BasePay,
    decimal AllowanceAndDutyTotal,
    decimal CommissionTotal,
    string? Note = null,
    decimal? NoonDutyCount = null,
    decimal? EveningDutyCount = null
);
