using Vnc.HRMS.Common.Exceptions;
using Vnc.HRMS.DTOs.Employees;
using Vnc.HRMS.Models.Employees;
using Vnc.HRMS.Repositories.Interfaces;
using Vnc.HRMS.Services.Interfaces;

namespace Vnc.HRMS.Services;

public sealed class EmployeeService(IEmployeeRepository employees, IDepartmentRepository departments, IUnitOfWork unitOfWork) : IEmployeeService
{
    public Task<EmployeeDto[]> ListAsync(CancellationToken ct) => employees.ListAsync(ct);
    public async Task<EmployeeDto> GetAsync(Guid id, CancellationToken ct)
    {
        var employee = await employees.FindAsync(id, ct) ?? throw new AppException(404, "Không tìm thấy nhân viên.");
        var department = employee.DepartmentId is Guid departmentId ? await departments.FindAsync(departmentId, ct) : null;
        return new(employee.StaffId, employee.StaffCode, employee.FullName, employee.DepartmentId, department?.Name ?? "Chưa phân khoa", employee.Email, employee.Status, employee.DateJoined, employee.AvatarUrl);
    }
    public async Task<EmployeeDto> CreateAsync(CreateEmployeeRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Code) || string.IsNullOrWhiteSpace(request.Name)) throw new AppException(400, "Mã nhân viên và họ tên là bắt buộc.");
        if (request.DepartmentId is Guid departmentId && await departments.FindAsync(departmentId, ct) is not { Status: "active" })
            throw new AppException(400, "Phòng ban không tồn tại hoặc đã ngừng hoạt động.");
        var employee = new Staff
        {
            StaffId = Guid.NewGuid(),
            StaffCode = request.Code.Trim().ToUpperInvariant(),
            FullName = request.Name.Trim(),
            Email = string.IsNullOrWhiteSpace(request.Email) ? null : request.Email.Trim().ToLowerInvariant(),
            DepartmentId = request.DepartmentId,
            DateJoined = request.DateJoined ?? DateOnly.FromDateTime(DateTime.UtcNow)
        };
        employees.Add(employee);
        await unitOfWork.SaveChangesAsync(ct);
        return await GetAsync(employee.StaffId, ct);
    }
}
