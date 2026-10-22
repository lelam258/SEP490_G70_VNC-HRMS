using Vnc.HRMS.Common.Exceptions;
using Vnc.HRMS.DTOs.Organization;
using Vnc.HRMS.Models.Organization;
using Vnc.HRMS.Repositories.Interfaces;
using Vnc.HRMS.Services.Interfaces;

namespace Vnc.HRMS.Services;

public sealed class DepartmentService(IDepartmentRepository departments, IUnitOfWork unitOfWork) : IDepartmentService
{
    public Task<DepartmentDto[]> ListAsync(CancellationToken ct) => departments.ListAsync(ct);
    public async Task<DepartmentDto> GetAsync(Guid id, CancellationToken ct)
    {
        var department = await departments.FindAsync(id, ct) ?? throw new AppException(404, "Không tìm thấy khoa/phòng.");
        return new(department.DepartmentId, department.DeptCode, department.Name, department.Status);
    }
    public async Task<DepartmentDto> CreateAsync(CreateDepartmentRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Code) || string.IsNullOrWhiteSpace(request.Name)) throw new AppException(400, "Mã và tên khoa/phòng là bắt buộc.");
        var department = new Department { DepartmentId = Guid.NewGuid(), DeptCode = request.Code.Trim().ToUpperInvariant(), Name = request.Name.Trim() };
        departments.Add(department);
        await unitOfWork.SaveChangesAsync(ct);
        return await GetAsync(department.DepartmentId, ct);
    }
}
