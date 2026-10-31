using Vnc.HRMS.Common.Exceptions;
using Vnc.HRMS.DTOs.Organization;
using Vnc.HRMS.Models.Organization;
using Vnc.HRMS.Repositories.Interfaces;
using Vnc.HRMS.Services.Interfaces;

namespace Vnc.HRMS.Services;

public sealed class DepartmentService(IDepartmentRepository departments, IUnitOfWork unitOfWork) : IDepartmentService
{
    public async Task<DepartmentDto> SetStatusAsync(Guid id, string status, CancellationToken ct)
    {
        if (status is not ("active" or "inactive")) throw new AppException(400, "Trạng thái khoa/phòng không hợp lệ.");
        var department = await departments.FindAsync(id, ct) ?? throw new AppException(404, "Không tìm thấy khoa/phòng.");
        department.Status = status;
        await unitOfWork.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

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
    public async Task<DepartmentDto> UpdateAsync(Guid id, UpdateDepartmentRequest request, CancellationToken ct)
    {
        var department = await departments.FindAsync(id, ct) ?? throw new AppException(404, "Không tìm thấy khoa/phòng.");
        if (string.IsNullOrWhiteSpace(request.Code) || string.IsNullOrWhiteSpace(request.Name) || request.Status is not ("active" or "inactive"))
            throw new AppException(400, "Mã, tên hoặc trạng thái khoa/phòng không hợp lệ.");
        department.DeptCode = request.Code.Trim().ToUpperInvariant();
        department.Name = request.Name.Trim();
        department.Status = request.Status;
        await unitOfWork.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }
}
