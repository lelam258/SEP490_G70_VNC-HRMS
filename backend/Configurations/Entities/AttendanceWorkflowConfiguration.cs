using Microsoft.EntityFrameworkCore;
using Vnc.HRMS.Models;

namespace Vnc.HRMS.Configurations.Entities;

public static class AttendanceWorkflowConfiguration
{
    public static void Configure(ModelBuilder builder)
    {
        var batch = builder.Entity<AttendanceImport>();
        batch.Property(x => x.DeviceSource).HasMaxLength(100);
        batch.Property(x => x.ContentHash).HasMaxLength(64);
        batch.HasIndex(x => new { x.FacilityId, x.PayMonth, x.ContentHash });
        batch.HasOne<ScheduleFacility>().WithMany().HasForeignKey(x => x.FacilityId).OnDelete(DeleteBehavior.Restrict);
        builder.Entity<AttendanceRecord>().HasOne<ScheduleFacility>().WithMany().HasForeignKey(x => x.FacilityId).OnDelete(DeleteBehavior.Restrict);

        var row = builder.Entity<AttendanceImportRow>();
        row.ToTable("attendance_import_rows", "dbo");
        row.HasKey(x => x.Id);
        row.Property(x => x.SheetName).HasMaxLength(128);
        row.Property(x => x.EmployeeBlock).HasMaxLength(500);
        row.Property(x => x.DeviceEnrollId).HasMaxLength(50);
        row.Property(x => x.RawDate).HasMaxLength(100);
        row.Property(x => x.ShiftType).HasMaxLength(30);
        row.Property(x => x.ValidationStatus).HasMaxLength(20);
        row.Property(x => x.ErrorCode).HasMaxLength(50);
        row.Property(x => x.ValidationNote).HasMaxLength(2000);
        row.Property(x => x.CorrectionReason).HasMaxLength(1000);
        row.Property(x => x.Version).IsRowVersion();
        row.Property(x => x.ReportedHours).HasPrecision(10, 2);
        row.Property(x => x.ActualHours).HasPrecision(10, 2);
        row.Property(x => x.LateMinutes).HasPrecision(10, 2);
        row.Property(x => x.EarlyMinutes).HasPrecision(10, 2);
        row.Property(x => x.AttendanceSymbol).HasMaxLength(100);
        row.HasOne<AttendanceImport>().WithMany().HasForeignKey(x => x.ImportId).OnDelete(DeleteBehavior.Restrict);
        row.HasOne<AttendanceRecord>().WithMany().HasForeignKey(x => x.AttendanceId).OnDelete(DeleteBehavior.Restrict);
        row.HasIndex(x => new { x.ImportId, x.SheetName, x.RowNumber, x.ShiftType }).IsUnique();

        var duty = builder.Entity<OnCallShift>();
        duty.Property(x => x.SupervisorEvidence).HasMaxLength(1000);
        duty.Property(x => x.DeviationReason).HasMaxLength(1000);
        duty.Property(x => x.ReviewNote).HasMaxLength(2000);
        duty.Property(x => x.Version).IsRowVersion();
        duty.HasOne<ScheduleFacility>().WithMany().HasForeignKey(x => x.FacilityId).OnDelete(DeleteBehavior.Restrict);
        duty.HasOne<ScheduleAssignment>().WithMany().HasForeignKey(x => x.ScheduleAssignmentId).OnDelete(DeleteBehavior.Restrict);
        duty.HasOne<AttendanceRecord>().WithMany().HasForeignKey(x => x.AttendanceEvidenceId).OnDelete(DeleteBehavior.Restrict);

        var audit = builder.Entity<AuditLog>();
        audit.Property(x => x.Module).HasMaxLength(50).HasDefaultValue("system");
        audit.Property(x => x.Result).HasMaxLength(20).HasDefaultValue("success");
        audit.HasIndex(x => new { x.Module, x.CreatedAt });
    }
}
