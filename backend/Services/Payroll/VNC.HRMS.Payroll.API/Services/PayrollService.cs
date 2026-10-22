using Vnc.HRMS.Repositories;
namespace Vnc.HRMS.Services;
public sealed class PayrollService(PayrollRepository repository)
{
    public Task<object> PayslipsAsync(int page, int pageSize, CancellationToken ct) => repository.PayslipsAsync(Math.Clamp(page, 1, 100000), Math.Clamp(pageSize, 1, 100), ct);
    public Task<object> AllowanceTypesAsync(int page, int pageSize, CancellationToken ct) => repository.AllowanceTypesAsync(Math.Clamp(page, 1, 100000), Math.Clamp(pageSize, 1, 100), ct);
    public Task<object> StaffAllowancesAsync(int page, int pageSize, CancellationToken ct) => repository.StaffAllowancesAsync(Math.Clamp(page, 1, 100000), Math.Clamp(pageSize, 1, 100), ct);
    public Task<object> ProcedureSlipsAsync(int page, int pageSize, CancellationToken ct) => repository.ProcedureSlipsAsync(Math.Clamp(page, 1, 100000), Math.Clamp(pageSize, 1, 100), ct);
    public Task<object> ComplaintsAsync(int page, int pageSize, CancellationToken ct) => repository.ComplaintsAsync(Math.Clamp(page, 1, 100000), Math.Clamp(pageSize, 1, 100), ct);
}
