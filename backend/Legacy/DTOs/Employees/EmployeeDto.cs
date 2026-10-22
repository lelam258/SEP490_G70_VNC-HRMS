namespace Vnc.HRMS.DTOs.Employees;
public sealed record EmployeeDto(Guid Id, string Code, string Name, Guid? DepartmentId, string Department, string? Email, string Status, DateOnly DateJoined, string? AvatarUrl);
