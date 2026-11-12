using Vnc.HRMS.DTOs.Organization;
using Vnc.HRMS.Models.Organization;

namespace Vnc.HRMS.Repositories.Interfaces;

public interface IDepartmentRepository
{
    Task<DepartmentDto[]> ListAsync(CancellationToken ct);
    Task<Department?> FindAsync(Guid id, CancellationToken ct);
    Task<bool> CodeExistsAsync(string code, Guid? excludeId, CancellationToken ct);
    Task<bool> NameExistsAsync(string name, Guid? excludeId, CancellationToken ct);
    void Add(Department department);
}
