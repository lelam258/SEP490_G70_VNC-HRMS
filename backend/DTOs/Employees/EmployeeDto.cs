namespace Vnc.HRMS.DTOs.Employees;

public sealed record EmployeeDto(
    Guid Id,
    string Code,
    string Name,
    Guid? DepartmentId,
    string Department,
    string? Email,
    string Status,
    DateOnly DateJoined,
    string? AvatarUrl,
    string? Phone = null,
    DateOnly? DateOfBirth = null,
    string? Gender = null,
    string? IdCardNumber = null,
    string? ScopeOfPractice = null,
    DateOnly? DateLeft = null,
    int DependentCount = 0,
    Guid? PositionId = null,
    DateTime? CreatedAt = null,
    DateTime? UpdatedAt = null)
{
    public EmployeeDto(
        Guid id,
        string code,
        string name,
        Guid? departmentId,
        string department,
        string? email,
        string status,
        DateOnly dateJoined,
        string? avatarUrl)
        : this(id, code, name, departmentId, department, email, status, dateJoined, avatarUrl, null, null, null, null, null, null, 0, null, null, null)
    {
    }
}
