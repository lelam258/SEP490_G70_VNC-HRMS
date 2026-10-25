using Vnc.HRMS.Repositories;
namespace Vnc.HRMS.Services;
public sealed class ComplianceService(ComplianceRepository repository)
{
    public Task<object> CertificatesAsync(int page, int pageSize, CancellationToken ct) => repository.CertificatesAsync(Math.Clamp(page, 1, 100000), Math.Clamp(pageSize, 1, 100), ct);
    public Task<object> CmeCyclesAsync(int page, int pageSize, CancellationToken ct) => repository.CmeCyclesAsync(Math.Clamp(page, 1, 100000), Math.Clamp(pageSize, 1, 100), ct);
    public Task<object> CmeRecordsAsync(int page, int pageSize, CancellationToken ct) => repository.CmeRecordsAsync(Math.Clamp(page, 1, 100000), Math.Clamp(pageSize, 1, 100), ct);
    public Task<object> ComplianceScansAsync(int page, int pageSize, CancellationToken ct) => repository.ComplianceScansAsync(Math.Clamp(page, 1, 100000), Math.Clamp(pageSize, 1, 100), ct);
}
