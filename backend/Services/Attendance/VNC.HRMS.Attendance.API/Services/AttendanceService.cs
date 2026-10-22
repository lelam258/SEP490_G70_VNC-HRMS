using Vnc.HRMS.Repositories;
namespace Vnc.HRMS.Services;
public sealed class AttendanceService(AttendanceRepository repository)
{
    public Task<object> AttendanceRecordsAsync(int page, int pageSize, CancellationToken ct) => repository.AttendanceRecordsAsync(Math.Clamp(page, 1, 100000), Math.Clamp(pageSize, 1, 100), ct);
    public Task<object> AttendanceImportsAsync(int page, int pageSize, CancellationToken ct) => repository.AttendanceImportsAsync(Math.Clamp(page, 1, 100000), Math.Clamp(pageSize, 1, 100), ct);
    public Task<object> LeaveRequestsAsync(int page, int pageSize, CancellationToken ct) => repository.LeaveRequestsAsync(Math.Clamp(page, 1, 100000), Math.Clamp(pageSize, 1, 100), ct);
    public Task<object> OnCallShiftsAsync(int page, int pageSize, CancellationToken ct) => repository.OnCallShiftsAsync(Math.Clamp(page, 1, 100000), Math.Clamp(pageSize, 1, 100), ct);
    public Task<object> MonthlyTimesheetsAsync(int page, int pageSize, CancellationToken ct) => repository.MonthlyTimesheetsAsync(Math.Clamp(page, 1, 100000), Math.Clamp(pageSize, 1, 100), ct);
}
