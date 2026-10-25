using System.ComponentModel.DataAnnotations;
namespace Vnc.HRMS.DTOs.Auth;
public sealed record ChangePasswordRequest([Required, StringLength(128)] string CurrentPassword, [Required, StringLength(128, MinimumLength = 6)] string NewPassword);
