using Microsoft.EntityFrameworkCore;
using Vnc.HRMS.Models.Payroll;

namespace Vnc.HRMS.Configurations.Entities;

public static class PayrollModelConfiguration
{
    public static void Configure(ModelBuilder modelBuilder)
    {
        var allowance = modelBuilder.Entity<AllowanceType>();
        allowance.ToTable("allowance_types", "payroll");
        allowance.HasKey(x => x.AllowanceId);
        allowance.Property(x => x.AllowanceId).HasColumnName("allowance_id").HasDefaultValueSql("NEWID()");
        allowance.Property(x => x.Code).HasColumnName("code").HasMaxLength(30);
        allowance.Property(x => x.Name).HasColumnName("name").HasMaxLength(100);
        allowance.Property(x => x.ValueType).HasColumnName("value_type").HasMaxLength(20).HasDefaultValue("fixed");
        allowance.Property(x => x.DefaultValue).HasColumnName("default_value").HasPrecision(15, 2);
        allowance.Property(x => x.AppliesTo).HasColumnName("applies_to").HasMaxLength(50).HasDefaultValue("all");
        allowance.Property(x => x.IsTaxable).HasColumnName("is_taxable").HasDefaultValue(false);
        allowance.Property(x => x.IsInsuranceBasis).HasColumnName("is_insurance_basis").HasDefaultValue(false);
        allowance.Property(x => x.Status).HasColumnName("status").HasMaxLength(20).HasDefaultValue("active");
        allowance.Property(x => x.CreatedAt).HasColumnName("created_at").HasColumnType("datetime2(0)").HasDefaultValueSql("SYSUTCDATETIME()");
        allowance.HasIndex(x => x.Code).IsUnique();

        var insurance = modelBuilder.Entity<PayrollInsuranceConfig>();
        insurance.ToTable("payroll_insurance_configs", "payroll");
        insurance.HasKey(x => x.ConfigId);
        insurance.Property(x => x.ConfigId).HasColumnName("config_id").HasDefaultValueSql("NEWID()");
        insurance.Property(x => x.InsuranceType).HasColumnName("insurance_type").HasMaxLength(20);
        insurance.Property(x => x.Payer).HasColumnName("payer").HasMaxLength(20);
        insurance.Property(x => x.RatePercent).HasColumnName("rate_percent").HasPrecision(5, 2);
        insurance.Property(x => x.AppliesTo).HasColumnName("applies_to").HasMaxLength(50).HasDefaultValue("all");
        insurance.Property(x => x.EffectiveFrom).HasColumnName("effective_from");
        insurance.Property(x => x.EffectiveTo).HasColumnName("effective_to");
        insurance.Property(x => x.Status).HasColumnName("status").HasMaxLength(20).HasDefaultValue("active");

        var tax = modelBuilder.Entity<PayrollTaxBracket>();
        tax.ToTable("payroll_tax_brackets", "payroll");
        tax.HasKey(x => x.BracketId);
        tax.Property(x => x.BracketId).HasColumnName("bracket_id").HasDefaultValueSql("NEWID()");
        tax.Property(x => x.IncomeFrom).HasColumnName("income_from").HasPrecision(15, 2);
        tax.Property(x => x.IncomeTo).HasColumnName("income_to").HasPrecision(15, 2);
        tax.Property(x => x.TaxRatePercent).HasColumnName("tax_rate_percent").HasPrecision(5, 2);
        tax.Property(x => x.EffectiveFrom).HasColumnName("effective_from");
        tax.Property(x => x.EffectiveTo).HasColumnName("effective_to");
        tax.Property(x => x.Status).HasColumnName("status").HasMaxLength(20).HasDefaultValue("active");

        var commission = modelBuilder.Entity<CommissionRule>();
        commission.ToTable("commission_rules", "payroll");
        commission.HasKey(x => x.RuleId);
        commission.Property(x => x.RuleId).HasColumnName("rule_id").HasDefaultValueSql("NEWID()");
        commission.Property(x => x.ServiceId).HasColumnName("service_id");
        commission.Property(x => x.Role).HasColumnName("role").HasMaxLength(50);
        commission.Property(x => x.ValueType).HasColumnName("value_type").HasMaxLength(20).HasDefaultValue("fixed");
        commission.Property(x => x.CommissionValue).HasColumnName("commission_value").HasPrecision(15, 4);
        commission.Property(x => x.EffectiveFrom).HasColumnName("effective_from");
        commission.Property(x => x.EffectiveTo).HasColumnName("effective_to");
        commission.Property(x => x.Status).HasColumnName("status").HasMaxLength(20).HasDefaultValue("active");
        commission.Property(x => x.CreatedBy).HasColumnName("created_by");
        commission.Property(x => x.CreatedAt).HasColumnName("created_at").HasColumnType("datetime2(0)").HasDefaultValueSql("SYSUTCDATETIME()");
    }
}
