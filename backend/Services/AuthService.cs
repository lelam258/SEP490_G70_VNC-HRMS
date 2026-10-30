using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Vnc.HRMS.Common.Exceptions;
using Vnc.HRMS.Common.Utils;
using Vnc.HRMS.Configurations;
using Vnc.HRMS.DTOs.Auth;
using Vnc.HRMS.Models.Auth;
using Vnc.HRMS.Models.Users;
using Vnc.HRMS.Repositories.Interfaces;
using Vnc.HRMS.Services.Interfaces;

namespace Vnc.HRMS.Services;

public sealed class AuthService(IAuthRepository auth, IUserRepository users, IUnitOfWork unitOfWork,
    IPasswordHasher<User> hasher, IOptions<JwtOptions> options) : IAuthService
{
    private const string InvalidLogin = "Tên đăng nhập/email hoặc mật khẩu không đúng, hoặc tài khoản không khả dụng.";

    public async Task<AuthenticationResultDto> LoginAsync(LoginRequest request, string device, CancellationToken ct)
    {
        var user = await users.FindByLoginAsync(request.Login, ct);
        var credential = user is null ? null : await auth.FindAuthenticationUserAsync(user.UserId, ct);
        if (user is not { IsProvisioned: true, AccountStatus: "active" } || credential is null || credential.LockedUntil > DateTime.UtcNow)
            throw new AppException(401, InvalidLogin);
        var verified = hasher.VerifyHashedPassword(credential, credential.PasswordHash, request.Password);
        if (verified == PasswordVerificationResult.Failed)
        {
            await auth.RecordFailedLoginAsync(user.UserId, ct);
            throw new AppException(401, InvalidLogin);
        }
        credential.FailedLoginCount = 0; credential.LockedUntil = null; credential.LastLogin = DateTime.UtcNow;
        if (verified == PasswordVerificationResult.SuccessRehashNeeded) credential.PasswordHash = hasher.HashPassword(credential, request.Password);
        return await IssueAsync(user, credential, device, ct);
    }

    public async Task<AuthenticationResultDto> RefreshAsync(string? refreshToken, string device, CancellationToken ct)
    {
        if (string.IsNullOrEmpty(refreshToken) || refreshToken.Length > 200) throw new AppException(401, "Phiên đăng nhập đã hết hạn.");
        var session = await auth.FindRefreshTokenAsync(PasswordHelper.Hash(refreshToken), ct);
        if (session is null || session.Revoked || session.ExpiresAt <= DateTime.UtcNow) throw new AppException(401, "Phiên đăng nhập đã hết hạn.");
        var user = await users.FindAsync(session.UserId, ct);
        if (user is not { IsProvisioned: true, AccountStatus: "active" } || user.SecurityVersion != session.AccountVersion)
            throw new AppException(401, "Tài khoản hoặc quyền truy cập đã thay đổi.");
        var credential = await auth.FindAuthenticationUserAsync(user.UserId, ct);
        if (credential is null || !await auth.ConsumeRefreshTokenAsync(session.TokenId, ct)) throw new AppException(401, "Phiên đăng nhập đã hết hạn.");
        return await IssueAsync(user, credential, device, ct);
    }

    public Task LogoutAsync(string? refreshToken, Guid? sessionId, CancellationToken ct) => auth.RevokeSessionAsync(sessionId,
        string.IsNullOrEmpty(refreshToken) || refreshToken.Length > 200 ? null : PasswordHelper.Hash(refreshToken), ct);

    public async Task<CurrentUserDto> GetCurrentUserAsync(Guid id, CancellationToken ct)
    {
        var user = await users.FindAsync(id, ct) ?? throw new AppException(401, "Tài khoản không khả dụng.");
        return CurrentUser(user);
    }

    public async Task ChangePasswordAsync(Guid id, ChangePasswordRequest request, CancellationToken ct)
    {
        if (!PasswordHelper.IsStrong(request.NewPassword)) throw new AppException(400, PasswordHelper.Requirements);
        var credential = await auth.FindAuthenticationUserAsync(id, ct) ?? throw new AppException(401, "Tài khoản không khả dụng.");
        if (hasher.VerifyHashedPassword(credential, credential.PasswordHash, request.CurrentPassword) == PasswordVerificationResult.Failed)
            throw new AppException(400, "Mật khẩu hiện tại không đúng.");
        await using var transaction = await unitOfWork.BeginTransactionAsync(ct);
        credential.PasswordHash = hasher.HashPassword(credential, request.NewPassword);
        credential.FailedLoginCount = 0; credential.LockedUntil = null;
        await unitOfWork.SaveChangesAsync(ct);
        await auth.RevokeSessionsAsync(id, ct);
        await auth.InvalidateOtpsAsync(id, ct);
        await transaction.CommitAsync(ct);
    }

    private async Task<AuthenticationResultDto> IssueAsync(User user, User credential, string device, CancellationToken ct)
    {
        var raw = Convert.ToBase64String(RandomNumberGenerator.GetBytes(48));
        var session = new RefreshToken
        {
            TokenId = Guid.NewGuid(),
            UserId = user.UserId,
            AccountVersion = user.SecurityVersion,
            TokenHash = PasswordHelper.Hash(raw),
            ExpiresAt = DateTime.UtcNow.AddDays(7),
            DeviceInfo = device[..Math.Min(200, device.Length)]
        };
        await auth.SaveSessionAsync(session, credential, ct);
        var jwt = options.Value;
        var expires = DateTime.UtcNow.AddMinutes(Math.Clamp(jwt.AccessTokenMinutes, 1, 60));
        var token = new JwtSecurityToken(jwt.Issuer, jwt.Audience, [new Claim("sub", user.UserId.ToString()),
            new Claim("jti", session.TokenId.ToString()),
            new Claim("role", user.Role),
            new Claim("name", user.FullName ?? user.Username)], expires: expires,
            signingCredentials: new SigningCredentials(new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.SigningKey)), SecurityAlgorithms.HmacSha256));
        return new(new(new JwtSecurityTokenHandler().WriteToken(token), expires, CurrentUser(user)), raw, session.ExpiresAt);
    }
    private static CurrentUserDto CurrentUser(User user) => new(user.UserId, user.Username, user.FullName ?? user.Username, user.Email, user.Role);
}
