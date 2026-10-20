namespace Vnc.HRMS.DTOs.Auth;
public sealed record SessionResponse(string AccessToken, DateTime ExpiresAt, CurrentUserDto User);
