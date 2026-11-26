namespace Vnc.HRMS.Models.Employees;

public sealed class Dependent
{
    public Guid DependentId { get; set; }
    public string FullName { get; set; } = string.Empty;
    public DateOnly DateOfBirth { get; set; }
    public string Gender { get; set; } = string.Empty;
    public string? IdCardNumber { get; set; }
    public string? TaxCode { get; set; }
    public DateTime CreatedAt { get; set; }
}
