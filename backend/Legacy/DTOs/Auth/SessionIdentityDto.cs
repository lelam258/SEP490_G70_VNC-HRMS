namespace Vnc.HRMS.DTOs.Auth;
public sealed record SessionIdentityDto(Guid UserId, string Role, string Name);
