namespace Vnc.HRMS.Models;
public sealed class MaternityCase
{
    public Guid MaternityCaseId { get; set; }
    public Guid StaffId { get; set; }
    public Guid? LeaveRequestId { get; set; }
    public DateOnly? ExpectedDueDate { get; set; }
    public DateOnly? ActualBirthDate { get; set; }
    public DateOnly LeaveStartDate { get; set; }
    public DateOnly LeaveEndDate { get; set; }
    public bool InsuranceEligible { get; set; }
    public int? ContributionMonths { get; set; }
    public decimal? AverageInsuranceSalary { get; set; }
    public decimal BenefitAmount { get; set; }
    public decimal AdditionalBenefitAmount { get; set; }
    public decimal TotalBenefitAmount { get; private set; }
    public string Status { get; set; } = string.Empty;
    public string? SupportingDocumentUrl { get; set; }
    public string? Notes { get; set; }
    public Guid? ReviewedBy { get; set; }
    public DateTime? ReviewedAt { get; set; }
    public DateTime? PaidAt { get; set; }
    public DateTime CreatedAt { get; set; }
}
