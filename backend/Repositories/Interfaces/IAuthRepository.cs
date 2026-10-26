using Vnc.HRMS.Models.Users;
using Vnc.HRMS.DTOs.Auth;
using Vnc.HRMS.Models.Auth;

namespace Vnc.HRMS.Repositories.Interfaces;

public interface IAuthRepository
{
    Task<User?> FindAuthenticationUserAsync(Guid userId, CancellationToken ct);
    Task RecordFailedLoginAsync(Guid userId, CancellationToken ct);
    Task<RefreshToken?> FindRefreshTokenAsync(string hash, CancellationToken ct);
    Task<bool> ConsumeRefreshTokenAsync(Guid id, CancellationToken ct);
    Task SaveSessionAsync(RefreshToken session, User credential, CancellationToken ct);
    Task<SessionIdentityDto?> InspectSessionAsync(Guid id, CancellationToken ct);
    Task RevokeSessionsAsync(Guid userId, CancellationToken ct);
    Task RevokeSessionAsync(Guid? id, string? hash, CancellationToken ct);
    Task<bool> CreateRecoveryAsync(PasswordResetToken token, CancellationToken ct);
    Task DeleteRecoveryAsync(Guid id, CancellationToken ct);
    Task<PasswordResetToken?> ReserveOtpAttemptAsync(Guid id, CancellationToken ct);
    Task<bool> ResetPasswordAsync(PasswordResetToken token, string originalHash, string newHash, CancellationToken ct);
    Task InvalidateOtpsAsync(Guid userId, CancellationToken ct);
}
