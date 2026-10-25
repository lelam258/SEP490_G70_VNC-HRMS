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
