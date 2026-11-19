using Vnc.HRMS.DTOs.Payroll;

namespace Vnc.HRMS.Services.Interfaces;

public interface IPayrollPeriodService
{
    Task<List<PayrollPeriodDto>> ListPeriodsAsync(CancellationToken ct);
    Task<PayrollPeriodDetailDto> GetPeriodDetailAsync(string payMonth, CancellationToken ct);
    Task<PayrollPeriodDto> CreatePeriodAsync(Guid userId, CreatePayrollPeriodRequest request, CancellationToken ct);
    Task<PayrollPeriodDetailDto> ReopenPeriodAsync(Guid userId, string payMonth, ReopenPayrollPeriodRequest request, CancellationToken ct);

    Task<PayrollPeriodDetailDto> CalculatePeriodAsync(Guid userId, string payMonth, CancellationToken ct);
    Task<PayslipDetailDto> GetPayslipDetailAsync(string payMonth, Guid payslipId, CancellationToken ct);
    Task<PayslipDetailDto> ReviewPayslipAsync(Guid userId, string payMonth, Guid payslipId, ReviewPayslipRequest request, CancellationToken ct);
    Task<PayrollPeriodDetailDto> ReviewAllValidAsync(Guid userId, string payMonth, CancellationToken ct);
    Task<PayrollPeriodDetailDto> ConfirmPeriodAsync(Guid userId, string payMonth, ConfirmPayrollPeriodRequest? request, CancellationToken ct);
    Task<PayrollPeriodDetailDto> FinalizePeriodAsync(Guid userId, string payMonth, FinalizePayrollPeriodRequest request, CancellationToken ct);
    Task<PayrollPeriodDetailDto> UpdatePayslipInlineAsync(Guid userId, string payMonth, Guid payslipId, UpdatePayslipInlineRequest request, CancellationToken ct);
    Task DeletePeriodAsync(Guid userId, string payMonth, CancellationToken ct);
}
