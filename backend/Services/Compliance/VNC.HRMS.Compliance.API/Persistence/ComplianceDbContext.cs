using Microsoft.EntityFrameworkCore;
using Vnc.HRMS.Configurations.Entities;
using Vnc.HRMS.Models;
namespace Vnc.HRMS.Persistence;
public sealed class ComplianceDbContext(DbContextOptions<ComplianceDbContext> options) : TimestampDbContext(options)
{
    public DbSet<Certificate> Certificates => Set<Certificate>();
    public DbSet<CmeCycle> CmeCycles => Set<CmeCycle>();
    public DbSet<CmeRecord> CmeRecords => Set<CmeRecord>();
    public DbSet<ComplianceScan> ComplianceScans => Set<ComplianceScan>();
    protected override void OnModelCreating(ModelBuilder modelBuilder) => DomainModelConfiguration.Configure(modelBuilder);
}
