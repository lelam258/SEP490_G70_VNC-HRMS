using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;
using Vnc.HRMS.Common.Exceptions;
using Vnc.HRMS.Common.Utils;
using Vnc.HRMS.Configurations;
using Vnc.HRMS.DTOs.Auth;
using Vnc.HRMS.DTOs.Users;
using Vnc.HRMS.Integrations.Interfaces;
using Vnc.HRMS.Models.Auth;
using Vnc.HRMS.Repositories.Interfaces;
using Vnc.HRMS.Services.Interfaces;

namespace Vnc.HRMS.Services;

public sealed class AccountRecoveryService(IAuthRepository auth, IUserRepository users, IEmployeeRepository employees,
    IUserService accounts, IPasswordHasher<Credential> hasher, IEmailService email, IOptions<OtpOptions> otpOptions,
    IOptions<JwtOptions> jwtOptions, ILogger<AccountRecoveryService> logger) : IAccountRecoveryService
{
    private const string GenericMessage = "Nếu email khớp với tài khoản đang hoạt động, bạn sẽ nhận được mã OTP đặt lại mật khẩu. Vui lòng kiểm tra cả thư mục thư rác.";
    private const string InvalidOtp = "Mã OTP không đúng, đã hết hạn, đã sử dụng hoặc vượt số lần nhập cho phép. Vui lòng kiểm tra mã hoặc yêu cầu OTP mới.";

    public async Task RegisterAsync(RegistrationRequest request, CancellationToken ct)
    {
        var employee = await employees.FindForRegistrationAsync(request.EmployeeCode, request.Email, ct)
            ?? throw new AppException(400, "Mã nhân viên và email không khớp hồ sơ đang hoạt động. Vui lòng liên hệ quản trị viên.");
        await accounts.CreateAsync(new SaveAccountRequest(employee.StaffId, request.Username, employee.Email, employee.FullName,
            "employee", "active", request.Password, null), false, ct);
    }

    public async Task<RecoveryChallengeResponse> ForgotAsync(ForgotPasswordRequest request, CancellationToken ct)
    {
        if (!email.IsConfigured) throw new AppException(503, "Chức năng gửi email chưa được cấu hình. Vui lòng liên hệ quản trị viên để đặt lại mật khẩu.");
        var policy = otpOptions.Value;
        var now = DateTime.UtcNow;
        var challenge = new RecoveryChallengeResponse(Guid.NewGuid(), policy.Length, now.AddMinutes(policy.ExpiresInMinutes), policy.MaxAttempts, GenericMessage);
        var address = request.Email.Trim().ToLowerInvariant();
        var user = await users.FindByLoginAsync(address, ct);
        if (user is not { IsProvisioned: true, AccountStatus: "active" } || !string.Equals(user.Email, address, StringComparison.OrdinalIgnoreCase)) return challenge;
        var code = new string(Enumerable.Range(0, policy.Length).Select(_ => (char)('0' + RandomNumberGenerator.GetInt32(10))).ToArray());
        var token = new PasswordResetToken { Id = challenge.ChallengeId, UserId = user.UserId, Email = address,
            TokenHash = PasswordHelper.OtpHash(jwtOptions.Value.SigningKey, challenge.ChallengeId, code),
            CreatedAt = now, ExpiresAt = challenge.ExpiresAt, CodeLength = policy.Length, MaxAttempts = policy.MaxAttempts };
        if (!await auth.CreateRecoveryAsync(token, ct)) return challenge;
        try { await email.SendOtpAsync(address, code, policy.ExpiresInMinutes, ct); }
        catch (Exception error) when (error is System.Net.Mail.SmtpException || error is OperationCanceledException && !ct.IsCancellationRequested) {
            await auth.DeleteRecoveryAsync(token.Id, ct);
            logger.LogError("OTP delivery failed. Challenge: {ChallengeId}; error: {ErrorType}; SMTP status: {SmtpStatus}",
                token.Id, error.GetType().Name, error is System.Net.Mail.SmtpException smtp ? smtp.StatusCode.ToString() : "timeout");
        }
        return challenge;
    }

    public async Task ResetAsync(ResetPasswordRequest request, CancellationToken ct)
    {
        if (!PasswordHelper.IsStrong(request.NewPassword)) throw new AppException(400, "Mật khẩu mới cần 12–128 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt.");
        var token = await auth.ReserveOtpAttemptAsync(request.ChallengeId, ct) ?? throw new AppException(400, InvalidOtp);
        var expected = PasswordHelper.OtpHash(jwtOptions.Value.SigningKey, token.Id, request.Otp);
        if (request.Otp.Length != token.CodeLength || !request.Otp.All(char.IsAsciiDigit) ||
            !CryptographicOperations.FixedTimeEquals(Encoding.ASCII.GetBytes(token.TokenHash), Encoding.ASCII.GetBytes(expected))) throw new AppException(400, InvalidOtp);
        var user = await users.FindAsync(token.UserId, ct);
        var credential = await auth.FindCredentialAsync(token.UserId, ct);
        if (user is not { IsProvisioned: true, AccountStatus: "active" } || !string.Equals(user.Email, token.Email, StringComparison.OrdinalIgnoreCase)
            || credential is null || PasswordHelper.Hash(credential.PasswordHash) != token.PasswordStamp) throw new AppException(400, InvalidOtp);
        if (!await auth.ResetPasswordAsync(token, credential.PasswordHash, hasher.HashPassword(credential, request.NewPassword), ct))
            throw new AppException(400, InvalidOtp);
    }
}
