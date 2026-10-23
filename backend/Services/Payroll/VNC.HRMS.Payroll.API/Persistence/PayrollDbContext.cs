using Microsoft.EntityFrameworkCore;
using Vnc.HRMS.Configurations.Entities;
using Vnc.HRMS.Models;
namespace Vnc.HRMS.Persistence;
public sealed class PayrollDbContext(DbContextOptions<PayrollDbContext> options) : TimestampDbContext(options)
{
    public DbSet<ProcedureService> ProcedureServices => Set<ProcedureService>();
    public DbSet<CommissionRule> CommissionRules => Set<CommissionRule>();
    public DbSet<ProcedureSlip> ProcedureSlips => Set<ProcedureSlip>();
    public DbSet<ProcedureAssignment> ProcedureAssignments => Set<ProcedureAssignment>();
    public DbSet<MaternityCase> MaternityCases => Set<MaternityCase>();
    public DbSet<AllowanceType> AllowanceTypes => Set<AllowanceType>();
    public DbSet<StaffAllowance> StaffAllowances => Set<StaffAllowance>();
    public DbSet<PayrollTaxBracket> PayrollTaxBrackets => Set<PayrollTaxBracket>();
    public DbSet<PayrollInsuranceConfig> PayrollInsuranceConfigs => Set<PayrollInsuranceConfig>();
    public DbSet<BankExport> BankExports => Set<BankExport>();
    public DbSet<PayrollLock> PayrollLocks => Set<PayrollLock>();
    public DbSet<Payslip> Payslips => Set<Payslip>();
    public DbSet<PayslipAllowance> PayslipAllowances => Set<PayslipAllowance>();
    public DbSet<PayslipDeduction> PayslipDeductions => Set<PayslipDeduction>();
    public DbSet<Complaint> Complaints => Set<Complaint>();
    public DbSet<ComplaintAttachment> ComplaintAttachments => Set<ComplaintAttachment>();
    protected override void OnModelCreating(ModelBuilder modelBuilder) => DomainModelConfiguration.Configure(modelBuilder);
}
