using System.Data;
using Vnc.HRMS.Common.Exceptions;
using Vnc.HRMS.DTOs.Organization;
using Vnc.HRMS.Models.Organization;
using Vnc.HRMS.Repositories.Interfaces;
using Vnc.HRMS.Services.Interfaces;
using Vnc.HRMS.Services.Rules;

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
        var code = PayrollParameterRules.NormalizeCode(request.Code, 20);
        var name = PayrollParameterRules.RequireText(request.Name, "Tên khoa/phòng", 100);
        await using var tx = await unitOfWork.BeginTransactionAsync(ct, IsolationLevel.Serializable);
        await EnsureUniqueAsync(code, name, null, ct);
        var department = new Department { DepartmentId = Guid.NewGuid(), DeptCode = code, Name = name };
        departments.Add(department);
        await unitOfWork.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return await GetAsync(department.DepartmentId, ct);
    }
    public async Task<DepartmentDto> UpdateAsync(Guid id, UpdateDepartmentRequest request, CancellationToken ct)
    {
        var code = PayrollParameterRules.NormalizeCode(request.Code, 20);
        var name = PayrollParameterRules.RequireText(request.Name, "Tên khoa/phòng", 100);
        if (request.Status is not ("active" or "inactive")) throw new AppException(400, "Trạng thái khoa/phòng không hợp lệ.", "status");
        await using var tx = await unitOfWork.BeginTransactionAsync(ct, IsolationLevel.Serializable);
        var department = await departments.FindAsync(id, ct) ?? throw new AppException(404, "Không tìm thấy khoa/phòng.");
        await EnsureUniqueAsync(code, name, id, ct);
        department.DeptCode = code;
        department.Name = name;
        department.Status = request.Status;
        await unitOfWork.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return await GetAsync(id, ct);
    }

    private async Task EnsureUniqueAsync(string code, string name, Guid? excludeId, CancellationToken ct)
    {
        if (await departments.CodeExistsAsync(code, excludeId, ct))
            throw new AppException(409, "Mã khoa/phòng đã tồn tại.", "code");
        if (await departments.NameExistsAsync(name, excludeId, ct))
            throw new AppException(409, "Tên khoa/phòng đã tồn tại.", "name");
    }
}
