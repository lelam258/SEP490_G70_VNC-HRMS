using Vnc.HRMS.DTOs.Employees;

namespace Vnc.HRMS.Services.Interfaces;

public interface IEmployeeDependentService
{
    Task<EmployeeDependentDto[]> ListByStaffAsync(Guid staffId, CancellationToken ct);
    Task<EmployeeDependentDto> CreateAsync(Guid staffId, CreateEmployeeDependentRequest request, Guid currentUserId, CancellationToken ct);
    Task<EmployeeDependentDto> UpdateAsync(Guid staffId, Guid staffDependentId, UpdateEmployeeDependentRequest request, CancellationToken ct);
    Task<DependentDocumentDto> AddDocumentAsync(Guid staffId, Guid staffDependentId, CreateDependentDocumentRequest request, CancellationToken ct);
    Task<DependentDocumentDto> VerifyDocumentAsync(Guid staffId, Guid staffDependentId, Guid documentId, VerifyDependentDocumentRequest request, Guid currentUserId, CancellationToken ct);
    Task DeleteDocumentAsync(Guid staffId, Guid staffDependentId, Guid documentId, CancellationToken ct);
}
