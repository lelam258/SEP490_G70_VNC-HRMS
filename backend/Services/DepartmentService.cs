using System.Data;
using Vnc.HRMS.Common.Exceptions;
using Vnc.HRMS.DTOs.Organization;
using Vnc.HRMS.Models.Organization;
using Vnc.HRMS.Repositories.Interfaces;
using Vnc.HRMS.Security;
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
    public Task<FacilityOptionDto[]> ListFacilitiesAsync(CancellationToken ct) => departments.ListFacilitiesAsync(ct);
    public Task<DepartmentManagerOptionDto[]> ListManagerOptionsAsync(CancellationToken ct) => departments.ListManagerOptionsAsync(ct);

    public async Task<DepartmentDto> GetAsync(Guid id, CancellationToken ct)
    {
        return await departments.GetDtoAsync(id, ct) ?? throw new AppException(404, "Không tìm thấy khoa/phòng.");
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
        if (request.FacilityIds is { Count: > 0 })
        {
            await departments.AssignFacilitiesAsync(department.DepartmentId, name, request.FacilityIds, ct);
            await unitOfWork.SaveChangesAsync(ct);
        }
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
        if (request.FacilityIds is { Count: > 0 })
        {
            await departments.AssignFacilitiesAsync(id, name, request.FacilityIds, ct);
        }
        await unitOfWork.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return await GetAsync(id, ct);
    }

    public async Task<DepartmentDto> AssignFacilitiesAsync(Guid id, AssignDepartmentFacilitiesRequest request, CancellationToken ct)
    {
        var department = await departments.FindAsync(id, ct) ?? throw new AppException(404, "Không tìm thấy khoa/phòng.");
        await departments.AssignFacilitiesAsync(id, department.Name, request.FacilityIds ?? [], ct);
        await unitOfWork.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    public async Task<DepartmentDto> AssignManagerAsync(Guid id, AssignDepartmentManagerRequest request, CancellationToken ct)
    {
        await using var tx = await unitOfWork.BeginTransactionAsync(ct, IsolationLevel.Serializable);
        var department = await departments.FindAsync(id, ct) ?? throw new AppException(404, "Không tìm thấy khoa/phòng.");
        var previousManagerId = department.ManagerId;

        if (request.ManagerId.HasValue)
        {
            if (!string.Equals(department.Status, "active", StringComparison.OrdinalIgnoreCase))
                throw new AppException(400, "Không thể bổ nhiệm trưởng khoa/phòng cho đơn vị đã ngừng hoạt động.");

            var staff = await departments.FindStaffAsync(request.ManagerId.Value, ct);
            if (staff is null || !string.Equals(staff.Status, "active", StringComparison.OrdinalIgnoreCase))
                throw new AppException(400, "Nhân viên được chọn không tồn tại hoặc đã ngừng làm việc.");

            if (staff.DepartmentId != id)
                throw new AppException(400, "Chỉ có thể bổ nhiệm nhân sự thuộc chính khoa/phòng này.");

            var otherDeptName = await departments.FindOtherManagedDepartmentNameAsync(request.ManagerId.Value, id, ct);
            if (!string.IsNullOrWhiteSpace(otherDeptName))
                throw new AppException(409, $"Nhân viên này hiện đang là trưởng khoa/phòng của {otherDeptName}. Vui lòng miễn nhiệm ở đơn vị cũ trước.");

            var newManagerUser = await departments.FindUserByStaffIdAsync(request.ManagerId.Value, ct)
                ?? throw new AppException(400, "Nhân viên được chọn chưa có tài khoản hợp lệ.");

            if (!newManagerUser.IsProvisioned ||
                !string.Equals(newManagerUser.AccountStatus, "active", StringComparison.OrdinalIgnoreCase))
                throw new AppException(400, "Tài khoản của nhân viên được chọn chưa được cấp hoặc đang ngừng hoạt động.");

            var currentRole = AccountRoles.Normalize(newManagerUser.Role);
            var isSameCurrentManager = previousManagerId == request.ManagerId.Value &&
                string.Equals(currentRole, AccountRoles.DepartmentManager, StringComparison.OrdinalIgnoreCase);

            if (!isSameCurrentManager && !string.Equals(currentRole, AccountRoles.MedicalStaff, StringComparison.OrdinalIgnoreCase))
                throw new AppException(400, "Chỉ có thể bổ nhiệm nhân sự có vai trò Nhân viên y tế (Medical Staff) làm trưởng khoa/phòng.");

            if (!string.Equals(currentRole, AccountRoles.DepartmentManager, StringComparison.OrdinalIgnoreCase))
            {
                newManagerUser.Role = AccountRoles.DepartmentManager;
                newManagerUser.SecurityVersion++;
                newManagerUser.UpdatedAt = DateTime.UtcNow;
            }
        }

        if (previousManagerId.HasValue && previousManagerId != request.ManagerId)
        {
            var stillManagesAnotherDept = await departments.FindOtherManagedDepartmentNameAsync(previousManagerId.Value, id, ct);
            if (string.IsNullOrWhiteSpace(stillManagesAnotherDept))
            {
                var oldManagerUser = await departments.FindUserByStaffIdAsync(previousManagerId.Value, ct);
                if (oldManagerUser is not null &&
                    string.Equals(AccountRoles.Normalize(oldManagerUser.Role), AccountRoles.DepartmentManager, StringComparison.OrdinalIgnoreCase))
                {
                    oldManagerUser.Role = AccountRoles.MedicalStaff;
                    oldManagerUser.SecurityVersion++;
                    oldManagerUser.UpdatedAt = DateTime.UtcNow;
                }
            }
        }

        department.ManagerId = request.ManagerId;
        department.UpdatedAt = DateTime.UtcNow;
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
