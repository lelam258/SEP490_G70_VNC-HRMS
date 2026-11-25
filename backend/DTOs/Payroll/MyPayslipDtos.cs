namespace Vnc.HRMS.DTOs.Payroll;

/// <summary>
/// Tóm tắt một phiếu lương đã chốt của nhân viên đang đăng nhập.
/// </summary>
public sealed record MyPayslipSummaryDto(
    Guid PayslipId,
    string PayMonth,
    DateTime? FinalizedAt,
    decimal WorkDays,
    decimal BasePay,
    decimal AllowanceTotal,
    decimal CommissionTotal,
    decimal GrossPay,
    decimal TotalDeductions,
    decimal NetPay
);

/// <summary>
/// Kết quả tra cứu phiếu lương cá nhân theo tháng (hỗ trợ phân biệt kỳ chưa chốt MSG10 và không có phiếu MSG01).
/// </summary>
public sealed record MyPayslipMonthLookupDto(
    string PayMonth,
    string Availability,
    string? Message,
    PayslipDetailDto? Payslip
);
