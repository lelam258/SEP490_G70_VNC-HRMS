using System.ComponentModel.DataAnnotations;
namespace Vnc.HRMS.DTOs.Auth;
public sealed record LoginRequest([Required, StringLength(100)] string Login, [Required, StringLength(128)] string Password);
