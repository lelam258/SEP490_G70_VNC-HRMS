using Microsoft.EntityFrameworkCore;
using Vnc.HRMS.Configurations.Entities;
using Vnc.HRMS.Models;
using Vnc.HRMS.Models.Auth;
using Vnc.HRMS.Models.Users;
using Vnc.HRMS.Models.Employees;
using Vnc.HRMS.Models.Organization;
namespace Vnc.HRMS.Persistence;
public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : TimestampDbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<PasswordResetToken> PasswordResetTokens => Set<PasswordResetToken>();
    public DbSet<Staff> Staff => Set<Staff>();
    public DbSet<Contract> Contracts => Set<Contract>();
    public DbSet<Degree> Degrees => Set<Degree>();
    public DbSet<Department> Departments => Set<Department>();
    public DbSet<Position> Positions => Set<Position>();
    public DbSet<AttendanceImport> AttendanceImports => Set<AttendanceImport>();
    public DbSet<OnCallShift> OnCallShifts => Set<OnCallShift>();
    public DbSet<AttendanceRecord> AttendanceRecords => Set<AttendanceRecord>();
    public DbSet<LeaveRequest> LeaveRequests => Set<LeaveRequest>();
    public DbSet<WorkScheduleTemplate> WorkScheduleTemplates => Set<WorkScheduleTemplate>();
    public DbSet<MonthlyTimesheet> MonthlyTimesheets => Set<MonthlyTimesheet>();
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
    public DbSet<Certificate> Certificates => Set<Certificate>();
    public DbSet<CmeCycle> CmeCycles => Set<CmeCycle>();
    public DbSet<CmeRecord> CmeRecords => Set<CmeRecord>();
    public DbSet<ComplianceScan> ComplianceScans => Set<ComplianceScan>();
    public DbSet<Notification> Notifications => Set<Notification>();
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        IAMDomainModelConfiguration.Configure(modelBuilder);
        UsersModelConfiguration.Configure(modelBuilder);
        AuthModelConfiguration.Configure(modelBuilder);
        EmployeesModelConfiguration.Configure(modelBuilder);
        OrganizationModelConfiguration.Configure(modelBuilder);
        AttendanceDomainModelConfiguration.Configure(modelBuilder);
        PayrollDomainModelConfiguration.Configure(modelBuilder);
        ComplianceDomainModelConfiguration.Configure(modelBuilder);
        NotificationDomainModelConfiguration.Configure(modelBuilder);
        Version2RelationshipsConfiguration.Configure(modelBuilder);
    }
}
