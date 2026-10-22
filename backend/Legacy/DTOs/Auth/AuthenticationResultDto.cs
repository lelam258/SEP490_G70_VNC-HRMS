namespace Vnc.HRMS.DTOs.Auth;
// Internal service result: RefreshToken is written only to an HttpOnly cookie by AuthController.
public sealed record AuthenticationResultDto(SessionResponse Session, string RefreshToken, DateTime RefreshExpiresAt);
