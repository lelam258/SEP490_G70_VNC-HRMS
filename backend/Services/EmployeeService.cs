using System.Data;
using Vnc.HRMS.Common.Exceptions;
using Vnc.HRMS.Common.Utils;
using Vnc.HRMS.DTOs.Employees;
using Vnc.HRMS.Models.Employees;
using Vnc.HRMS.Repositories.Interfaces;
using Vnc.HRMS.Services.Interfaces;
using Vnc.HRMS.Services.Rules;

namespace Vnc.HRMS.Services;

public sealed class EmployeeService(IEmployeeRepository employees, IDepartmentRepository departments, IUserRepository users,
    Microsoft.AspNetCore.Identity.IPasswordHasher<Vnc.HRMS.Models.Users.User> hasher, IUnitOfWork unitOfWork) : IEmployeeService
{
    public Task<EmployeeDto[]> ListAsync(CancellationToken ct) => employees.ListAsync(ct);
    public Task<UnlinkedAccountDto[]> ListUnlinkedAccountsAsync(CancellationToken ct) => users.ListUnlinkedAccountsAsync(ct);

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
        var staffCode = PayrollParameterRules.NormalizeCode(request.Code, 20);
        var fullName = ProfileRules.ValidateAndNormalizeFullName(request.Name);
        var email = EmployeeRules.NormalizeEmail(request.Email);
        var joined = request.DateJoined ?? TimeHelper.TodayInVietnam();
        EmployeeRules.EnsureEmploymentDates(joined, null);
        await using var transaction = await unitOfWork.BeginTransactionAsync(ct, IsolationLevel.Serializable);
        await EnsureUniqueAsync(staffCode, email, null, null, ct);
        if (request.DepartmentId is Guid departmentId && await departments.FindAsync(departmentId, ct) is not { Status: "active" })
            throw new AppException(400, "Phòng ban không tồn tại hoặc đã ngừng hoạt động.");

        var now = DateTime.UtcNow;
        var employee = new Staff
        {
            StaffId = Guid.NewGuid(),
            StaffCode = staffCode,
            FullName = fullName,
            Email = email,
            DepartmentId = request.DepartmentId,
            DateJoined = joined,
            CreatedAt = now,
            UpdatedAt = now
        };

        if (request.UserId is Guid userId)
        {
            var user = await users.FindAsync(userId, ct) ?? throw new AppException(404, "Không tìm thấy tài khoản đã chọn.");
            if (user.Employee is not null)
                throw new AppException(409, "Tài khoản này đã được liên kết với nhân viên khác.");

            employee.UserId = user.UserId;
            if (string.IsNullOrWhiteSpace(user.FullName)) user.FullName = employee.FullName;
            if (string.IsNullOrWhiteSpace(user.Email) && employee.Email is not null) user.Email = employee.Email;

            employees.Add(employee);
            await unitOfWork.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
            return await GetAsync(employee.StaffId, ct);
        }

        // Schema 2.0 requires a user before a staff row. This reserved account cannot log in
        // until an administrator provisions it.
        var reservedUser = new Vnc.HRMS.Models.Users.User
        {
            UserId = Guid.NewGuid(), Username = "pending_" + Guid.NewGuid().ToString("N"),
            FullName = employee.FullName, Email = employee.Email, Role = "employee",
            AccountStatus = "inactive", IsProvisioned = false, Employee = employee
        };
        reservedUser.NormalizedUsername = reservedUser.Username.ToUpperInvariant();
        reservedUser.PasswordHash = hasher.HashPassword(reservedUser, Convert.ToBase64String(System.Security.Cryptography.RandomNumberGenerator.GetBytes(48)));
        employee.UserId = reservedUser.UserId;
        users.Add(reservedUser);
        employees.Add(employee);
        await unitOfWork.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return await GetAsync(employee.StaffId, ct);
    }

    public async Task<EmployeeDto> UpdateAsync(Guid id, UpdateEmployeeRequest request, CancellationToken ct)
    {
        var staffCode = PayrollParameterRules.NormalizeCode(request.Code, 20);
        var fullName = ProfileRules.ValidateAndNormalizeFullName(request.Name);
        var email = EmployeeRules.NormalizeEmail(request.Email);
        var phone = string.IsNullOrWhiteSpace(request.Phone) ? null : ProfileRules.NormalizePhone(request.Phone);
        var birth = ProfileRules.ValidateDateOfBirth(request.DateOfBirth);
        var gender = ProfileRules.ValidateAndNormalizeGender(request.Gender);
        var idCard = ProfileRules.ValidateAndNormalizeIdCardNumber(request.IdCardNumber);
        if (idCard == "CLEAR") idCard = null;
        if (request.DependentCount is < 0)
            throw new AppException(400, "Số người phụ thuộc không được âm.", "dependentCount");
        if (request.AvatarUrl?.Trim().Length > 500)
            throw new AppException(400, "Đường dẫn ảnh đại diện tối đa 500 ký tự.", "avatarUrl");
        await using var transaction = await unitOfWork.BeginTransactionAsync(ct, IsolationLevel.Serializable);
        var employee = await employees.FindAsync(id, ct) ?? throw new AppException(404, "Không tìm thấy nhân viên.");
        var joined = request.DateJoined ?? employee.DateJoined;
        EmployeeRules.EnsureEmploymentDates(joined, request.DateLeft, birth);
        await EnsureUniqueAsync(staffCode, email, idCard, id, ct);
        if (request.Status is not ("active" or "inactive"))
            throw new AppException(400, "Trạng thái nhân viên không hợp lệ.");
        if (request.DepartmentId != employee.DepartmentId && request.DepartmentId is Guid departmentId && await departments.FindAsync(departmentId, ct) is not { Status: "active" })
            throw new AppException(400, "Phòng ban không tồn tại hoặc đã ngừng hoạt động.");

        employee.StaffCode = staffCode;
        employee.FullName = fullName;
        employee.Email = email;
        employee.Phone = phone;
        employee.DateOfBirth = birth;
        employee.Gender = gender;
        employee.IdCardNumber = idCard;
        employee.AvatarUrl = string.IsNullOrWhiteSpace(request.AvatarUrl) ? null : request.AvatarUrl.Trim();
        employee.DepartmentId = request.DepartmentId;
        employee.ScopeOfPractice = string.IsNullOrWhiteSpace(request.ScopeOfPractice) ? null : request.ScopeOfPractice.Trim();
        employee.DateJoined = joined;
        employee.DateLeft = request.DateLeft;
        if (request.DependentCount.HasValue && request.DependentCount.Value >= 0)
            employee.DependentCount = request.DependentCount.Value;
        employee.Status = request.Status;
        employee.UpdatedAt = DateTime.UtcNow;

        await unitOfWork.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return await GetAsync(id, ct);
    }

    private async Task EnsureUniqueAsync(string code, string? email, string? idCard, Guid? excludeId, CancellationToken ct)
    {
        if (await employees.ExistsCodeAsync(code, ct, excludeId))
            throw new AppException(409, "Mã nhân viên đã tồn tại.", "code");
        if (email is not null && await employees.EmailExistsAsync(email, excludeId, ct))
            throw new AppException(409, "Email đã được sử dụng bởi nhân viên khác.", "email");
        if (idCard is not null && await employees.IdCardExistsAsync(idCard, excludeId, ct))
            throw new AppException(409, "Số CCCD đã được sử dụng.", "idCardNumber");
    }
}
