using Vnc.HRMS.DTOs.Payroll;

namespace Vnc.HRMS.Services.Interfaces;

public interface IProcedureServiceCatalogService
{
    Task<ProcedureServiceListItemDto[]> ListAsync(ProcedureServiceListFilter filter, CancellationToken ct);
    Task<string[]> ListCategoriesAsync(CancellationToken ct);
    Task<ProcedureServiceDetailDto> GetDetailAsync(Guid id, CancellationToken ct);
    Task<ProcedureServiceListItemDto> CreateAsync(CreateProcedureServiceRequest request, CancellationToken ct);
    Task<ProcedureServiceListItemDto> UpdateAsync(Guid id, UpdateProcedureServiceRequest request, CancellationToken ct);
    Task<ProcedureServiceListItemDto> SetStatusAsync(Guid id, string status, CancellationToken ct);
}
