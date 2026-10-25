using System.ComponentModel.DataAnnotations;
namespace Vnc.HRMS.DTOs.Employees;
public sealed record CreateEmployeeRequest([Required, StringLength(20)] string Code, [Required, StringLength(100)] string Name, [EmailAddress, StringLength(100)] string? Email, Guid? DepartmentId, DateOnly? DateJoined);
