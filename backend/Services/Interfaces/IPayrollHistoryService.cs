using Vnc.HRMS.DTOs.Payroll;

namespace Vnc.HRMS.Services.Interfaces;

public interface IPayrollHistoryService
{
    Task<PayrollHistoryResponseDto> ListHistoryAsync(PayrollHistoryFilter filter, CancellationToken ct);
    Task<PayrollHistoryDetailDto> GetMonthHistoryDetailAsync(string payMonth, Guid? departmentId, CancellationToken ct);
    Task<string> ExportHistoryCsvAsync(PayrollHistoryFilter filter, CancellationToken ct);
}
