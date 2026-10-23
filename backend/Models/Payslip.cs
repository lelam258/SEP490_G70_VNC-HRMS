namespace Vnc.HRMS.Models;
public sealed class Payslip
{
    public Guid PayslipId { get; set; }
    public Guid StaffId { get; set; }
    public string? StaffName { get; set; }
    public Guid? DepartmentId { get; set; }
    public Guid? ContractId { get; set; }
    public string? ContractType { get; set; }
    public string PayMonth { get; set; } = string.Empty;
    public decimal? WorkDays { get; set; }
    public decimal? OnCallDays { get; set; }
    public decimal? MaternityLeaveDays { get; set; }
    public decimal? BasePay { get; set; }
    public decimal? AllowanceTotal { get; set; }
    public decimal? CommissionTotal { get; set; }
    public decimal? MaternityAllowance { get; set; }
    public decimal? GrossPay { get; set; }
    public decimal? InsuranceSalaryBase { get; set; }
    public decimal? InsuranceDeduction { get; set; }
    public int? DependentCount { get; set; }
    public decimal? PersonalDeduction { get; set; }
    public decimal? DependentDeduction { get; set; }
    public decimal? TaxableIncome { get; set; }
    public decimal? TaxDeduction { get; set; }
    public decimal? OtherDeduction { get; set; }
    public decimal? NetPay { get; set; }
    public string? Status { get; set; }
    public Guid? DeptApprovedBy { get; set; }
    public DateTime? DeptApprovedAt { get; set; }
    public string? DeptRejectedReason { get; set; }
    public Guid? FinalizedBy { get; set; }
    public DateTime? FinalizedAt { get; set; }
    public DateOnly? PaymentDate { get; set; }
    public Guid? BankExportId { get; set; }
    public bool? IsLocked { get; set; }
    public DateTime? LockedAt { get; set; }
    public DateTime? CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}
