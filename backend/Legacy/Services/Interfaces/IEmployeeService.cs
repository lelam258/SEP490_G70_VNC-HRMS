using Vnc.HRMS.DTOs.Employees;
namespace Vnc.HRMS.Services.Interfaces;
public interface IEmployeeService
{
    Task<EmployeeDto[]> ListAsync(CancellationToken ct);
    Task<EmployeeDto> GetAsync(Guid id, CancellationToken ct);
    Task<EmployeeDto> CreateAsync(CreateEmployeeRequest request, CancellationToken ct);
}
