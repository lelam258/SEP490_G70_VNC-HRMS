using Microsoft.EntityFrameworkCore;
using Vnc.HRMS.Models;
namespace Vnc.HRMS.Configurations.Entities;
public static class PayrollDomainModelConfiguration
{
    public static void Configure(ModelBuilder modelBuilder)
    {
        {
            var entity = modelBuilder.Entity<ProcedureService>(); entity.ToTable("procedure_services", "payroll");
            entity.Property(x => x.ServiceId).HasColumnName("service_id").HasColumnType("uniqueidentifier").HasDefaultValueSql("NEWID()");
            entity.Property(x => x.ServiceCode).HasColumnName("service_code").HasColumnType("nvarchar(30)");
            entity.HasIndex(x => x.ServiceCode).IsUnique();
            entity.Property(x => x.ServiceName).HasColumnName("service_name").HasColumnType("nvarchar(200)");
            entity.Property(x => x.Category).HasColumnName("category").HasColumnType("nvarchar(100)");
            entity.Property(x => x.Status).HasColumnName("status").HasColumnType("nvarchar(20)").HasDefaultValueSql("'active'");
            entity.HasKey(x => x.ServiceId);
        }
        {
            var entity = modelBuilder.Entity<CommissionRule>(); entity.ToTable("commission_rules", "payroll", table => { table.HasCheckConstraint("CK_commission_rules_1", "[effective_to] IS NULL OR [effective_to] >= [effective_from]"); table.HasCheckConstraint("CK_commission_rules_2", "[commission_value] >= 0"); });
            entity.Property(x => x.RuleId).HasColumnName("rule_id").HasColumnType("uniqueidentifier").HasDefaultValueSql("NEWID()");
            entity.Property(x => x.ServiceId).HasColumnName("service_id").HasColumnType("uniqueidentifier");
            entity.Property(x => x.Role).HasColumnName("role").HasColumnType("nvarchar(50)");
            entity.Property(x => x.ValueType).HasColumnName("value_type").HasColumnType("nvarchar(20)");
            entity.Property(x => x.CommissionValue).HasColumnName("commission_value").HasColumnType("decimal(15,4)");
            entity.Property(x => x.EffectiveFrom).HasColumnName("effective_from").HasColumnType("date");
            entity.Property(x => x.EffectiveTo).HasColumnName("effective_to").HasColumnType("date");
            entity.Property(x => x.Status).HasColumnName("status").HasColumnType("nvarchar(20)").HasDefaultValueSql("'active'");
            entity.Property(x => x.CreatedBy).HasColumnName("created_by").HasColumnType("uniqueidentifier");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at").HasColumnType("datetime2(0)").HasDefaultValueSql("SYSUTCDATETIME()");
            entity.HasKey(x => x.RuleId);
        }
        {
            var entity = modelBuilder.Entity<ProcedureSlip>(); entity.ToTable("procedure_slips", "payroll");
            entity.Property(x => x.SlipId).HasColumnName("slip_id").HasColumnType("uniqueidentifier").HasDefaultValueSql("NEWID()");
            entity.Property(x => x.ServiceId).HasColumnName("service_id").HasColumnType("uniqueidentifier");
            entity.Property(x => x.DepartmentId).HasColumnName("department_id").HasColumnType("uniqueidentifier");
            entity.Property(x => x.SlipNumber).HasColumnName("slip_number").HasColumnType("nvarchar(50)");
            entity.HasIndex(x => x.SlipNumber).IsUnique();
            entity.Property(x => x.ProcedureDate).HasColumnName("procedure_date").HasColumnType("date");
            entity.Property(x => x.PatientCode).HasColumnName("patient_code").HasColumnType("nvarchar(50)");
            entity.Property(x => x.Status).HasColumnName("status").HasColumnType("nvarchar(20)").HasDefaultValueSql("'pending'");
            entity.Property(x => x.RecordedBy).HasColumnName("recorded_by").HasColumnType("uniqueidentifier");
            entity.Property(x => x.VerifiedBy).HasColumnName("verified_by").HasColumnType("uniqueidentifier");
            entity.Property(x => x.VerifiedAt).HasColumnName("verified_at").HasColumnType("datetime2(0)");
            entity.Property(x => x.RejectedReason).HasColumnName("rejected_reason").HasColumnType("nvarchar(max)");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at").HasColumnType("datetime2(0)").HasDefaultValueSql("SYSUTCDATETIME()");
            entity.HasKey(x => x.SlipId);
        }
        {
            var entity = modelBuilder.Entity<ProcedureAssignment>(); entity.ToTable("procedure_assignments", "payroll");
            entity.Property(x => x.AssignmentId).HasColumnName("assignment_id").HasColumnType("uniqueidentifier").HasDefaultValueSql("NEWID()");
            entity.Property(x => x.SlipId).HasColumnName("slip_id").HasColumnType("uniqueidentifier");
            entity.Property(x => x.StaffId).HasColumnName("staff_id").HasColumnType("uniqueidentifier");
            entity.Property(x => x.Role).HasColumnName("role").HasColumnType("nvarchar(50)");
            entity.Property(x => x.RuleId).HasColumnName("rule_id").HasColumnType("uniqueidentifier");
            entity.Property(x => x.CommissionAmount).HasColumnName("commission_amount").HasColumnType("decimal(15,2)");
            entity.Property(x => x.PayslipId).HasColumnName("payslip_id").HasColumnType("uniqueidentifier");
            entity.Property(x => x.Status).HasColumnName("status").HasColumnType("nvarchar(20)").HasDefaultValueSql("'pending'");
            entity.HasKey(x => x.AssignmentId);
        }
        {
            var entity = modelBuilder.Entity<MaternityCase>(); entity.ToTable("maternity_cases", "payroll", table => { table.HasCheckConstraint("CK_maternity_cases_1", "[leave_end_date] >= [leave_start_date]"); table.HasCheckConstraint("CK_maternity_cases_2", "[benefit_amount] >= 0 AND [additional_benefit_amount] >= 0"); });
            entity.Property(x => x.MaternityCaseId).HasColumnName("maternity_case_id").HasColumnType("uniqueidentifier").HasDefaultValueSql("NEWID()");
            entity.Property(x => x.StaffId).HasColumnName("staff_id").HasColumnType("uniqueidentifier");
            entity.Property(x => x.LeaveRequestId).HasColumnName("leave_request_id").HasColumnType("uniqueidentifier");
            entity.Property(x => x.ExpectedDueDate).HasColumnName("expected_due_date").HasColumnType("date");
            entity.Property(x => x.ActualBirthDate).HasColumnName("actual_birth_date").HasColumnType("date");
            entity.Property(x => x.LeaveStartDate).HasColumnName("leave_start_date").HasColumnType("date");
            entity.Property(x => x.LeaveEndDate).HasColumnName("leave_end_date").HasColumnType("date");
            entity.Property(x => x.InsuranceEligible).HasColumnName("insurance_eligible").HasColumnType("bit").HasDefaultValue(false).HasSentinel(false);
            entity.Property(x => x.ContributionMonths).HasColumnName("contribution_months").HasColumnType("int");
            entity.Property(x => x.AverageInsuranceSalary).HasColumnName("average_insurance_salary").HasColumnType("decimal(15,2)");
            entity.Property(x => x.BenefitAmount).HasColumnName("benefit_amount").HasColumnType("decimal(15,2)").HasDefaultValueSql("0");
            entity.Property(x => x.AdditionalBenefitAmount).HasColumnName("additional_benefit_amount").HasColumnType("decimal(15,2)").HasDefaultValueSql("0");
            entity.Property(x => x.TotalBenefitAmount).HasColumnName("total_benefit_amount").HasPrecision(16, 2).HasComputedColumnSql("[benefit_amount] + [additional_benefit_amount]", stored: true);
            entity.Property(x => x.Status).HasColumnName("status").HasColumnType("nvarchar(20)").HasDefaultValueSql("'pending'");
            entity.Property(x => x.SupportingDocumentUrl).HasColumnName("supporting_document_url").HasColumnType("nvarchar(500)");
            entity.Property(x => x.Notes).HasColumnName("notes").HasColumnType("nvarchar(max)");
            entity.Property(x => x.ReviewedBy).HasColumnName("reviewed_by").HasColumnType("uniqueidentifier");
            entity.Property(x => x.ReviewedAt).HasColumnName("reviewed_at").HasColumnType("datetime2(0)");
            entity.Property(x => x.PaidAt).HasColumnName("paid_at").HasColumnType("datetime2(0)");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at").HasColumnType("datetime2(0)").HasDefaultValueSql("SYSUTCDATETIME()");
            entity.HasKey(x => x.MaternityCaseId);
        }
        {
            var entity = modelBuilder.Entity<AllowanceType>(); entity.ToTable("allowance_types", "payroll");
            entity.Property(x => x.AllowanceId).HasColumnName("allowance_id").HasColumnType("uniqueidentifier").HasDefaultValueSql("NEWID()");
            entity.Property(x => x.Code).HasColumnName("code").HasColumnType("nvarchar(30)");
            entity.HasIndex(x => x.Code).IsUnique();
            entity.Property(x => x.Name).HasColumnName("name").HasColumnType("nvarchar(100)");
            entity.Property(x => x.ValueType).HasColumnName("value_type").HasColumnType("nvarchar(20)");
            entity.Property(x => x.DefaultValue).HasColumnName("default_value").HasColumnType("decimal(15,2)");
            entity.Property(x => x.AppliesTo).HasColumnName("applies_to").HasColumnType("nvarchar(50)").HasDefaultValueSql("'all'");
            entity.Property(x => x.IsTaxable).HasColumnName("is_taxable").HasColumnType("bit").HasDefaultValueSql("0");
            entity.Property(x => x.IsInsuranceBasis).HasColumnName("is_insurance_basis").HasColumnType("bit").HasDefaultValueSql("0");
            entity.Property(x => x.Status).HasColumnName("status").HasColumnType("nvarchar(20)").HasDefaultValueSql("'active'");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at").HasColumnType("datetime2(0)").HasDefaultValueSql("SYSUTCDATETIME()");
            entity.HasKey(x => x.AllowanceId);
        }
        {
            var entity = modelBuilder.Entity<StaffAllowance>(); entity.ToTable("staff_allowances", "payroll", table => { table.HasCheckConstraint("CK_staff_allowances_1", "[effective_to] IS NULL OR [effective_to] >= [effective_from]"); table.HasCheckConstraint("CK_staff_allowances_2", "[amount_value] >= 0"); });
            entity.Property(x => x.StaffAllowanceId).HasColumnName("staff_allowance_id").HasColumnType("uniqueidentifier").HasDefaultValueSql("NEWID()");
            entity.Property(x => x.StaffId).HasColumnName("staff_id").HasColumnType("uniqueidentifier");
            entity.Property(x => x.AllowanceId).HasColumnName("allowance_id").HasColumnType("uniqueidentifier");
            entity.Property(x => x.ValueType).HasColumnName("value_type").HasColumnType("nvarchar(20)");
            entity.Property(x => x.AmountValue).HasColumnName("amount_value").HasColumnType("decimal(15,2)");
            entity.Property(x => x.EffectiveFrom).HasColumnName("effective_from").HasColumnType("date");
            entity.Property(x => x.EffectiveTo).HasColumnName("effective_to").HasColumnType("date");
            entity.Property(x => x.Status).HasColumnName("status").HasColumnType("nvarchar(20)").HasDefaultValueSql("'active'");
            entity.Property(x => x.ApprovedBy).HasColumnName("approved_by").HasColumnType("uniqueidentifier");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at").HasColumnType("datetime2(0)").HasDefaultValueSql("SYSUTCDATETIME()");
            entity.HasKey(x => x.StaffAllowanceId);
        }
        {
            var entity = modelBuilder.Entity<PayrollTaxBracket>(); entity.ToTable("payroll_tax_brackets", "payroll", table => { table.HasCheckConstraint("CK_payroll_tax_brackets_1", "[income_from] >= 0 AND ([income_to] IS NULL OR [income_to] > [income_from])"); table.HasCheckConstraint("CK_payroll_tax_brackets_2", "[tax_rate_percent] BETWEEN 0 AND 100"); table.HasCheckConstraint("CK_payroll_tax_brackets_3", "[effective_to] IS NULL OR [effective_to] >= [effective_from]"); });
            entity.Property(x => x.BracketId).HasColumnName("bracket_id").HasColumnType("uniqueidentifier").HasDefaultValueSql("NEWID()");
            entity.Property(x => x.IncomeFrom).HasColumnName("income_from").HasColumnType("decimal(15,2)");
            entity.Property(x => x.IncomeTo).HasColumnName("income_to").HasColumnType("decimal(15,2)");
            entity.Property(x => x.TaxRatePercent).HasColumnName("tax_rate_percent").HasColumnType("decimal(5,2)");
            entity.Property(x => x.EffectiveFrom).HasColumnName("effective_from").HasColumnType("date");
            entity.Property(x => x.EffectiveTo).HasColumnName("effective_to").HasColumnType("date");
            entity.Property(x => x.Status).HasColumnName("status").HasColumnType("nvarchar(20)").HasDefaultValueSql("'active'");
            entity.HasKey(x => x.BracketId);
        }
        {
            var entity = modelBuilder.Entity<PayrollInsuranceConfig>(); entity.ToTable("payroll_insurance_configs", "payroll", table => { table.HasCheckConstraint("CK_payroll_insurance_configs_1", "[rate_percent] BETWEEN 0 AND 100"); table.HasCheckConstraint("CK_payroll_insurance_configs_2", "[effective_to] IS NULL OR [effective_to] >= [effective_from]"); });
            entity.Property(x => x.ConfigId).HasColumnName("config_id").HasColumnType("uniqueidentifier").HasDefaultValueSql("NEWID()");
            entity.Property(x => x.InsuranceType).HasColumnName("insurance_type").HasColumnType("nvarchar(20)");
            entity.Property(x => x.Payer).HasColumnName("payer").HasColumnType("nvarchar(20)");
            entity.Property(x => x.RatePercent).HasColumnName("rate_percent").HasColumnType("decimal(5,2)");
            entity.Property(x => x.AppliesTo).HasColumnName("applies_to").HasColumnType("nvarchar(50)").HasDefaultValueSql("'all'");
            entity.Property(x => x.EffectiveFrom).HasColumnName("effective_from").HasColumnType("date");
            entity.Property(x => x.EffectiveTo).HasColumnName("effective_to").HasColumnType("date");
            entity.Property(x => x.Status).HasColumnName("status").HasColumnType("nvarchar(20)").HasDefaultValueSql("'active'");
            entity.HasKey(x => x.ConfigId);
        }
        {
            var entity = modelBuilder.Entity<BankExport>(); entity.ToTable("bank_exports", "payroll");
            entity.Property(x => x.ExportId).HasColumnName("export_id").HasColumnType("uniqueidentifier").HasDefaultValueSql("NEWID()");
            entity.Property(x => x.PayMonth).HasColumnName("pay_month").HasColumnType("nvarchar(7)");
            entity.Property(x => x.FileName).HasColumnName("file_name").HasColumnType("nvarchar(255)");
            entity.Property(x => x.FileUrl).HasColumnName("file_url").HasColumnType("nvarchar(500)");
            entity.Property(x => x.ExportedBy).HasColumnName("exported_by").HasColumnType("uniqueidentifier");
            entity.Property(x => x.ExportedAt).HasColumnName("exported_at").HasColumnType("datetime2(0)").HasDefaultValueSql("SYSUTCDATETIME()");
            entity.Property(x => x.Status).HasColumnName("status").HasColumnType("nvarchar(20)").HasDefaultValueSql("'completed'");
            entity.Property(x => x.RowCount).HasColumnName("row_count").HasColumnType("int").HasDefaultValueSql("0");
            entity.Property(x => x.Notes).HasColumnName("notes").HasColumnType("nvarchar(max)");
            entity.HasKey(x => x.ExportId);
        }
        {
            var entity = modelBuilder.Entity<PayrollLock>(); entity.ToTable("payroll_locks", "payroll");
            entity.Property(x => x.LockId).HasColumnName("lock_id").HasColumnType("uniqueidentifier").HasDefaultValueSql("NEWID()");
            entity.Property(x => x.PayMonth).HasColumnName("pay_month").HasColumnType("nvarchar(7)");
            entity.HasIndex(x => x.PayMonth).IsUnique();
            entity.Property(x => x.Status).HasColumnName("status").HasColumnType("nvarchar(20)").HasDefaultValueSql("'open'");
            entity.Property(x => x.LockedBy).HasColumnName("locked_by").HasColumnType("uniqueidentifier");
            entity.Property(x => x.LockedAt).HasColumnName("locked_at").HasColumnType("datetime2(0)");
            entity.Property(x => x.ExportedBy).HasColumnName("exported_by").HasColumnType("uniqueidentifier");
            entity.Property(x => x.ExportedAt).HasColumnName("exported_at").HasColumnType("datetime2(0)");
            entity.Property(x => x.ExportFileUrl).HasColumnName("export_file_url").HasColumnType("nvarchar(500)");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at").HasColumnType("datetime2(0)").HasDefaultValueSql("SYSUTCDATETIME()");
            entity.HasKey(x => x.LockId);
        }
        {
            var entity = modelBuilder.Entity<Payslip>(); entity.ToTable("payslips", "payroll", table => { table.HasCheckConstraint("CK_payslips_1", "[pay_month] LIKE '[12][0-9][0-9][0-9]-[01][0-9]' AND TRY_CONVERT(date, [pay_month] + '-01', 23) IS NOT NULL"); });
            entity.Property(x => x.PayslipId).HasColumnName("payslip_id").HasColumnType("uniqueidentifier").HasDefaultValueSql("NEWID()");
            entity.Property(x => x.StaffId).HasColumnName("staff_id").HasColumnType("uniqueidentifier");
            entity.Property(x => x.StaffName).HasColumnName("staff_name").HasColumnType("nvarchar(100)");
            entity.Property(x => x.DepartmentId).HasColumnName("department_id").HasColumnType("uniqueidentifier");
            entity.Property(x => x.ContractId).HasColumnName("contract_id").HasColumnType("uniqueidentifier");
            entity.Property(x => x.ContractType).HasColumnName("contract_type").HasColumnType("nvarchar(50)");
            entity.Property(x => x.PayMonth).HasColumnName("pay_month").HasColumnType("nvarchar(7)");
            entity.Property(x => x.WorkDays).HasColumnName("work_days").HasColumnType("decimal(5,2)");
            entity.Property(x => x.OnCallDays).HasColumnName("on_call_days").HasColumnType("decimal(5,2)");
            entity.Property(x => x.MaternityLeaveDays).HasColumnName("maternity_leave_days").HasColumnType("decimal(5,2)").HasDefaultValueSql("0");
            entity.Property(x => x.BasePay).HasColumnName("base_pay").HasColumnType("decimal(15,2)").HasDefaultValueSql("0");
            entity.Property(x => x.AllowanceTotal).HasColumnName("allowance_total").HasColumnType("decimal(15,2)").HasDefaultValueSql("0");
            entity.Property(x => x.CommissionTotal).HasColumnName("commission_total").HasColumnType("decimal(15,2)").HasDefaultValueSql("0");
            entity.Property(x => x.MaternityAllowance).HasColumnName("maternity_allowance").HasColumnType("decimal(15,2)").HasDefaultValueSql("0");
            entity.Property(x => x.GrossPay).HasColumnName("gross_pay").HasColumnType("decimal(15,2)");
            entity.Property(x => x.InsuranceSalaryBase).HasColumnName("insurance_salary_base").HasColumnType("decimal(15,2)").HasDefaultValueSql("0");
            entity.Property(x => x.InsuranceDeduction).HasColumnName("insurance_deduction").HasColumnType("decimal(15,2)").HasDefaultValueSql("0");
            entity.Property(x => x.DependentCount).HasColumnName("dependent_count").HasColumnType("int").HasDefaultValueSql("0");
            entity.Property(x => x.PersonalDeduction).HasColumnName("personal_deduction").HasColumnType("decimal(15,2)").HasDefaultValueSql("0");
            entity.Property(x => x.DependentDeduction).HasColumnName("dependent_deduction").HasColumnType("decimal(15,2)").HasDefaultValueSql("0");
            entity.Property(x => x.TaxableIncome).HasColumnName("taxable_income").HasColumnType("decimal(15,2)").HasDefaultValueSql("0");
            entity.Property(x => x.TaxDeduction).HasColumnName("tax_deduction").HasColumnType("decimal(15,2)").HasDefaultValueSql("0");
            entity.Property(x => x.OtherDeduction).HasColumnName("other_deduction").HasColumnType("decimal(15,2)").HasDefaultValueSql("0");
            entity.Property(x => x.NetPay).HasColumnName("net_pay").HasColumnType("decimal(15,2)");
            entity.Property(x => x.Status).HasColumnName("status").HasColumnType("nvarchar(30)").HasDefaultValueSql("'draft'");
            entity.Property(x => x.DeptApprovedBy).HasColumnName("dept_approved_by").HasColumnType("uniqueidentifier");
            entity.Property(x => x.DeptApprovedAt).HasColumnName("dept_approved_at").HasColumnType("datetime2(0)");
            entity.Property(x => x.DeptRejectedReason).HasColumnName("dept_rejected_reason").HasColumnType("nvarchar(max)");
            entity.Property(x => x.FinalizedBy).HasColumnName("finalized_by").HasColumnType("uniqueidentifier");
            entity.Property(x => x.FinalizedAt).HasColumnName("finalized_at").HasColumnType("datetime2(0)");
            entity.Property(x => x.PaymentDate).HasColumnName("payment_date").HasColumnType("date");
            entity.Property(x => x.BankExportId).HasColumnName("bank_export_id").HasColumnType("uniqueidentifier");
            entity.Property(x => x.IsLocked).HasColumnName("is_locked").HasColumnType("bit").HasDefaultValueSql("0");
            entity.Property(x => x.LockedAt).HasColumnName("locked_at").HasColumnType("datetime2(0)");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at").HasColumnType("datetime2(0)").HasDefaultValueSql("SYSUTCDATETIME()");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at").HasColumnType("datetime2(0)").HasDefaultValueSql("SYSUTCDATETIME()");
            entity.HasKey(x => x.PayslipId);
            entity.HasIndex(x => new { x.StaffId, x.PayMonth }).IsUnique();
        }
        {
            var entity = modelBuilder.Entity<PayslipAllowance>(); entity.ToTable("payslip_allowances", "payroll");
            entity.Property(x => x.Id).HasColumnName("id").HasColumnType("uniqueidentifier").HasDefaultValueSql("NEWID()");
            entity.Property(x => x.PayslipId).HasColumnName("payslip_id").HasColumnType("uniqueidentifier");
            entity.Property(x => x.AllowanceId).HasColumnName("allowance_id").HasColumnType("uniqueidentifier");
            entity.Property(x => x.Name).HasColumnName("name").HasColumnType("nvarchar(100)");
            entity.Property(x => x.Amount).HasColumnName("amount").HasColumnType("decimal(15,2)");
            entity.HasKey(x => x.Id);
        }
        {
            var entity = modelBuilder.Entity<PayslipDeduction>(); entity.ToTable("payslip_deductions", "payroll");
            entity.Property(x => x.PayslipDeductionId).HasColumnName("payslip_deduction_id").HasColumnType("uniqueidentifier").HasDefaultValueSql("NEWID()");
            entity.Property(x => x.PayslipId).HasColumnName("payslip_id").HasColumnType("uniqueidentifier");
            entity.Property(x => x.DeductionType).HasColumnName("deduction_type").HasColumnType("nvarchar(30)");
            entity.Property(x => x.DeductionName).HasColumnName("deduction_name").HasColumnType("nvarchar(100)");
            entity.Property(x => x.CalculationBase).HasColumnName("calculation_base").HasColumnType("decimal(15,2)").HasDefaultValueSql("0");
            entity.Property(x => x.RatePercent).HasColumnName("rate_percent").HasColumnType("decimal(7,4)");
            entity.Property(x => x.Amount).HasColumnName("amount").HasColumnType("decimal(15,2)").HasDefaultValueSql("0");
            entity.Property(x => x.Payer).HasColumnName("payer").HasColumnType("nvarchar(20)").HasDefaultValueSql("'employee'");
            entity.Property(x => x.ConfigReferenceId).HasColumnName("config_reference_id").HasColumnType("uniqueidentifier");
            entity.Property(x => x.Notes).HasColumnName("notes").HasColumnType("nvarchar(max)");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at").HasColumnType("datetime2(0)").HasDefaultValueSql("SYSUTCDATETIME()");
            entity.HasKey(x => x.PayslipDeductionId);
        }
        {
            var entity = modelBuilder.Entity<Complaint>(); entity.ToTable("complaints", "payroll");
            entity.Property(x => x.ComplaintId).HasColumnName("complaint_id").HasColumnType("uniqueidentifier").HasDefaultValueSql("NEWID()");
            entity.Property(x => x.StaffId).HasColumnName("staff_id").HasColumnType("uniqueidentifier");
            entity.Property(x => x.DepartmentId).HasColumnName("department_id").HasColumnType("uniqueidentifier");
            entity.Property(x => x.PayslipId).HasColumnName("payslip_id").HasColumnType("uniqueidentifier");
            entity.Property(x => x.InquiryType).HasColumnName("inquiry_type").HasColumnType("nvarchar(30)");
            entity.Property(x => x.Subject).HasColumnName("subject").HasColumnType("nvarchar(200)");
            entity.Property(x => x.Description).HasColumnName("description").HasColumnType("nvarchar(max)");
            entity.Property(x => x.Response).HasColumnName("response").HasColumnType("nvarchar(max)");
            entity.Property(x => x.RepliedBy).HasColumnName("replied_by").HasColumnType("uniqueidentifier");
            entity.Property(x => x.RepliedAt).HasColumnName("replied_at").HasColumnType("datetime2(0)");
            entity.Property(x => x.Status).HasColumnName("status").HasColumnType("nvarchar(20)").HasDefaultValueSql("'open'");
            entity.Property(x => x.SubmittedAt).HasColumnName("submitted_at").HasColumnType("datetime2(0)").HasDefaultValueSql("SYSUTCDATETIME()");
            entity.Property(x => x.ResolvedAt).HasColumnName("resolved_at").HasColumnType("datetime2(0)");
            entity.HasKey(x => x.ComplaintId);
        }
        {
            var entity = modelBuilder.Entity<ComplaintAttachment>(); entity.ToTable("complaint_attachments", "payroll");
            entity.Property(x => x.AttachmentId).HasColumnName("attachment_id").HasColumnType("uniqueidentifier").HasDefaultValueSql("NEWID()");
            entity.Property(x => x.ComplaintId).HasColumnName("complaint_id").HasColumnType("uniqueidentifier");
            entity.Property(x => x.FileUrl).HasColumnName("file_url").HasColumnType("nvarchar(500)");
            entity.Property(x => x.FileName).HasColumnName("file_name").HasColumnType("nvarchar(255)");
            entity.Property(x => x.UploadedBy).HasColumnName("uploaded_by").HasColumnType("uniqueidentifier");
            entity.Property(x => x.UploadedAt).HasColumnName("uploaded_at").HasColumnType("datetime2(0)").HasDefaultValueSql("SYSUTCDATETIME()");
            entity.HasKey(x => x.AttachmentId);
        }
        modelBuilder.Entity<CommissionRule>().HasOne<ProcedureService>().WithMany().HasForeignKey(x => x.ServiceId).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<ProcedureSlip>().HasOne<ProcedureService>().WithMany().HasForeignKey(x => x.ServiceId).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<ProcedureAssignment>().HasOne<ProcedureSlip>().WithMany().HasForeignKey(x => x.SlipId).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<ProcedureAssignment>().HasOne<CommissionRule>().WithMany().HasForeignKey(x => x.RuleId).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<StaffAllowance>().HasOne<AllowanceType>().WithMany().HasForeignKey(x => x.AllowanceId).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<Payslip>().HasOne<BankExport>().WithMany().HasForeignKey(x => x.BankExportId).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<PayslipAllowance>().HasOne<Payslip>().WithMany().HasForeignKey(x => x.PayslipId).OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<PayslipDeduction>().HasOne<Payslip>().WithMany().HasForeignKey(x => x.PayslipId).OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<ComplaintAttachment>().HasOne<Complaint>().WithMany().HasForeignKey(x => x.ComplaintId).OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<ProcedureAssignment>().HasOne<Payslip>().WithMany().HasForeignKey(x => x.PayslipId).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<Complaint>().HasOne<Payslip>().WithMany().HasForeignKey(x => x.PayslipId).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<PayslipAllowance>().HasOne<AllowanceType>().WithMany().HasForeignKey(x => x.AllowanceId).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<Payslip>().HasIndex(x => new { x.PayMonth, x.Status, x.DepartmentId }).HasDatabaseName("IX_payslips_pay_month_status");
        modelBuilder.Entity<StaffAllowance>().HasIndex(x => new { x.StaffId, x.Status, x.EffectiveFrom, x.EffectiveTo }).HasDatabaseName("IX_staff_allowances_staff_effective");
        modelBuilder.Entity<PayslipDeduction>().HasIndex(x => new { x.PayslipId, x.DeductionType }).HasDatabaseName("IX_payslip_deductions_payslip");
    }
}
