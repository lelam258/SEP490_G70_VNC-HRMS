using Vnc.HRMS.DTOs.Organization;
namespace Vnc.HRMS.Services.Interfaces;
public interface IDepartmentService
{
    Task<DepartmentDto[]> ListAsync(CancellationToken ct);
    Task<DepartmentDto> GetAsync(Guid id, CancellationToken ct);
    Task<DepartmentDto> CreateAsync(CreateDepartmentRequest request, CancellationToken ct);
    Task<DepartmentDto> UpdateAsync(Guid id, UpdateDepartmentRequest request, CancellationToken ct);
    Task<DepartmentDto> SetStatusAsync(Guid id, string status, CancellationToken ct);
}
