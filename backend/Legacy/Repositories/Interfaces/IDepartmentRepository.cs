using Vnc.HRMS.DTOs.Organization;
using Vnc.HRMS.Models.Organization;

namespace Vnc.HRMS.Repositories.Interfaces;

public interface IDepartmentRepository
{
    Task<DepartmentDto[]> ListAsync(CancellationToken ct);
    Task<Department?> FindAsync(Guid id, CancellationToken ct);
    void Add(Department department);
}
