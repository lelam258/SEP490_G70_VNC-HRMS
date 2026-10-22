namespace Vnc.HRMS.Models.Auth;

public sealed class RefreshToken
{
    public Guid TokenId { get; set; }
    public Guid UserId { get; set; }
    public int AccountVersion { get; set; }
    public string TokenHash { get; set; } = string.Empty;
    public string? DeviceInfo { get; set; }
    public DateTime ExpiresAt { get; set; }
    public bool Revoked { get; set; }
    public DateTime? RevokedAt { get; set; }
    public DateTime CreatedAt { get; set; }
}
