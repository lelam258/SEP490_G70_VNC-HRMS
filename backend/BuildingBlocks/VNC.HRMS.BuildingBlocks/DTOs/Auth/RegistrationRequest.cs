using System.ComponentModel.DataAnnotations;
namespace Vnc.HRMS.DTOs.Auth;
public sealed record RegistrationRequest([Required, StringLength(20)] string EmployeeCode, [Required, StringLength(50)] string Username, [Required, EmailAddress, StringLength(100)] string Email, [Required, StringLength(128, MinimumLength = 12)] string Password);
