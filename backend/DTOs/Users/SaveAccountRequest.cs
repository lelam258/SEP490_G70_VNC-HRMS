using System.ComponentModel.DataAnnotations;
namespace Vnc.HRMS.DTOs.Users;
public sealed record SaveAccountRequest(Guid? EmployeeId, [Required, StringLength(50)] string Username, [EmailAddress, StringLength(100)] string? Email, [StringLength(100)] string? FullName, [Required] string Role, [Required] string Status, [StringLength(128)] string? Password, string? Version);
