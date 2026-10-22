using Microsoft.EntityFrameworkCore;
using Vnc.HRMS.Models.Employees;
namespace Vnc.HRMS.Configurations.Entities;
public static class EmployeesModelConfiguration
{
    public static void Configure(ModelBuilder modelBuilder)
    {
        var staff = modelBuilder.Entity<Staff>();
        staff.ToTable("staff", "employees");
        staff.HasKey(x => x.StaffId);
        staff.Property(x => x.StaffId).HasColumnName("staff_id").HasDefaultValueSql("NEWID()");
        staff.Property(x => x.UserId).HasColumnName("user_id");
        staff.Property(x => x.StaffCode).HasColumnName("staff_code").HasMaxLength(20);
        staff.Property(x => x.DeviceEnrollId).HasColumnName("device_enroll_id").HasMaxLength(50);
        staff.Property(x => x.FullName).HasColumnName("full_name").HasMaxLength(100);
        staff.Property(x => x.DateOfBirth).HasColumnName("date_of_birth");
        staff.Property(x => x.Gender).HasColumnName("gender").HasMaxLength(10);
        staff.Property(x => x.Phone).HasColumnName("phone").HasMaxLength(20);
        staff.Property(x => x.Email).HasColumnName("email").HasMaxLength(100);
        staff.Property(x => x.IdCardNumber).HasColumnName("id_card_number").HasMaxLength(20);
        staff.Property(x => x.AvatarUrl).HasColumnName("avatar_url").HasMaxLength(500);
        staff.Property(x => x.DepartmentId).HasColumnName("department_id");
        staff.Property(x => x.PositionId).HasColumnName("position_id");
        staff.Property(x => x.ScopeOfPractice).HasColumnName("scope_of_practice").HasMaxLength(200);
        staff.Property(x => x.DateJoined).HasColumnName("date_joined");
        staff.Property(x => x.DateLeft).HasColumnName("date_left");
        staff.Property(x => x.DependentCount).HasColumnName("dependent_count");
        staff.Property(x => x.Status).HasColumnName("status").HasMaxLength(20).HasDefaultValue("active");
        staff.Property(x => x.CreatedBy).HasColumnName("created_by");
        staff.Property(x => x.CreatedAt).HasColumnName("created_at").HasColumnType("datetime2(0)").HasDefaultValueSql("SYSUTCDATETIME()");
        staff.Property(x => x.UpdatedAt).HasColumnName("updated_at").HasColumnType("datetime2(0)").HasDefaultValueSql("SYSUTCDATETIME()");
        staff.HasIndex(x => x.UserId).IsUnique();
        staff.HasIndex(x => x.StaffCode).IsUnique();
        staff.HasIndex(x => x.DeviceEnrollId).IsUnique();
        staff.HasIndex(x => x.Email).IsUnique();
        staff.HasIndex(x => x.IdCardNumber).IsUnique();
        var contract = modelBuilder.Entity<Contract>();
        contract.ToTable("contracts", "employees");
        contract.HasKey(x => x.ContractId);
        contract.Property(x => x.ContractId).HasColumnName("contract_id").HasDefaultValueSql("NEWID()");
        contract.Property(x => x.StaffId).HasColumnName("staff_id");
        contract.Property(x => x.ContractCode).HasColumnName("contract_code").HasMaxLength(30);
        contract.Property(x => x.ContractType).HasColumnName("contract_type").HasMaxLength(50);
        contract.Property(x => x.DailyRate).HasColumnName("daily_rate").HasPrecision(15, 2);
        contract.Property(x => x.EffectiveFrom).HasColumnName("effective_from");
        contract.Property(x => x.EffectiveTo).HasColumnName("effective_to");
        contract.Property(x => x.IsInsuranceEligible).HasColumnName("is_insurance_eligible").HasDefaultValue(true);
        contract.Property(x => x.InsuranceSalaryBasis).HasColumnName("insurance_salary_basis").HasPrecision(15, 2);
        contract.Property(x => x.Status).HasColumnName("status").HasMaxLength(20).HasDefaultValue("active");
        contract.Property(x => x.FileUrl).HasColumnName("file_url").HasMaxLength(500);
        contract.Property(x => x.CreatedAt).HasColumnName("created_at").HasColumnType("datetime2(0)").HasDefaultValueSql("SYSUTCDATETIME()");
        contract.Property(x => x.UpdatedAt).HasColumnName("updated_at").HasColumnType("datetime2(0)").HasDefaultValueSql("SYSUTCDATETIME()");
        contract.HasIndex(x => x.ContractCode).IsUnique();
        var degree = modelBuilder.Entity<Degree>();
        degree.ToTable("degrees", "employees");
        degree.HasKey(x => x.DegreeId);
        degree.Property(x => x.DegreeId).HasColumnName("degree_id").HasDefaultValueSql("NEWID()");
        degree.Property(x => x.StaffId).HasColumnName("staff_id");
        degree.Property(x => x.DegreeType).HasColumnName("degree_type").HasMaxLength(50);
        degree.Property(x => x.DegreeName).HasColumnName("degree_name").HasMaxLength(200);
        degree.Property(x => x.IssuedBy).HasColumnName("issued_by").HasMaxLength(200);
        degree.Property(x => x.IssuedAt).HasColumnName("issued_at");
        degree.Property(x => x.FileUrl).HasColumnName("file_url").HasMaxLength(500);
        degree.Property(x => x.CreatedAt).HasColumnName("created_at").HasColumnType("datetime2(0)").HasDefaultValueSql("SYSUTCDATETIME()");
        modelBuilder.Entity<Contract>().HasOne<Staff>().WithMany().HasForeignKey(x => x.StaffId).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<Degree>().HasOne<Staff>().WithMany().HasForeignKey(x => x.StaffId).OnDelete(DeleteBehavior.Restrict);
    }
}
