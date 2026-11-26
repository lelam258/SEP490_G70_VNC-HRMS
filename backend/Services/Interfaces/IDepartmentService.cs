using Vnc.HRMS.DTOs.Organization;
namespace Vnc.HRMS.Services.Interfaces;
public interface IDepartmentService
{
    Task<DepartmentDto[]> ListAsync(CancellationToken ct);
    Task<FacilityOptionDto[]> ListFacilitiesAsync(CancellationToken ct);
    Task<DepartmentManagerOptionDto[]> ListManagerOptionsAsync(CancellationToken ct);
    Task<DepartmentDto> GetAsync(Guid id, CancellationToken ct);
    Task<DepartmentDto> CreateAsync(CreateDepartmentRequest request, CancellationToken ct);
    Task<DepartmentDto> UpdateAsync(Guid id, UpdateDepartmentRequest request, CancellationToken ct);
    Task<DepartmentDto> AssignFacilitiesAsync(Guid id, AssignDepartmentFacilitiesRequest request, CancellationToken ct);
    Task<DepartmentDto> AssignManagerAsync(Guid id, AssignDepartmentManagerRequest request, CancellationToken ct);
    Task<DepartmentDto> SetStatusAsync(Guid id, string status, CancellationToken ct);
}
