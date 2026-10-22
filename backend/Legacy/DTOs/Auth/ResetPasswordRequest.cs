using System.ComponentModel.DataAnnotations;
namespace Vnc.HRMS.DTOs.Auth;
public sealed record ResetPasswordRequest(Guid ChallengeId, [Required, StringLength(8, MinimumLength = 6)] string Otp, [Required, StringLength(128, MinimumLength = 12)] string NewPassword);
