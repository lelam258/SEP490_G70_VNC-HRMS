using System.ComponentModel.DataAnnotations;
namespace Vnc.HRMS.DTOs.Auth;
public sealed record ForgotPasswordRequest([Required, EmailAddress, StringLength(100)] string Email);
