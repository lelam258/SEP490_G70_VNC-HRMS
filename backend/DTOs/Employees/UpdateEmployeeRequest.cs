using System.ComponentModel.DataAnnotations;

namespace Vnc.HRMS.DTOs.Employees;

public sealed class UpdateEmployeeRequest
{
    [Required, StringLength(20)] public string Code { get; set; } = string.Empty;
    [Required, StringLength(100)] public string Name { get; set; } = string.Empty;
    [EmailAddress, StringLength(100)] public string? Email { get; set; }
    public Guid? DepartmentId { get; set; }
}
