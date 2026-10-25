using Vnc.HRMS.DTOs.Auth;

namespace Vnc.HRMS.Services.Interfaces;

public interface IAuthService
{
    Task<AuthenticationResultDto> LoginAsync(LoginRequest request, string device, CancellationToken ct);
    Task<AuthenticationResultDto> RefreshAsync(string? refreshToken, string device, CancellationToken ct);
    Task LogoutAsync(string? refreshToken, Guid? sessionId, CancellationToken ct);
    Task<CurrentUserDto> GetCurrentUserAsync(Guid id, CancellationToken ct);
}
