using Microsoft.EntityFrameworkCore;
using Vnc.HRMS.Models;
namespace Vnc.HRMS.Configurations.Entities;
public static class DomainModelConfiguration
{
    public static void Configure(ModelBuilder modelBuilder)
    {
        {
            var entity = modelBuilder.Entity<Certificate>(); entity.ToTable("certificates", "compliance", table => { table.HasCheckConstraint("CK_certificates_1", "[expiry_date] IS NULL OR [issue_date] IS NULL OR [expiry_date] >= [issue_date]"); });
            entity.Property(x => x.CertificateId).HasColumnName("certificate_id").HasColumnType("uniqueidentifier").HasDefaultValueSql("NEWID()");
            entity.Property(x => x.StaffId).HasColumnName("staff_id").HasColumnType("uniqueidentifier");
            entity.Property(x => x.DepartmentId).HasColumnName("department_id").HasColumnType("uniqueidentifier");
            entity.Property(x => x.CertificateNumber).HasColumnName("certificate_number").HasColumnType("nvarchar(100)");
            entity.HasIndex(x => x.CertificateNumber).IsUnique().HasFilter("[certificate_number] IS NOT NULL");
            entity.Property(x => x.CertificateType).HasColumnName("certificate_type").HasColumnType("nvarchar(100)");
            entity.Property(x => x.IssuingAuthority).HasColumnName("issuing_authority").HasColumnType("nvarchar(200)");
            entity.Property(x => x.IssueDate).HasColumnName("issue_date").HasColumnType("date");
            entity.Property(x => x.ExpiryDate).HasColumnName("expiry_date").HasColumnType("date");
            entity.Property(x => x.ScopeOfPractice).HasColumnName("scope_of_practice").HasColumnType("nvarchar(200)");
            entity.Property(x => x.CmeCycleMonths).HasColumnName("cme_cycle_months").HasColumnType("int");
            entity.Property(x => x.CmeRequiredCredits).HasColumnName("cme_required_credits").HasColumnType("decimal(6,2)");
            entity.Property(x => x.Status).HasColumnName("status").HasColumnType("nvarchar(20)").HasDefaultValueSql("'active'");
            entity.Property(x => x.FileUrl).HasColumnName("file_url").HasColumnType("nvarchar(500)");
            entity.Property(x => x.UploadedBy).HasColumnName("uploaded_by").HasColumnType("uniqueidentifier");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at").HasColumnType("datetime2(0)").HasDefaultValueSql("SYSUTCDATETIME()");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at").HasColumnType("datetime2(0)").HasDefaultValueSql("SYSUTCDATETIME()");
            entity.HasKey(x => x.CertificateId);
        }
        {
            var entity = modelBuilder.Entity<CmeCycle>(); entity.ToTable("cme_cycles", "compliance", table => { table.HasCheckConstraint("CK_cme_cycles_1", "[cycle_end] >= [cycle_start]"); table.HasCheckConstraint("CK_cme_cycles_2", "[cycle_number] > 0 AND [required_credits] >= 0 AND [earned_credits] >= 0"); });
            entity.Property(x => x.CycleId).HasColumnName("cycle_id").HasColumnType("uniqueidentifier").HasDefaultValueSql("NEWID()");
            entity.Property(x => x.CertificateId).HasColumnName("certificate_id").HasColumnType("uniqueidentifier");
            entity.Property(x => x.CycleNumber).HasColumnName("cycle_number").HasColumnType("int");
            entity.Property(x => x.CycleStart).HasColumnName("cycle_start").HasColumnType("date");
            entity.Property(x => x.CycleEnd).HasColumnName("cycle_end").HasColumnType("date");
            entity.Property(x => x.RequiredCredits).HasColumnName("required_credits").HasColumnType("decimal(6,2)");
            entity.Property(x => x.EarnedCredits).HasColumnName("earned_credits").HasColumnType("decimal(6,2)").HasDefaultValueSql("0");
            entity.Property(x => x.Status).HasColumnName("status").HasColumnType("nvarchar(20)").HasDefaultValueSql("'active'");
            entity.HasKey(x => x.CycleId);
            entity.HasIndex(x => new { x.CertificateId, x.CycleNumber }).IsUnique();
        }
        {
            var entity = modelBuilder.Entity<CmeRecord>(); entity.ToTable("cme_records", "compliance", table => { table.HasCheckConstraint("CK_cme_records_1", "[credits] >= 0"); });
            entity.Property(x => x.CmeId).HasColumnName("cme_id").HasColumnType("uniqueidentifier").HasDefaultValueSql("NEWID()");
            entity.Property(x => x.CertificateId).HasColumnName("certificate_id").HasColumnType("uniqueidentifier");
            entity.Property(x => x.CmeCycleId).HasColumnName("cme_cycle_id").HasColumnType("uniqueidentifier");
            entity.Property(x => x.CourseName).HasColumnName("course_name").HasColumnType("nvarchar(200)");
            entity.Property(x => x.Provider).HasColumnName("provider").HasColumnType("nvarchar(200)");
            entity.Property(x => x.CompletedDate).HasColumnName("completed_date").HasColumnType("date");
            entity.Property(x => x.Credits).HasColumnName("credits").HasColumnType("decimal(5,2)");
            entity.Property(x => x.FileUrl).HasColumnName("file_url").HasColumnType("nvarchar(500)");
            entity.Property(x => x.Verified).HasColumnName("verified").HasColumnType("bit").HasDefaultValueSql("0");
            entity.Property(x => x.VerifiedBy).HasColumnName("verified_by").HasColumnType("uniqueidentifier");
            entity.Property(x => x.VerifiedAt).HasColumnName("verified_at").HasColumnType("datetime2(0)");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at").HasColumnType("datetime2(0)").HasDefaultValueSql("SYSUTCDATETIME()");
            entity.HasKey(x => x.CmeId);
        }
        {
            var entity = modelBuilder.Entity<ComplianceScan>(); entity.ToTable("compliance_scans", "compliance");
            entity.Property(x => x.ScanId).HasColumnName("scan_id").HasColumnType("uniqueidentifier").HasDefaultValueSql("NEWID()");
            entity.Property(x => x.StaffId).HasColumnName("staff_id").HasColumnType("uniqueidentifier");
            entity.Property(x => x.DepartmentId).HasColumnName("department_id").HasColumnType("uniqueidentifier");
            entity.Property(x => x.CertificateId).HasColumnName("certificate_id").HasColumnType("uniqueidentifier");
            entity.Property(x => x.ScanDate).HasColumnName("scan_date").HasColumnType("datetime2(0)").HasDefaultValueSql("SYSUTCDATETIME()");
            entity.Property(x => x.ExpiryDate).HasColumnName("expiry_date").HasColumnType("date");
            entity.Property(x => x.DaysRemaining).HasColumnName("days_remaining").HasColumnType("int");
            entity.Property(x => x.CmeCreditsEarned).HasColumnName("cme_credits_earned").HasColumnType("decimal(6,2)");
            entity.Property(x => x.CmeCreditsNeeded).HasColumnName("cme_credits_needed").HasColumnType("decimal(6,2)");
            entity.Property(x => x.ComplianceStatus).HasColumnName("compliance_status").HasColumnType("nvarchar(30)");
            entity.Property(x => x.AlertSent).HasColumnName("alert_sent").HasColumnType("bit").HasDefaultValueSql("0");
            entity.Property(x => x.AlertSentAt).HasColumnName("alert_sent_at").HasColumnType("datetime2(0)");
            entity.HasKey(x => x.ScanId);
        }
        modelBuilder.Entity<CmeCycle>().HasOne<Certificate>().WithMany().HasForeignKey(x => x.CertificateId).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<CmeRecord>().HasOne<Certificate>().WithMany().HasForeignKey(x => x.CertificateId).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<CmeRecord>().HasOne<CmeCycle>().WithMany().HasForeignKey(x => x.CmeCycleId).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<ComplianceScan>().HasOne<Certificate>().WithMany().HasForeignKey(x => x.CertificateId).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<Certificate>().HasIndex(x => new { x.ExpiryDate, x.Status }).HasDatabaseName("IX_certificates_expiry_date");
        modelBuilder.Entity<CmeCycle>().HasIndex(x => new { x.CycleEnd, x.Status }).HasDatabaseName("IX_cme_cycles_cycle_end");
    }
}
