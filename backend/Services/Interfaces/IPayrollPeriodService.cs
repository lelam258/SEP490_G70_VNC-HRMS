using Vnc.HRMS.DTOs.Payroll;

namespace Vnc.HRMS.Services.Interfaces;

public interface IPayrollPeriodService
{
    Task<List<PayrollPeriodDto>> ListPeriodsAsync(CancellationToken ct);
    Task<PayrollPeriodDetailDto> GetPeriodDetailAsync(string payMonth, CancellationToken ct);
    Task<PayrollPeriodDto> CreatePeriodAsync(Guid userId, CreatePayrollPeriodRequest request, CancellationToken ct);
    Task<PayrollPeriodDetailDto> ReopenPeriodAsync(Guid userId, string payMonth, ReopenPayrollPeriodRequest request, CancellationToken ct);
}
