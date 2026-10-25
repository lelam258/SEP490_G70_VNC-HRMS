using System.Security.Cryptography;
using System.Text;

namespace Vnc.HRMS.Common.Utils;

public static class PasswordHelper
{
    public static bool IsStrong(string? value) => !string.IsNullOrWhiteSpace(value) && value.Length is >= 6 and <= 128;
    public static string Hash(string value) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value)));
    public static string OtpHash(string key, Guid id, string code) => Convert.ToHexString(HMACSHA256.HashData(
        Encoding.UTF8.GetBytes(key), Encoding.UTF8.GetBytes($"password-reset-otp:{id:N}:{code}")));
}
