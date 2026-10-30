namespace Vnc.HRMS.Models.Employees;

public sealed class ContractSalaryHistory
{
    public Guid HistoryId { get; set; }
    public Guid ContractId { get; set; }
    public string SalaryType { get; set; } = "daily";
    public decimal DailyRate { get; set; }
    public decimal? MonthlySalary { get; set; }
    public bool IsInsuranceEligible { get; set; } = true;
    public decimal? InsuranceSalaryBasis { get; set; }
    public decimal? StandardWorkingDays { get; set; }
    public string TaxMethod { get; set; } = "progressive";
    public DateOnly EffectiveFrom { get; set; }
    public DateOnly? EffectiveTo { get; set; }
    public string? Note { get; set; }
    public Guid? CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

