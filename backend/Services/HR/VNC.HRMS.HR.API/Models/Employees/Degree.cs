namespace Vnc.HRMS.Models.Employees;

public sealed class Degree
{
    public Guid DegreeId { get; set; }
    public Guid StaffId { get; set; }
    public string? DegreeType { get; set; }
    public string? DegreeName { get; set; }
    public string? IssuedBy { get; set; }
    public DateOnly? IssuedAt { get; set; }
    public string? FileUrl { get; set; }
    public DateTime CreatedAt { get; set; }
}
