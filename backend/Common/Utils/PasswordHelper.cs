using System.Security.Cryptography;
using System.Text;

namespace Vnc.HRMS.Common.Utils;

public static class PasswordHelper
{
    public const string Requirements = "Mật khẩu cần từ 6 đến 128 ký tự, có ít nhất 1 chữ hoa, 1 số và 1 ký tự đặc biệt.";
    public static bool IsStrong(string? value) => !string.IsNullOrWhiteSpace(value) && value.Length is >= 6 and <= 128
        && value.Any(char.IsUpper) && value.Any(char.IsDigit)
        && value.Any(c => !char.IsLetterOrDigit(c) && !char.IsWhiteSpace(c));
    public static string Hash(string value) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value)));
    public static string OtpHash(string key, Guid id, string code) => Convert.ToHexString(HMACSHA256.HashData(
        Encoding.UTF8.GetBytes(key), Encoding.UTF8.GetBytes($"password-reset-otp:{id:N}:{code}")));
}
