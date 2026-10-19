namespace Vnc.HRMS.OrganizationService.Models;

public sealed class Department
{
    public Guid DepartmentId { get; set; }
    public string DeptCode { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public Guid? ManagerId { get; set; }
    public string Status { get; set; } = "active";
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

