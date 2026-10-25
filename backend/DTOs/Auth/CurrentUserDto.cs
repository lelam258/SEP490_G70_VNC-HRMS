namespace Vnc.HRMS.DTOs.Auth;
public sealed record CurrentUserDto(Guid Id, string Username, string Name, string? Email, string Role);
