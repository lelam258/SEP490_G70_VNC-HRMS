using Vnc.HRMS.DTOs.Payroll;
using Vnc.HRMS.Models;

namespace Vnc.HRMS.Repositories.Interfaces;

public interface IPayrollHistoryRepository
{
    Task<List<PayrollLock>> ListLocksAsync(CancellationToken ct);
    Task<PayrollLock?> FindLockByMonthAsync(string payMonth, CancellationToken ct);
    Task<List<Payslip>> ListPayslipsByMonthsAsync(IEnumerable<string> months, Guid? departmentId, CancellationToken ct);
    Task<List<PayrollHistoryDepartmentOptionDto>> ListActiveDepartmentsAsync(CancellationToken ct);
    Task<Dictionary<Guid, string>> GetDepartmentNamesAsync(CancellationToken ct);
    Task<Dictionary<Guid, string>> GetUserNamesAsync(IEnumerable<Guid> userIds, CancellationToken ct);
    Task<List<AuditLog>> ListPayrollLockLogsAsync(IEnumerable<Guid> lockIds, CancellationToken ct);
}
