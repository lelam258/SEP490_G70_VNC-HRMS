using Vnc.HRMS.DTOs.Organization;
using Vnc.HRMS.Models.Employees;
using Vnc.HRMS.Models.Organization;
using Vnc.HRMS.Models.Users;

namespace Vnc.HRMS.Repositories.Interfaces;

public interface IDepartmentRepository
{
    Task<DepartmentDto[]> ListAsync(CancellationToken ct);
    Task<DepartmentDto?> GetDtoAsync(Guid id, CancellationToken ct);
    Task<FacilityOptionDto[]> ListFacilitiesAsync(CancellationToken ct);
    Task<DepartmentManagerOptionDto[]> ListManagerOptionsAsync(CancellationToken ct);
    Task AssignFacilitiesAsync(Guid departmentId, string departmentName, IReadOnlyList<Guid> facilityIds, CancellationToken ct);
    Task<Staff?> FindStaffAsync(Guid staffId, CancellationToken ct);
    Task<User?> FindUserByStaffIdAsync(Guid staffId, CancellationToken ct);
    Task<string?> FindOtherManagedDepartmentNameAsync(Guid managerId, Guid excludeDepartmentId, CancellationToken ct);
    Task<Department?> FindAsync(Guid id, CancellationToken ct);
    Task<bool> CodeExistsAsync(string code, Guid? excludeId, CancellationToken ct);
    Task<bool> NameExistsAsync(string name, Guid? excludeId, CancellationToken ct);
    void Add(Department department);
}
