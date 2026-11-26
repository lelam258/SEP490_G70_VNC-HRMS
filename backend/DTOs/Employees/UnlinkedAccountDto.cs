namespace Vnc.HRMS.DTOs.Employees;

public sealed record UnlinkedAccountDto(
    Guid UserId,
    string Username,
    string? FullName,
    string? Email,
    string Role
);
