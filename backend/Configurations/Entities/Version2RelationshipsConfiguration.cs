using Microsoft.EntityFrameworkCore;
using Vnc.HRMS.Models;
using Vnc.HRMS.Models.Users;
using Vnc.HRMS.Models.Employees;
using Vnc.HRMS.Models.Organization;

namespace Vnc.HRMS.Configurations.Entities;

// Cross-module foreign keys from the agreed SQL schema 2.0, in the shared database.
public static class Version2RelationshipsConfiguration
{
    public static void Configure(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Staff>().HasOne<User>().WithMany().HasForeignKey(x => x.CreatedBy).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<AttendanceImport>().HasOne<User>().WithMany().HasForeignKey(x => x.ImportedBy).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<AttendanceRecord>().HasOne<Staff>().WithMany().HasForeignKey(x => x.StaffId).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<AttendanceRecord>().HasOne<Department>().WithMany().HasForeignKey(x => x.DepartmentId).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<OnCallShift>().HasOne<Staff>().WithMany().HasForeignKey(x => x.StaffId).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<OnCallShift>().HasOne<Department>().WithMany().HasForeignKey(x => x.DepartmentId).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<LeaveRequest>().HasOne<Staff>().WithMany().HasForeignKey(x => x.StaffId).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<LeaveRequest>().HasOne<Department>().WithMany().HasForeignKey(x => x.DepartmentId).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<MonthlyTimesheet>().HasOne<User>().WithMany().HasForeignKey(x => x.LockedBy).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<ProcedureSlip>().HasOne<Department>().WithMany().HasForeignKey(x => x.DepartmentId).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<ProcedureAssignment>().HasOne<Staff>().WithMany().HasForeignKey(x => x.StaffId).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<MaternityCase>().HasOne<Staff>().WithMany().HasForeignKey(x => x.StaffId).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<MaternityCase>().HasOne<LeaveRequest>().WithMany().HasForeignKey(x => x.LeaveRequestId).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<StaffAllowance>().HasOne<Staff>().WithMany().HasForeignKey(x => x.StaffId).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<BankExport>().HasOne<User>().WithMany().HasForeignKey(x => x.ExportedBy).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<Payslip>().HasOne<Staff>().WithMany().HasForeignKey(x => x.StaffId).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<Payslip>().HasOne<Contract>().WithMany().HasForeignKey(x => x.ContractId).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<Complaint>().HasOne<Staff>().WithMany().HasForeignKey(x => x.StaffId).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<Certificate>().HasOne<Staff>().WithMany().HasForeignKey(x => x.StaffId).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<ComplianceScan>().HasOne<Staff>().WithMany().HasForeignKey(x => x.StaffId).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<Notification>().HasOne<User>().WithMany().HasForeignKey(x => x.RecipientId).OnDelete(DeleteBehavior.Restrict);
    }
}
