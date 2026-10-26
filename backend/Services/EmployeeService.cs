using Vnc.HRMS.Common.Exceptions;
using Vnc.HRMS.DTOs.Employees;
using Vnc.HRMS.Models.Employees;
using Vnc.HRMS.Repositories.Interfaces;
using Vnc.HRMS.Services.Interfaces;

namespace Vnc.HRMS.Services;

public sealed class EmployeeService(IEmployeeRepository employees, IDepartmentRepository departments, IUserRepository users,
    Microsoft.AspNetCore.Identity.IPasswordHasher<Vnc.HRMS.Models.Users.User> hasher, IUnitOfWork unitOfWork) : IEmployeeService
{
    public Task<EmployeeDto[]> ListAsync(CancellationToken ct) => employees.ListAsync(ct);

    public async Task<EmployeeDto> GetAsync(Guid id, CancellationToken ct)
    {
        var employee = await employees.FindAsync(id, ct) ?? throw new AppException(404, "Không tìm thấy nhân viên.");
        var department = employee.DepartmentId is Guid departmentId ? await departments.FindAsync(departmentId, ct) : null;
        return new(
            employee.StaffId,
            employee.StaffCode,
            employee.FullName,
            employee.DepartmentId,
            department?.Name ?? "Chưa phân khoa",
            employee.Email,
            employee.Status,
            employee.DateJoined,
            employee.AvatarUrl,
            employee.Phone,
            employee.DateOfBirth,
            employee.Gender,
            employee.IdCardNumber,
            employee.ScopeOfPractice,
            employee.DateLeft,
            employee.DependentCount,
            employee.PositionId,
            employee.CreatedAt,
            employee.UpdatedAt);
    }

    public async Task<EmployeeDto> CreateAsync(CreateEmployeeRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Code) || string.IsNullOrWhiteSpace(request.Name))
            throw new AppException(400, "Mã nhân viên và họ tên là bắt buộc.");
        if (request.DepartmentId is Guid departmentId && await departments.FindAsync(departmentId, ct) is not { Status: "active" })
            throw new AppException(400, "Phòng ban không tồn tại hoặc đã ngừng hoạt động.");

        var now = DateTime.UtcNow;
        var employee = new Staff
        {
            StaffId = Guid.NewGuid(),
            StaffCode = request.Code.Trim().ToUpperInvariant(),
            FullName = request.Name.Trim(),
            Email = string.IsNullOrWhiteSpace(request.Email) ? null : request.Email.Trim().ToLowerInvariant(),
            DepartmentId = request.DepartmentId,
            DateJoined = request.DateJoined ?? DateOnly.FromDateTime(now),
            CreatedAt = now,
            UpdatedAt = now
        };
        // Schema 2.0 requires a user before a staff row. This reserved account cannot log in
        // until an administrator provisions it or the employee completes registration.
        var user = new Vnc.HRMS.Models.Users.User
        {
            UserId = Guid.NewGuid(), Username = "pending_" + Guid.NewGuid().ToString("N"),
            FullName = employee.FullName, Email = employee.Email, Role = "employee",
            AccountStatus = "inactive", IsProvisioned = false, Employee = employee
        };
        user.NormalizedUsername = user.Username.ToUpperInvariant();
        user.PasswordHash = hasher.HashPassword(user, Convert.ToBase64String(System.Security.Cryptography.RandomNumberGenerator.GetBytes(48)));
        employee.UserId = user.UserId;
        await using var transaction = await unitOfWork.BeginTransactionAsync(ct);
        users.Add(user);
        employees.Add(employee);
        await unitOfWork.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return await GetAsync(employee.StaffId, ct);
    }

    public async Task<EmployeeDto> UpdateAsync(Guid id, UpdateEmployeeRequest request, CancellationToken ct)
    {
        var employee = await employees.FindAsync(id, ct) ?? throw new AppException(404, "Không tìm thấy nhân viên.");
        if (string.IsNullOrWhiteSpace(request.Code) || string.IsNullOrWhiteSpace(request.Name))
            throw new AppException(400, "Mã nhân viên và họ tên là bắt buộc.");
        if (request.Status is not ("active" or "inactive"))
            throw new AppException(400, "Trạng thái nhân viên không hợp lệ.");
        if (request.DepartmentId is Guid departmentId && await departments.FindAsync(departmentId, ct) is not { Status: "active" })
            throw new AppException(400, "Phòng ban không tồn tại hoặc đã ngừng hoạt động.");

        employee.StaffCode = request.Code.Trim().ToUpperInvariant();
        employee.FullName = request.Name.Trim();
        employee.Email = string.IsNullOrWhiteSpace(request.Email) ? null : request.Email.Trim().ToLowerInvariant();
        employee.Phone = string.IsNullOrWhiteSpace(request.Phone) ? null : request.Phone.Trim();
        employee.DateOfBirth = request.DateOfBirth;
        employee.Gender = string.IsNullOrWhiteSpace(request.Gender) ? null : request.Gender.Trim();
        employee.IdCardNumber = string.IsNullOrWhiteSpace(request.IdCardNumber) ? null : request.IdCardNumber.Trim();
        employee.AvatarUrl = string.IsNullOrWhiteSpace(request.AvatarUrl) ? null : request.AvatarUrl.Trim();
        employee.DepartmentId = request.DepartmentId;
        employee.ScopeOfPractice = string.IsNullOrWhiteSpace(request.ScopeOfPractice) ? null : request.ScopeOfPractice.Trim();
        if (request.DateJoined.HasValue) employee.DateJoined = request.DateJoined.Value;
        employee.DateLeft = request.DateLeft;
        if (request.DependentCount.HasValue && request.DependentCount.Value >= 0)
            employee.DependentCount = request.DependentCount.Value;
        employee.Status = request.Status;
        employee.UpdatedAt = DateTime.UtcNow;

        await unitOfWork.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }
}
