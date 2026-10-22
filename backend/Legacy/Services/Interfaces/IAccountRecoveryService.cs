using Vnc.HRMS.DTOs.Auth;

namespace Vnc.HRMS.Services.Interfaces;

public interface IAccountRecoveryService
{
    Task RegisterAsync(RegistrationRequest request, CancellationToken ct);
    Task<RecoveryChallengeResponse> ForgotAsync(ForgotPasswordRequest request, CancellationToken ct);
    Task ResetAsync(ResetPasswordRequest request, CancellationToken ct);
}
