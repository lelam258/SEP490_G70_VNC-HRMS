namespace Vnc.HRMS.Models.Auth;

public sealed class Credential
{
    public Guid UserId { get; set; }
    public string PasswordHash { get; set; } = string.Empty;
    public byte[] Version { get; set; } = [];
    public int FailedLoginCount { get; set; }
    public DateTime? LockedUntil { get; set; }
    public DateTime? LastLogin { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
