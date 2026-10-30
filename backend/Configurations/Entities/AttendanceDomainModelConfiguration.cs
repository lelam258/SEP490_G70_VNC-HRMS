using Microsoft.EntityFrameworkCore;
using Vnc.HRMS.Models;
namespace Vnc.HRMS.Configurations.Entities;
public static class AttendanceDomainModelConfiguration
{
    public static void Configure(ModelBuilder modelBuilder)
    {
        {
            var entity = modelBuilder.Entity<AttendanceImport>(); entity.ToTable("attendance_imports", "dbo", table => { table.HasCheckConstraint("CK_attendance_imports_1", "[total_rows] >= 0 AND [success_rows] >= 0 AND [error_rows] >= 0"); });
            entity.Property(x => x.ImportId).HasColumnName("import_id").HasColumnType("uniqueidentifier").HasDefaultValueSql("NEWID()");
            entity.Property(x => x.FileName).HasColumnName("file_name").HasColumnType("nvarchar(255)");
            entity.Property(x => x.FileUrl).HasColumnName("file_url").HasColumnType("nvarchar(500)");
            entity.Property(x => x.ImportedBy).HasColumnName("imported_by").HasColumnType("uniqueidentifier");
            entity.Property(x => x.ImportDate).HasColumnName("import_date").HasColumnType("datetime2(0)").HasDefaultValueSql("SYSUTCDATETIME()");
            entity.Property(x => x.PayMonth).HasColumnName("pay_month").HasColumnType("nvarchar(7)");
            entity.Property(x => x.TotalRows).HasColumnName("total_rows").HasColumnType("int").HasDefaultValueSql("0");
            entity.Property(x => x.SuccessRows).HasColumnName("success_rows").HasColumnType("int").HasDefaultValueSql("0");
            entity.Property(x => x.ErrorRows).HasColumnName("error_rows").HasColumnType("int").HasDefaultValueSql("0");
            entity.Property(x => x.Status).HasColumnName("status").HasColumnType("nvarchar(20)").HasDefaultValueSql("'pending'");
            entity.Property(x => x.ErrorLog).HasColumnName("error_log").HasColumnType("nvarchar(max)");
            entity.Property(x => x.ColumnMapping).HasColumnName("column_mapping").HasColumnType("nvarchar(max)");
            entity.HasKey(x => x.ImportId);
        }
        {
            var entity = modelBuilder.Entity<OnCallShift>(); entity.ToTable("on_call_shifts", "dbo", table => { table.HasCheckConstraint("CK_on_call_shifts_1", "[shift_end] IS NULL OR [shift_start] IS NULL OR [shift_end] > [shift_start]"); });
            entity.Property(x => x.ShiftId).HasColumnName("shift_id").HasColumnType("uniqueidentifier").HasDefaultValueSql("NEWID()");
            entity.Property(x => x.StaffId).HasColumnName("staff_id").HasColumnType("uniqueidentifier");
            entity.Property(x => x.DepartmentId).HasColumnName("department_id").HasColumnType("uniqueidentifier");
            entity.Property(x => x.ShiftDate).HasColumnName("shift_date").HasColumnType("date");
            entity.Property(x => x.ShiftCategory).HasColumnName("shift_category").HasColumnType("nvarchar(30)");
            entity.Property(x => x.ShiftStart).HasColumnName("shift_start").HasColumnType("datetime2(0)");
            entity.Property(x => x.ShiftEnd).HasColumnName("shift_end").HasColumnType("datetime2(0)");
            entity.Property(x => x.RecordedBy).HasColumnName("recorded_by").HasColumnType("uniqueidentifier");
            entity.Property(x => x.ConfirmedBy).HasColumnName("confirmed_by").HasColumnType("uniqueidentifier");
            entity.Property(x => x.ConfirmedAt).HasColumnName("confirmed_at").HasColumnType("datetime2(0)");
            entity.Property(x => x.Status).HasColumnName("status").HasColumnType("nvarchar(20)").HasDefaultValueSql("'pending'");
            entity.Property(x => x.RejectedReason).HasColumnName("rejected_reason").HasColumnType("nvarchar(max)");
            entity.Property(x => x.Note).HasColumnName("note").HasColumnType("nvarchar(max)");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at").HasColumnType("datetime2(0)").HasDefaultValueSql("SYSUTCDATETIME()");
            entity.HasKey(x => x.ShiftId);
        }
        {
            var entity = modelBuilder.Entity<AttendanceRecord>(); entity.ToTable("attendance_records", "dbo", table => { table.HasCheckConstraint("CK_attendance_records_1", "[check_out] IS NULL OR [check_in] IS NULL OR [check_out] >= [check_in]"); table.HasCheckConstraint("CK_attendance_records_2", "[actual_hours] IS NULL OR [actual_hours] >= 0"); });
            entity.Property(x => x.AttendanceId).HasColumnName("attendance_id").HasColumnType("uniqueidentifier").HasDefaultValueSql("NEWID()");
            entity.Property(x => x.StaffId).HasColumnName("staff_id").HasColumnType("uniqueidentifier");
            entity.Property(x => x.StaffCode).HasColumnName("staff_code").HasColumnType("nvarchar(20)");
            entity.Property(x => x.DeviceEnrollId).HasColumnName("device_enroll_id").HasMaxLength(50);
            entity.Property(x => x.DepartmentId).HasColumnName("department_id").HasColumnType("uniqueidentifier");
            entity.Property(x => x.ImportId).HasColumnName("import_id").HasColumnType("uniqueidentifier");
            entity.Property(x => x.OnCallShiftId).HasColumnName("on_call_shift_id").HasColumnType("uniqueidentifier");
            entity.Property(x => x.WorkDate).HasColumnName("work_date").HasColumnType("date");
            entity.Property(x => x.ShiftType).HasColumnName("shift_type").HasColumnType("nvarchar(30)");
            entity.Property(x => x.CheckIn).HasColumnName("check_in").HasColumnType("datetime2(0)");
            entity.Property(x => x.CheckOut).HasColumnName("check_out").HasColumnType("datetime2(0)");
            entity.Property(x => x.ActualHours).HasColumnName("actual_hours").HasColumnType("decimal(5,2)");
            entity.Property(x => x.Source).HasColumnName("source").HasColumnType("nvarchar(20)").HasDefaultValueSql("'fingerprint'");
            entity.Property(x => x.ValidationStatus).HasColumnName("validation_status").HasColumnType("nvarchar(20)").HasDefaultValueSql("'pending'");
            entity.Property(x => x.Note).HasColumnName("note").HasColumnType("nvarchar(max)");
            entity.Property(x => x.ReconciledBy).HasColumnName("reconciled_by").HasColumnType("uniqueidentifier");
            entity.Property(x => x.ReconciledAt).HasColumnName("reconciled_at").HasColumnType("datetime2(0)");
            entity.Property(x => x.ReconcileNote).HasColumnName("reconcile_note").HasColumnType("nvarchar(max)");
            entity.Property(x => x.ConfirmedBy).HasColumnName("confirmed_by").HasColumnType("uniqueidentifier");
            entity.Property(x => x.ConfirmedAt).HasColumnName("confirmed_at").HasColumnType("datetime2(0)");
            entity.Property(x => x.PayslipId).HasColumnName("payslip_id").HasColumnType("uniqueidentifier");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at").HasColumnType("datetime2(0)").HasDefaultValueSql("SYSUTCDATETIME()");
            entity.HasKey(x => x.AttendanceId);
            entity.HasIndex(x => new { x.StaffId, x.WorkDate, x.ShiftType }).IsUnique();
        }
        {
            var entity = modelBuilder.Entity<LeaveRequest>(); entity.ToTable("leave_requests", "dbo", table => { table.HasCheckConstraint("CK_leave_requests_1", "[end_date] >= [start_date]"); table.HasCheckConstraint("CK_leave_requests_2", "[total_days] IS NULL OR [total_days] > 0"); });
            entity.Property(x => x.RequestId).HasColumnName("request_id").HasColumnType("uniqueidentifier").HasDefaultValueSql("NEWID()");
            entity.Property(x => x.StaffId).HasColumnName("staff_id").HasColumnType("uniqueidentifier");
            entity.Property(x => x.DepartmentId).HasColumnName("department_id").HasColumnType("uniqueidentifier");
            entity.Property(x => x.LeaveType).HasColumnName("leave_type").HasColumnType("nvarchar(50)");
            entity.Property(x => x.StartDate).HasColumnName("start_date").HasColumnType("date");
            entity.Property(x => x.EndDate).HasColumnName("end_date").HasColumnType("date");
            entity.Property(x => x.TotalDays).HasColumnName("total_days").HasColumnType("decimal(4,1)");
            entity.Property(x => x.Reason).HasColumnName("reason").HasColumnType("nvarchar(max)");
            entity.Property(x => x.AttachmentUrl).HasColumnName("attachment_url").HasColumnType("nvarchar(500)");
            entity.Property(x => x.Status).HasColumnName("status").HasColumnType("nvarchar(20)").HasDefaultValueSql("'pending'");
            entity.Property(x => x.ApprovedBy).HasColumnName("approved_by").HasColumnType("uniqueidentifier");
            entity.Property(x => x.ApprovedAt).HasColumnName("approved_at").HasColumnType("datetime2(0)");
            entity.Property(x => x.RejectedReason).HasColumnName("rejected_reason").HasColumnType("nvarchar(max)");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at").HasColumnType("datetime2(0)").HasDefaultValueSql("SYSUTCDATETIME()");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at").HasColumnType("datetime2(0)").HasDefaultValueSql("SYSUTCDATETIME()");
            entity.HasKey(x => x.RequestId);
        }
        {
            var entity = modelBuilder.Entity<LeaveType>();
            entity.ToTable("leave_types", "dbo");
            entity.Property(x => x.LeaveTypeId).HasColumnName("leave_type_id").HasColumnType("uniqueidentifier").HasDefaultValueSql("NEWID()");
            entity.Property(x => x.Code).HasColumnName("code").HasColumnType("nvarchar(50)");
            entity.Property(x => x.Name).HasColumnName("name").HasColumnType("nvarchar(100)");
            entity.Property(x => x.Description).HasColumnName("description").HasColumnType("nvarchar(255)");
            entity.Property(x => x.IsPaid).HasColumnName("is_paid").HasColumnType("bit").HasDefaultValue(true).HasSentinel(true);
            entity.Property(x => x.Status).HasColumnName("status").HasColumnType("nvarchar(20)").HasDefaultValueSql("'active'");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at").HasColumnType("datetime2(0)").HasDefaultValueSql("SYSUTCDATETIME()");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at").HasColumnType("datetime2(0)").HasDefaultValueSql("SYSUTCDATETIME()");
            entity.HasKey(x => x.LeaveTypeId);
            entity.HasIndex(x => x.Code).IsUnique();
        }
        {
            var entity = modelBuilder.Entity<WorkScheduleTemplate>(); entity.ToTable("work_schedule_templates", "dbo", table => { table.HasCheckConstraint("CK_work_schedule_templates_1", "[break_minutes] >= 0"); });
            entity.Property(x => x.TemplateId).HasColumnName("template_id").HasColumnType("uniqueidentifier").HasDefaultValueSql("NEWID()");
            entity.Property(x => x.Name).HasColumnName("name").HasColumnType("nvarchar(100)");
            entity.Property(x => x.ShiftStart).HasColumnName("shift_start").HasColumnType("time");
            entity.Property(x => x.ShiftEnd).HasColumnName("shift_end").HasColumnType("time");
            entity.Property(x => x.BreakMinutes).HasColumnName("break_minutes").HasColumnType("int").HasDefaultValueSql("0");
            entity.Property(x => x.StandardHours).HasColumnName("standard_hours").HasColumnType("decimal(4,2)");
            entity.Property(x => x.Description).HasColumnName("description").HasColumnType("nvarchar(max)");
            entity.Property(x => x.Status).HasColumnName("status").HasColumnType("nvarchar(20)").HasDefaultValueSql("'active'");
            entity.HasKey(x => x.TemplateId);
        }
        {
            var entity = modelBuilder.Entity<MonthlyTimesheet>(); entity.ToTable("monthly_timesheets", "dbo", table => { table.HasCheckConstraint("CK_monthly_timesheets_1", "[pay_month] LIKE '[12][0-9][0-9][0-9]-[01][0-9]' AND TRY_CONVERT(date, [pay_month] + '-01', 23) IS NOT NULL"); });
            entity.Property(x => x.TimesheetId).HasColumnName("timesheet_id").HasColumnType("uniqueidentifier").HasDefaultValueSql("NEWID()");
            entity.Property(x => x.PayMonth).HasColumnName("pay_month").HasColumnType("nvarchar(7)");
            entity.HasIndex(x => x.PayMonth).IsUnique();
            entity.Property(x => x.Status).HasColumnName("status").HasColumnType("nvarchar(20)").HasDefaultValueSql("'draft'");
            entity.Property(x => x.LockedBy).HasColumnName("locked_by").HasColumnType("uniqueidentifier");
            entity.Property(x => x.LockedAt).HasColumnName("locked_at").HasColumnType("datetime2(0)");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at").HasColumnType("datetime2(0)").HasDefaultValueSql("SYSUTCDATETIME()");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at").HasColumnType("datetime2(0)").HasDefaultValueSql("SYSUTCDATETIME()");
            entity.HasKey(x => x.TimesheetId);
        }
        modelBuilder.Entity<AttendanceRecord>().HasOne<AttendanceImport>().WithMany().HasForeignKey(x => x.ImportId).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<AttendanceRecord>().HasOne<OnCallShift>().WithMany().HasForeignKey(x => x.OnCallShiftId).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<AttendanceRecord>().HasIndex(x => new { x.WorkDate, x.DepartmentId, x.ValidationStatus }).HasDatabaseName("IX_attendance_records_work_date");
        modelBuilder.Entity<AttendanceRecord>().HasIndex(x => new { x.StaffCode, x.WorkDate }).HasDatabaseName("IX_attendance_records_staff_code_work_date");
    }
}
