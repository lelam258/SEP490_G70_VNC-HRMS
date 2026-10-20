namespace Vnc.HRMS.Models.Users;

public sealed class User
{
    public Guid UserId { get; set; }
    public string Username { get; set; } = string.Empty;
    public string NormalizedUsername { get; set; } = string.Empty;
    public string? Email { get; set; }
    public Guid? EmployeeId { get; set; }
    public bool IsProvisioned { get; set; }
    public int SecurityVersion { get; set; }
    public byte[] Version { get; set; } = [];
    public string? FullName { get; set; }
    public string Role { get; set; } = string.Empty;
    public string AccountStatus { get; set; } = "active";
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
