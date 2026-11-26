using Microsoft.EntityFrameworkCore;
using Vnc.HRMS.Models;
using Vnc.HRMS.Models.Employees;
namespace Vnc.HRMS.Configurations.Entities;
public static class EmployeesModelConfiguration
{
    public static void Configure(ModelBuilder modelBuilder)
    {
        var staff = modelBuilder.Entity<Staff>();
        staff.ToTable("staff", "dbo", table => { table.HasCheckConstraint("CK_staff_1", "[date_left] IS NULL OR [date_left] >= [date_joined]"); table.HasCheckConstraint("CK_staff_2", "[dependent_count] >= 0"); });
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
        staff.Property(x => x.SiteId).HasColumnName("site_id");
        staff.Property(x => x.IsUnionMember).HasColumnName("is_union_member").HasDefaultValue(true).HasSentinel(true);
        staff.Property(x => x.Status).HasColumnName("status").HasMaxLength(20).HasDefaultValue("active");
        staff.Property(x => x.CreatedBy).HasColumnName("created_by");
        staff.Property(x => x.CreatedAt).HasColumnName("created_at").HasColumnType("datetime2(0)").HasDefaultValueSql("SYSUTCDATETIME()");
        staff.Property(x => x.UpdatedAt).HasColumnName("updated_at").HasColumnType("datetime2(0)").HasDefaultValueSql("SYSUTCDATETIME()");
        staff.HasIndex(x => x.UserId).IsUnique();
        staff.HasOne<Vnc.HRMS.Models.Users.User>().WithOne(x => x.Employee).HasForeignKey<Staff>(x => x.UserId).OnDelete(DeleteBehavior.Restrict);
        staff.HasIndex(x => x.StaffCode).IsUnique();
        staff.HasIndex(x => x.DeviceEnrollId).IsUnique();
        staff.HasIndex(x => x.Email).IsUnique();
        staff.HasIndex(x => x.IdCardNumber).IsUnique();
        staff.HasOne<Vnc.HRMS.Models.Organization.Department>().WithMany().HasForeignKey(x => x.DepartmentId).OnDelete(DeleteBehavior.Restrict);
        staff.HasOne<Vnc.HRMS.Models.Organization.Position>().WithMany().HasForeignKey(x => x.PositionId).OnDelete(DeleteBehavior.Restrict);
        staff.HasOne<Site>().WithMany().HasForeignKey(x => x.SiteId).OnDelete(DeleteBehavior.Restrict);
        var contract = modelBuilder.Entity<Contract>();
        contract.ToTable("contracts", "dbo", table => { table.HasCheckConstraint("CK_contracts_1", "[effective_to] IS NULL OR [effective_to] >= [effective_from]"); table.HasCheckConstraint("CK_contracts_2", "[daily_rate] >= 0 AND ([monthly_salary] IS NULL OR [monthly_salary] >= 0) AND ([insurance_salary_basis] IS NULL OR [insurance_salary_basis] >= 0)"); });
        contract.HasKey(x => x.ContractId);
        contract.Property(x => x.ContractId).HasColumnName("contract_id").HasDefaultValueSql("NEWID()");
        contract.Property(x => x.StaffId).HasColumnName("staff_id");
        contract.Property(x => x.ContractCode).HasColumnName("contract_code").HasMaxLength(30);
        contract.Property(x => x.ContractType).HasColumnName("contract_type").HasMaxLength(50);
        contract.Property(x => x.SalaryType).HasColumnName("salary_type").HasMaxLength(20).HasDefaultValue("daily");
        contract.Property(x => x.DailyRate).HasColumnName("daily_rate").HasPrecision(15, 2);
        contract.Property(x => x.MonthlySalary).HasColumnName("monthly_salary").HasPrecision(15, 2);
        contract.Property(x => x.StandardWorkingDays).HasColumnName("standard_working_days").HasPrecision(5, 2);
        contract.Property(x => x.TaxMethod).HasColumnName("tax_method").HasMaxLength(20).HasDefaultValue("progressive");
        contract.Property(x => x.EffectiveFrom).HasColumnName("effective_from");
        contract.Property(x => x.EffectiveTo).HasColumnName("effective_to");
        contract.Property(x => x.IsInsuranceEligible).HasColumnName("is_insurance_eligible").HasDefaultValue(true).HasSentinel(true);
        contract.Property(x => x.InsuranceSalaryBasis).HasColumnName("insurance_salary_basis").HasPrecision(15, 2);
        contract.Property(x => x.Status).HasColumnName("status").HasMaxLength(20).HasDefaultValue("active");
        contract.Property(x => x.FileUrl).HasColumnName("file_url").HasMaxLength(500);
        contract.Property(x => x.CreatedAt).HasColumnName("created_at").HasColumnType("datetime2(0)").HasDefaultValueSql("SYSUTCDATETIME()");
        contract.Property(x => x.UpdatedAt).HasColumnName("updated_at").HasColumnType("datetime2(0)").HasDefaultValueSql("SYSUTCDATETIME()");
        contract.HasIndex(x => x.ContractCode).IsUnique();
        var degree = modelBuilder.Entity<Degree>();
        degree.ToTable("degrees", "dbo");
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

        var contractSalaryHistory = modelBuilder.Entity<ContractSalaryHistory>();
        contractSalaryHistory.ToTable("contract_salary_histories", "dbo", table => { table.HasCheckConstraint("CK_contract_salary_histories_1", "[effective_to] IS NULL OR [effective_to] >= [effective_from]"); });
        contractSalaryHistory.HasKey(x => x.HistoryId);
        contractSalaryHistory.Property(x => x.HistoryId).HasColumnName("history_id").HasDefaultValueSql("NEWID()");
        contractSalaryHistory.Property(x => x.ContractId).HasColumnName("contract_id");
        contractSalaryHistory.Property(x => x.SalaryType).HasColumnName("salary_type").HasMaxLength(20);
        contractSalaryHistory.Property(x => x.DailyRate).HasColumnName("daily_rate").HasPrecision(15, 2);
        contractSalaryHistory.Property(x => x.MonthlySalary).HasColumnName("monthly_salary").HasPrecision(15, 2);
        contractSalaryHistory.Property(x => x.StandardWorkingDays).HasColumnName("standard_working_days").HasPrecision(5, 2);
        contractSalaryHistory.Property(x => x.IsInsuranceEligible).HasColumnName("is_insurance_eligible");
        contractSalaryHistory.Property(x => x.InsuranceSalaryBasis).HasColumnName("insurance_salary_basis").HasPrecision(15, 2);
        contractSalaryHistory.Property(x => x.TaxMethod).HasColumnName("tax_method").HasMaxLength(20);
        contractSalaryHistory.Property(x => x.EffectiveFrom).HasColumnName("effective_from");
        contractSalaryHistory.Property(x => x.EffectiveTo).HasColumnName("effective_to");
        contractSalaryHistory.Property(x => x.Note).HasColumnName("note").HasMaxLength(500);
        contractSalaryHistory.Property(x => x.CreatedBy).HasColumnName("created_by");
        contractSalaryHistory.Property(x => x.CreatedAt).HasColumnName("created_at").HasColumnType("datetime2(0)").HasDefaultValueSql("SYSUTCDATETIME()");
        contractSalaryHistory.HasIndex(x => new { x.ContractId, x.EffectiveFrom });
        contractSalaryHistory.HasOne<Contract>().WithMany().HasForeignKey(x => x.ContractId).OnDelete(DeleteBehavior.Restrict);

        var dependent = modelBuilder.Entity<Dependent>();
        dependent.ToTable("dependents", "dbo", table =>
        {
            table.HasCheckConstraint("CK_dependents_gender", "[gender] IN ('male', 'female', 'other')");
        });
        dependent.HasKey(x => x.DependentId);
        dependent.Property(x => x.DependentId).HasColumnName("dependent_id").HasDefaultValueSql("NEWID()");
        dependent.Property(x => x.FullName).HasColumnName("full_name").HasMaxLength(100);
        dependent.Property(x => x.DateOfBirth).HasColumnName("date_of_birth");
        dependent.Property(x => x.Gender).HasColumnName("gender").HasMaxLength(10);
        dependent.Property(x => x.IdCardNumber).HasColumnName("id_card_number").HasMaxLength(20);
        dependent.Property(x => x.TaxCode).HasColumnName("tax_code").HasMaxLength(20);
        dependent.Property(x => x.CreatedAt).HasColumnName("created_at").HasColumnType("datetime2(0)").HasDefaultValueSql("SYSUTCDATETIME()");
        dependent.HasIndex(x => x.IdCardNumber).IsUnique().HasFilter("[id_card_number] IS NOT NULL");
        dependent.HasIndex(x => x.TaxCode).IsUnique().HasFilter("[tax_code] IS NOT NULL");

        var staffDependent = modelBuilder.Entity<StaffDependent>();
        staffDependent.ToTable("staff_dependents", "dbo", table =>
        {
            table.HasCheckConstraint("CK_staff_dependents_relationship", "[relationship] IN ('father', 'mother', 'child', 'spouse', 'other')");
        });
        staffDependent.HasKey(x => x.StaffDependentId);
        staffDependent.Property(x => x.StaffDependentId).HasColumnName("staff_dependent_id").HasDefaultValueSql("NEWID()");
        staffDependent.Property(x => x.RegisteredBy).HasColumnName("registered_by");
        staffDependent.Property(x => x.DependentId).HasColumnName("dependent_id");
        staffDependent.Property(x => x.StaffId).HasColumnName("staff_id");
        staffDependent.Property(x => x.Relationship).HasColumnName("relationship").HasMaxLength(20);
        staffDependent.Property(x => x.IsActive).HasColumnName("is_active").HasDefaultValue(true).HasSentinel(true);
        staffDependent.Property(x => x.CreatedAt).HasColumnName("created_at").HasColumnType("datetime2(0)").HasDefaultValueSql("SYSUTCDATETIME()");
        staffDependent.Property(x => x.UpdatedAt).HasColumnName("updated_at").HasColumnType("datetime2(0)").HasDefaultValueSql("SYSUTCDATETIME()");
        staffDependent.HasIndex(x => x.StaffId);
        staffDependent.HasIndex(x => new { x.StaffId, x.DependentId }).IsUnique().HasFilter("[is_active] = 1");
        staffDependent.HasOne<Vnc.HRMS.Models.Users.User>().WithMany().HasForeignKey(x => x.RegisteredBy).OnDelete(DeleteBehavior.Restrict);
        staffDependent.HasOne<Dependent>().WithMany().HasForeignKey(x => x.DependentId).OnDelete(DeleteBehavior.Restrict);
        staffDependent.HasOne<Staff>().WithMany().HasForeignKey(x => x.StaffId).OnDelete(DeleteBehavior.Restrict);

        var dependentDoc = modelBuilder.Entity<DependentDocument>();
        dependentDoc.ToTable("dependent_documents", "dbo", table =>
        {
            table.HasCheckConstraint("CK_dependent_documents_status", "[verification_status] IN ('pending', 'verified', 'rejected', 'expired')");
        });
        dependentDoc.HasKey(x => x.DocumentId);
        dependentDoc.Property(x => x.DocumentId).HasColumnName("document_id").HasDefaultValueSql("NEWID()");
        dependentDoc.Property(x => x.StaffDependentId).HasColumnName("staff_dependent_id");
        dependentDoc.Property(x => x.DocumentType).HasColumnName("document_type").HasMaxLength(50);
        dependentDoc.Property(x => x.FileName).HasColumnName("file_name").HasMaxLength(255);
        dependentDoc.Property(x => x.FileUrl).HasColumnName("file_url").HasMaxLength(500);
        dependentDoc.Property(x => x.VerificationStatus).HasColumnName("verification_status").HasMaxLength(20).HasDefaultValue("pending");
        dependentDoc.Property(x => x.UploadedAt).HasColumnName("uploaded_at").HasColumnType("datetime2(0)").HasDefaultValueSql("SYSUTCDATETIME()");
        dependentDoc.Property(x => x.VerifiedBy).HasColumnName("verified_by");
        dependentDoc.HasIndex(x => x.StaffDependentId);
        dependentDoc.HasOne<StaffDependent>().WithMany().HasForeignKey(x => x.StaffDependentId).OnDelete(DeleteBehavior.Restrict);
        dependentDoc.HasOne<Vnc.HRMS.Models.Users.User>().WithMany().HasForeignKey(x => x.VerifiedBy).OnDelete(DeleteBehavior.Restrict);
    }
}
