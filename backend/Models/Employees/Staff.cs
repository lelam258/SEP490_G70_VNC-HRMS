namespace Vnc.HRMS.Models.Employees;

public sealed class Staff
{
    public Guid StaffId { get; set; }
    public Guid UserId { get; set; }
    public string StaffCode { get; set; } = string.Empty;
    public string? DeviceEnrollId { get; set; }
    public string FullName { get; set; } = string.Empty;
    public DateOnly? DateOfBirth { get; set; }
    public string? Gender { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string? IdCardNumber { get; set; }
    public string? AvatarUrl { get; set; }
    public Guid? DepartmentId { get; set; }
    public Guid? PositionId { get; set; }
    public Guid? SiteId { get; set; }
    public bool IsUnionMember { get; set; } = true;
    public string? ScopeOfPractice { get; set; }
    public DateOnly DateJoined { get; set; }
    public DateOnly? DateLeft { get; set; }
    public int DependentCount { get; set; }
    public string Status { get; set; } = "active";
    public Guid? CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
