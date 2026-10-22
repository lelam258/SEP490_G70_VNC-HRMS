using Microsoft.EntityFrameworkCore;
using Vnc.HRMS.Configurations.Entities;
using Vnc.HRMS.Models.Payroll;

namespace Vnc.HRMS.Persistence.Migrations.Payroll;

public sealed class PayrollDbContext(DbContextOptions<PayrollDbContext> options) : TimestampDbContext(options)
{
    public DbSet<AllowanceType> AllowanceTypes => Set<AllowanceType>();
    public DbSet<PayrollInsuranceConfig> PayrollInsuranceConfigs => Set<PayrollInsuranceConfig>();
    public DbSet<PayrollTaxBracket> PayrollTaxBrackets => Set<PayrollTaxBracket>();
    public DbSet<CommissionRule> CommissionRules => Set<CommissionRule>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("payroll");
        PayrollModelConfiguration.Configure(modelBuilder);
    }
}
