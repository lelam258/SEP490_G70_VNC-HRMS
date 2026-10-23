namespace Vnc.HRMS.DTOs.Users;
public sealed record AccountDto(Guid Id, Guid? EmployeeId, string Username, string? Email, string? FullName, string Role, string Status, bool IsProvisioned, DateTime CreatedAt, DateTime UpdatedAt, DateTime? LastLogin, string Version);
