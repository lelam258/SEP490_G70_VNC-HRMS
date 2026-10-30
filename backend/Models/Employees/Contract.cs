namespace Vnc.HRMS.Models.Employees;

public sealed class Contract
{
    public Guid ContractId { get; set; }
    public Guid StaffId { get; set; }
    public string? ContractCode { get; set; }
    public string ContractType { get; set; } = string.Empty;
    public string SalaryType { get; set; } = "daily";
    public decimal DailyRate { get; set; }
    public decimal? MonthlySalary { get; set; }
    public decimal? StandardWorkingDays { get; set; }
    public string TaxMethod { get; set; } = "progressive";
    public DateOnly EffectiveFrom { get; set; }
    public DateOnly? EffectiveTo { get; set; }
    public bool IsInsuranceEligible { get; set; } = true;
    public decimal? InsuranceSalaryBasis { get; set; }
    public string Status { get; set; } = "active";
    public string? FileUrl { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
