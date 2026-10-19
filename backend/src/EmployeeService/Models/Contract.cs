namespace Vnc.HRMS.EmployeeService.Models;

public sealed class Contract
{
    public Guid ContractId { get; set; }
    public Guid StaffId { get; set; }
    public string? ContractCode { get; set; }
    public string ContractType { get; set; } = string.Empty;
    public decimal DailyRate { get; set; }
    public DateOnly EffectiveFrom { get; set; }
    public DateOnly? EffectiveTo { get; set; }
    public bool IsInsuranceEligible { get; set; } = true;
    public decimal? InsuranceSalaryBasis { get; set; }
    public string Status { get; set; } = "active";
    public string? FileUrl { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

