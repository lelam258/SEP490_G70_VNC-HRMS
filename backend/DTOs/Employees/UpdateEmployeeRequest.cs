using System.ComponentModel.DataAnnotations;

namespace Vnc.HRMS.DTOs.Employees;

public sealed record UpdateEmployeeRequest(
    [Required, StringLength(20)] string Code,
    [Required, StringLength(100)] string Name,
    [EmailAddress, StringLength(100)] string? Email,
    [StringLength(20)] string? Phone,
    DateOnly? DateOfBirth,
    [StringLength(10)] string? Gender,
    [StringLength(20)] string? IdCardNumber,
    string? AvatarUrl,
    Guid? DepartmentId,
    [StringLength(200)] string? ScopeOfPractice,
    DateOnly? DateJoined,
    DateOnly? DateLeft,
    int? DependentCount,
    [Required, RegularExpression("^(active|inactive)$")] string Status);
