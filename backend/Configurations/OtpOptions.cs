using System.ComponentModel.DataAnnotations;

namespace Vnc.HRMS.Configurations;

public sealed class OtpOptions
{
    [Range(6, 8)] public int Length { get; init; } = 6;
    [Range(1, 30)] public int ExpiresInMinutes { get; init; } = 5;
    [Range(1, 10)] public int MaxAttempts { get; init; } = 5;
}
