using Vnc.HRMS.DTOs.Certificates;

namespace Vnc.HRMS.Services.Interfaces;

public interface ICertificateService
{
    Task<StaffCertificateSummaryDto[]> ListStaffSummariesAsync(CancellationToken ct = default);
    Task<CertificateDto[]> ListByStaffIdAsync(Guid staffId, CancellationToken ct = default);
    Task<CertificateDto> GetAsync(Guid id, CancellationToken ct = default);
    Task<CertificateDto> CreateAsync(SaveCertificateRequest request, Guid? currentUserId, CancellationToken ct = default);
    Task<CertificateDto> UpdateAsync(Guid id, UpdateCertificateRequest request, CancellationToken ct = default);
    Task DeleteAsync(Guid id, CancellationToken ct = default);
}
