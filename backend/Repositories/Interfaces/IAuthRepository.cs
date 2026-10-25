using Vnc.HRMS.DTOs.Auth;
using Vnc.HRMS.Models.Auth;

namespace Vnc.HRMS.Repositories.Interfaces;

public interface IAuthRepository
{
    Task<Credential?> FindCredentialAsync(Guid userId, CancellationToken ct);
    void AddCredential(Credential credential);
    Task RecordFailedLoginAsync(Guid userId, CancellationToken ct);
    Task<RefreshToken?> FindRefreshTokenAsync(string hash, CancellationToken ct);
    Task<bool> ConsumeRefreshTokenAsync(Guid id, CancellationToken ct);
    Task SaveSessionAsync(RefreshToken session, Credential credential, CancellationToken ct);
    Task<SessionIdentityDto?> InspectSessionAsync(Guid id, CancellationToken ct);
    Task RevokeSessionsAsync(Guid userId, CancellationToken ct);
    Task RevokeSessionAsync(Guid? id, string? hash, CancellationToken ct);
    Task InvalidateOtpsAsync(Guid userId, CancellationToken ct);
}
