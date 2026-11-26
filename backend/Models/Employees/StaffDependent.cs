namespace Vnc.HRMS.Models.Employees;

public sealed class StaffDependent
{
    public Guid StaffDependentId { get; set; }
    public Guid RegisteredBy { get; set; }
    public Guid DependentId { get; set; }
    public Guid StaffId { get; set; }
    public string Relationship { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
