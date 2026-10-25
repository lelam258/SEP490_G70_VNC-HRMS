using System.ComponentModel.DataAnnotations;
using System.Data;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Identity;
using Vnc.HRMS.Common.Exceptions;
using Vnc.HRMS.Common.Utils;
using Vnc.HRMS.DTOs.Users;
using Vnc.HRMS.Models.Auth;
using Vnc.HRMS.Models.Users;
using Vnc.HRMS.Repositories.Interfaces;
using Vnc.HRMS.Services.Interfaces;

namespace Vnc.HRMS.Services;

public sealed class UserService(IUserRepository users, Vnc.HRMS.Contracts.IEmployeeDirectory employees, IAuthRepository auth,
    IUnitOfWork unitOfWork, IPasswordHasher<Credential> hasher) : IUserService
{
    private static readonly IReadOnlyList<string> Roles = Vnc.HRMS.Security.AccountRoles.All;
    private static readonly string[] Statuses = ["active", "inactive", "locked"];
    public Task<AccountDto[]> ListAsync(CancellationToken ct) => users.ListAsync(ct);
    public async Task<AccountDto> GetAsync(Guid id, CancellationToken ct) => await users.GetDetailAsync(id, ct) ?? throw new AppException(404, "Không tìm thấy tài khoản.");

    public async Task<AccountDto> CreateAsync(SaveAccountRequest request, bool bootstrap, CancellationToken ct)
    {
        Validate(request, true);
        // Provision HR management before any personnel profiles exist, without granting HR access to admin.
        if (!bootstrap && request.EmployeeId is null && request.Role != Vnc.HRMS.Security.AccountRoles.HrManager)
            throw new AppException(400, "Vui lòng chọn nhân viên. HR Manager có thể được tạo trước hồ sơ nhân viên.");
        var employee = request.EmployeeId is Guid employeeId ? await employees.FindAsync(employeeId, ct) : null;
        if (request.EmployeeId is not null && employee is not { Status: "active" }) throw new AppException(400, "Nhân viên không tồn tại hoặc đã ngừng hoạt động.");
        var user = new User
        {
            UserId = Guid.NewGuid(),
            EmployeeId = request.EmployeeId,
            Username = request.Username.Trim(),
            NormalizedUsername = request.Username.Trim().ToUpperInvariant(),
            Email = CleanEmail(request.Email ?? employee?.Email),
            FullName = request.FullName?.Trim() ?? employee?.FullName,
            Role = request.Role,
            AccountStatus = request.Status,
            IsProvisioned = true
        };
        var credential = new Credential { UserId = user.UserId };
        credential.PasswordHash = hasher.HashPassword(credential, request.Password!);
        await using var transaction = await unitOfWork.BeginTransactionAsync(ct, bootstrap ? IsolationLevel.Serializable : IsolationLevel.ReadCommitted);
        if (bootstrap && await users.HasProvisionedAdminAsync(ct)) throw new AppException(409, "Quản trị viên đã được khởi tạo.");
        users.Add(user); auth.AddCredential(credential);
        await unitOfWork.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return await GetAsync(user.UserId, ct);
    }

    public async Task<AccountDto> UpdateAsync(Guid id, SaveAccountRequest request, Guid actorId, CancellationToken ct)
    {
        if (actorId == id && (request.Role != "admin" || request.Status != "active" || !string.IsNullOrEmpty(request.Password)))
            throw new AppException(400, "Không thể tự đổi vai trò/trạng thái hoặc đặt lại mật khẩu tại đây. Dùng mục Đổi mật khẩu hoặc nhờ quản trị viên khác.");
        await using var transaction = await unitOfWork.BeginTransactionAsync(ct, IsolationLevel.Serializable);
        var user = await users.FindAsync(id, ct) ?? throw new AppException(404, "Không tìm thấy tài khoản.");
        Validate(request, !user.IsProvisioned);
        var employeeChanged = request.EmployeeId != user.EmployeeId;
        if (employeeChanged)
        {
            if (user.EmployeeId is not null) throw new AppException(400, "Không thể thay nhân viên đã liên kết.");
            if (request.EmployeeId is Guid staffId && await employees.FindAsync(staffId, ct) is not { Status: "active" })
                throw new AppException(400, "Nhân viên không tồn tại hoặc đã ngừng hoạt động.");
            user.EmployeeId = request.EmployeeId;
        }
        if (request.EmployeeId is null && request.Role is not ("admin" or "hr_manager"))
            throw new AppException(400, "Vai trò này cần liên kết với hồ sơ nhân viên.");
        if (request.Version != Convert.ToBase64String(user.Version)) throw new AppException(409, "Tài khoản vừa được người khác cập nhật. Hãy tải lại danh sách.");
        if (user.Role == "admin" && user.AccountStatus == "active" && user.IsProvisioned && (request.Role != "admin" || request.Status != "active")
            && !await users.HasActiveAdminAsync(id, ct)) throw new AppException(409, "Phải giữ ít nhất một quản trị viên đang hoạt động.");
        if (employeeChanged || user.Role != request.Role || user.AccountStatus != request.Status || !string.IsNullOrEmpty(request.Password)) user.SecurityVersion++;
        user.Username = request.Username.Trim(); user.NormalizedUsername = user.Username.ToUpperInvariant();
        user.Email = CleanEmail(request.Email); user.FullName = request.FullName?.Trim(); user.Role = request.Role; user.AccountStatus = request.Status;
        if (!string.IsNullOrEmpty(request.Password))
        {
            var credential = await auth.FindCredentialAsync(id, ct);
            if (credential is null) { credential = new Credential { UserId = id }; auth.AddCredential(credential); }
            credential.PasswordHash = hasher.HashPassword(credential, request.Password);
            credential.FailedLoginCount = 0; credential.LockedUntil = null; user.IsProvisioned = true;
            // Persist the credential first so all password changes use credential -> OTP lock order.
            await unitOfWork.SaveChangesAsync(ct);
            await auth.RevokeSessionsAsync(id, ct);
            await auth.InvalidateOtpsAsync(id, ct);
        }
        await unitOfWork.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return await GetAsync(id, ct);
    }

    private static void Validate(SaveAccountRequest request, bool passwordRequired)
    {
        if (string.IsNullOrWhiteSpace(request.Username) || !Regex.IsMatch(request.Username.Trim(), @"^[a-zA-Z0-9._-]{3,50}$"))
            throw new AppException(400, "Tên đăng nhập cần 3–50 ký tự chữ không dấu, số hoặc . _ - (không dùng @).");
        if (!Roles.Contains(request.Role) || !Statuses.Contains(request.Status)) throw new AppException(400, "Vai trò hoặc trạng thái không hợp lệ.");
        if (request.FullName?.Length > 100) throw new AppException(400, "Họ tên tối đa 100 ký tự.");
        if (request.Email?.Length > 100 || (!string.IsNullOrWhiteSpace(request.Email) && !new EmailAddressAttribute().IsValid(request.Email.Trim()))) throw new AppException(400, "Email không hợp lệ.");
        if ((passwordRequired || !string.IsNullOrEmpty(request.Password)) && !PasswordHelper.IsStrong(request.Password))
            throw new AppException(400, "Mật khẩu cần từ 6 đến 128 ký tự.");
    }
    private static string? CleanEmail(string? email) => string.IsNullOrWhiteSpace(email) ? null : email.Trim().ToLowerInvariant();
}
