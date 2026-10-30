using Vnc.HRMS.DTOs.Payroll;
using Vnc.HRMS.Models;

namespace Vnc.HRMS.Repositories.Interfaces;

public interface IPayrollPeriodRepository
{
    Task<List<PayrollPeriodDto>> ListPeriodsAsync(CancellationToken ct);
    Task<PayrollLock?> FindByMonthAsync(string payMonth, CancellationToken ct);
    Task<PayrollPeriodDetailDto?> GetPeriodDetailAsync(string payMonth, CancellationToken ct);
    void AddPeriod(PayrollLock period);
}
