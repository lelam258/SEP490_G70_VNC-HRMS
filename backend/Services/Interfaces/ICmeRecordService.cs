using Vnc.HRMS.DTOs.Cme;

namespace Vnc.HRMS.Services.Interfaces;

public interface ICmeRecordService
{
    Task<StaffCmeSummaryDto[]> ListStaffSummariesAsync(CancellationToken ct = default);
    Task<CmeRecordDto[]> ListByStaffIdAsync(Guid staffId, CancellationToken ct = default);
    Task<CmeRecordDto[]> ListByCertificateIdAsync(Guid certificateId, CancellationToken ct = default);
    Task<CmeRecordDto> GetAsync(Guid id, CancellationToken ct = default);
    Task<CmeRecordDto> CreateAsync(SaveCmeRecordRequest request, Guid? currentUserId, CancellationToken ct = default);
    Task<CmeRecordDto> UpdateAsync(Guid id, UpdateCmeRecordRequest request, Guid? currentUserId, CancellationToken ct = default);
    Task<CmeRecordDto> VerifyAsync(Guid id, bool verified, Guid? currentUserId, CancellationToken ct = default);
    Task DeleteAsync(Guid id, CancellationToken ct = default);
}
