IF OBJECT_ID(N'[__EFMigrationsHistory]') IS NULL
BEGIN
    CREATE TABLE [__EFMigrationsHistory] (
        [MigrationId] nvarchar(150) NOT NULL,
        [ProductVersion] nvarchar(32) NOT NULL,
        CONSTRAINT [PK___EFMigrationsHistory] PRIMARY KEY ([MigrationId])
    );
END;
GO

BEGIN TRANSACTION;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153146_InitialMicroservice'
)
BEGIN
    IF SCHEMA_ID(N'payroll') IS NULL EXEC(N'CREATE SCHEMA [payroll];');
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153146_InitialMicroservice'
)
BEGIN
    CREATE TABLE [payroll].[allowance_types] (
        [allowance_id] uniqueidentifier NOT NULL DEFAULT (NEWID()),
        [code] nvarchar(30) NOT NULL,
        [name] nvarchar(100) NOT NULL,
        [value_type] nvarchar(20) NOT NULL,
        [default_value] decimal(15,2) NULL,
        [applies_to] nvarchar(50) NULL DEFAULT ('all'),
        [is_taxable] bit NULL DEFAULT (0),
        [is_insurance_basis] bit NULL DEFAULT (0),
        [status] nvarchar(20) NULL DEFAULT ('active'),
        [created_at] datetime2(0) NULL DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT [PK_allowance_types] PRIMARY KEY ([allowance_id])
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153146_InitialMicroservice'
)
BEGIN
    CREATE TABLE [payroll].[bank_exports] (
        [export_id] uniqueidentifier NOT NULL DEFAULT (NEWID()),
        [pay_month] nvarchar(7) NOT NULL,
        [file_name] nvarchar(255) NOT NULL,
        [file_url] nvarchar(500) NULL,
        [exported_by] uniqueidentifier NOT NULL,
        [exported_at] datetime2(0) NOT NULL DEFAULT (SYSUTCDATETIME()),
        [status] nvarchar(20) NOT NULL DEFAULT ('completed'),
        [row_count] int NOT NULL DEFAULT (0),
        [notes] nvarchar(max) NULL,
        CONSTRAINT [PK_bank_exports] PRIMARY KEY ([export_id])
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153146_InitialMicroservice'
)
BEGIN
    CREATE TABLE [payroll].[maternity_cases] (
        [maternity_case_id] uniqueidentifier NOT NULL DEFAULT (NEWID()),
        [staff_id] uniqueidentifier NOT NULL,
        [leave_request_id] uniqueidentifier NULL,
        [expected_due_date] date NULL,
        [actual_birth_date] date NULL,
        [leave_start_date] date NOT NULL,
        [leave_end_date] date NOT NULL,
        [insurance_eligible] bit NOT NULL DEFAULT (0),
        [contribution_months] int NULL,
        [average_insurance_salary] decimal(15,2) NULL,
        [benefit_amount] decimal(15,2) NOT NULL DEFAULT (0),
        [additional_benefit_amount] decimal(15,2) NOT NULL DEFAULT (0),
        [total_benefit_amount] AS [benefit_amount] + [additional_benefit_amount] PERSISTED,
        [status] nvarchar(20) NOT NULL DEFAULT ('pending'),
        [supporting_document_url] nvarchar(500) NULL,
        [notes] nvarchar(max) NULL,
        [reviewed_by] uniqueidentifier NULL,
        [reviewed_at] datetime2(0) NULL,
        [paid_at] datetime2(0) NULL,
        [created_at] datetime2(0) NOT NULL DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT [PK_maternity_cases] PRIMARY KEY ([maternity_case_id]),
        CONSTRAINT [CK_maternity_cases_1] CHECK ([leave_end_date] >= [leave_start_date]),
        CONSTRAINT [CK_maternity_cases_2] CHECK ([benefit_amount] >= 0 AND [additional_benefit_amount] >= 0)
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153146_InitialMicroservice'
)
BEGIN
    CREATE TABLE [payroll].[payroll_insurance_configs] (
        [config_id] uniqueidentifier NOT NULL DEFAULT (NEWID()),
        [insurance_type] nvarchar(20) NOT NULL,
        [payer] nvarchar(20) NOT NULL,
        [rate_percent] decimal(5,2) NOT NULL,
        [applies_to] nvarchar(50) NULL DEFAULT ('all'),
        [effective_from] date NOT NULL,
        [effective_to] date NULL,
        [status] nvarchar(20) NULL DEFAULT ('active'),
        CONSTRAINT [PK_payroll_insurance_configs] PRIMARY KEY ([config_id]),
        CONSTRAINT [CK_payroll_insurance_configs_1] CHECK ([rate_percent] BETWEEN 0 AND 100),
        CONSTRAINT [CK_payroll_insurance_configs_2] CHECK ([effective_to] IS NULL OR [effective_to] >= [effective_from])
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153146_InitialMicroservice'
)
BEGIN
    CREATE TABLE [payroll].[payroll_locks] (
        [lock_id] uniqueidentifier NOT NULL DEFAULT (NEWID()),
        [pay_month] nvarchar(7) NOT NULL,
        [status] nvarchar(20) NULL DEFAULT ('open'),
        [locked_by] uniqueidentifier NULL,
        [locked_at] datetime2(0) NULL,
        [exported_by] uniqueidentifier NULL,
        [exported_at] datetime2(0) NULL,
        [export_file_url] nvarchar(500) NULL,
        [created_at] datetime2(0) NULL DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT [PK_payroll_locks] PRIMARY KEY ([lock_id])
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153146_InitialMicroservice'
)
BEGIN
    CREATE TABLE [payroll].[payroll_tax_brackets] (
        [bracket_id] uniqueidentifier NOT NULL DEFAULT (NEWID()),
        [income_from] decimal(15,2) NOT NULL,
        [income_to] decimal(15,2) NULL,
        [tax_rate_percent] decimal(5,2) NOT NULL,
        [effective_from] date NOT NULL,
        [effective_to] date NULL,
        [status] nvarchar(20) NULL DEFAULT ('active'),
        CONSTRAINT [PK_payroll_tax_brackets] PRIMARY KEY ([bracket_id]),
        CONSTRAINT [CK_payroll_tax_brackets_1] CHECK ([income_from] >= 0 AND ([income_to] IS NULL OR [income_to] > [income_from])),
        CONSTRAINT [CK_payroll_tax_brackets_2] CHECK ([tax_rate_percent] BETWEEN 0 AND 100),
        CONSTRAINT [CK_payroll_tax_brackets_3] CHECK ([effective_to] IS NULL OR [effective_to] >= [effective_from])
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153146_InitialMicroservice'
)
BEGIN
    CREATE TABLE [payroll].[procedure_services] (
        [service_id] uniqueidentifier NOT NULL DEFAULT (NEWID()),
        [service_code] nvarchar(30) NOT NULL,
        [service_name] nvarchar(200) NOT NULL,
        [category] nvarchar(100) NULL,
        [status] nvarchar(20) NULL DEFAULT ('active'),
        CONSTRAINT [PK_procedure_services] PRIMARY KEY ([service_id])
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153146_InitialMicroservice'
)
BEGIN
    CREATE TABLE [payroll].[staff_allowances] (
        [staff_allowance_id] uniqueidentifier NOT NULL DEFAULT (NEWID()),
        [staff_id] uniqueidentifier NOT NULL,
        [allowance_id] uniqueidentifier NOT NULL,
        [value_type] nvarchar(20) NOT NULL,
        [amount_value] decimal(15,2) NOT NULL,
        [effective_from] date NOT NULL,
        [effective_to] date NULL,
        [status] nvarchar(20) NOT NULL DEFAULT ('active'),
        [approved_by] uniqueidentifier NULL,
        [created_at] datetime2(0) NOT NULL DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT [PK_staff_allowances] PRIMARY KEY ([staff_allowance_id]),
        CONSTRAINT [CK_staff_allowances_1] CHECK ([effective_to] IS NULL OR [effective_to] >= [effective_from]),
        CONSTRAINT [CK_staff_allowances_2] CHECK ([amount_value] >= 0),
        CONSTRAINT [FK_staff_allowances_allowance_types_allowance_id] FOREIGN KEY ([allowance_id]) REFERENCES [payroll].[allowance_types] ([allowance_id]) ON DELETE NO ACTION
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153146_InitialMicroservice'
)
BEGIN
    CREATE TABLE [payroll].[payslips] (
        [payslip_id] uniqueidentifier NOT NULL DEFAULT (NEWID()),
        [staff_id] uniqueidentifier NOT NULL,
        [staff_name] nvarchar(100) NULL,
        [department_id] uniqueidentifier NULL,
        [contract_id] uniqueidentifier NULL,
        [contract_type] nvarchar(50) NULL,
        [pay_month] nvarchar(7) NOT NULL,
        [work_days] decimal(5,2) NULL,
        [on_call_days] decimal(5,2) NULL,
        [maternity_leave_days] decimal(5,2) NULL DEFAULT (0),
        [base_pay] decimal(15,2) NULL DEFAULT (0),
        [allowance_total] decimal(15,2) NULL DEFAULT (0),
        [commission_total] decimal(15,2) NULL DEFAULT (0),
        [maternity_allowance] decimal(15,2) NULL DEFAULT (0),
        [gross_pay] decimal(15,2) NULL,
        [insurance_salary_base] decimal(15,2) NULL DEFAULT (0),
        [insurance_deduction] decimal(15,2) NULL DEFAULT (0),
        [dependent_count] int NULL DEFAULT (0),
        [personal_deduction] decimal(15,2) NULL DEFAULT (0),
        [dependent_deduction] decimal(15,2) NULL DEFAULT (0),
        [taxable_income] decimal(15,2) NULL DEFAULT (0),
        [tax_deduction] decimal(15,2) NULL DEFAULT (0),
        [other_deduction] decimal(15,2) NULL DEFAULT (0),
        [net_pay] decimal(15,2) NULL,
        [status] nvarchar(30) NULL DEFAULT ('draft'),
        [dept_approved_by] uniqueidentifier NULL,
        [dept_approved_at] datetime2(0) NULL,
        [dept_rejected_reason] nvarchar(max) NULL,
        [finalized_by] uniqueidentifier NULL,
        [finalized_at] datetime2(0) NULL,
        [payment_date] date NULL,
        [bank_export_id] uniqueidentifier NULL,
        [is_locked] bit NULL DEFAULT (0),
        [locked_at] datetime2(0) NULL,
        [created_at] datetime2(0) NULL DEFAULT (SYSUTCDATETIME()),
        [updated_at] datetime2(0) NULL DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT [PK_payslips] PRIMARY KEY ([payslip_id]),
        CONSTRAINT [CK_payslips_1] CHECK ([pay_month] LIKE '[12][0-9][0-9][0-9]-[01][0-9]' AND TRY_CONVERT(date, [pay_month] + '-01', 23) IS NOT NULL),
        CONSTRAINT [FK_payslips_bank_exports_bank_export_id] FOREIGN KEY ([bank_export_id]) REFERENCES [payroll].[bank_exports] ([export_id]) ON DELETE NO ACTION
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153146_InitialMicroservice'
)
BEGIN
    CREATE TABLE [payroll].[commission_rules] (
        [rule_id] uniqueidentifier NOT NULL DEFAULT (NEWID()),
        [service_id] uniqueidentifier NOT NULL,
        [role] nvarchar(50) NOT NULL,
        [value_type] nvarchar(20) NOT NULL,
        [commission_value] decimal(15,4) NOT NULL,
        [effective_from] date NOT NULL,
        [effective_to] date NULL,
        [status] nvarchar(20) NULL DEFAULT ('active'),
        [created_by] uniqueidentifier NULL,
        [created_at] datetime2(0) NULL DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT [PK_commission_rules] PRIMARY KEY ([rule_id]),
        CONSTRAINT [CK_commission_rules_1] CHECK ([effective_to] IS NULL OR [effective_to] >= [effective_from]),
        CONSTRAINT [CK_commission_rules_2] CHECK ([commission_value] >= 0),
        CONSTRAINT [FK_commission_rules_procedure_services_service_id] FOREIGN KEY ([service_id]) REFERENCES [payroll].[procedure_services] ([service_id]) ON DELETE NO ACTION
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153146_InitialMicroservice'
)
BEGIN
    CREATE TABLE [payroll].[procedure_slips] (
        [slip_id] uniqueidentifier NOT NULL DEFAULT (NEWID()),
        [service_id] uniqueidentifier NOT NULL,
        [department_id] uniqueidentifier NULL,
        [slip_number] nvarchar(50) NOT NULL,
        [procedure_date] date NOT NULL,
        [patient_code] nvarchar(50) NULL,
        [status] nvarchar(20) NULL DEFAULT ('pending'),
        [recorded_by] uniqueidentifier NULL,
        [verified_by] uniqueidentifier NULL,
        [verified_at] datetime2(0) NULL,
        [rejected_reason] nvarchar(max) NULL,
        [created_at] datetime2(0) NULL DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT [PK_procedure_slips] PRIMARY KEY ([slip_id]),
        CONSTRAINT [FK_procedure_slips_procedure_services_service_id] FOREIGN KEY ([service_id]) REFERENCES [payroll].[procedure_services] ([service_id]) ON DELETE NO ACTION
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153146_InitialMicroservice'
)
BEGIN
    CREATE TABLE [payroll].[complaints] (
        [complaint_id] uniqueidentifier NOT NULL DEFAULT (NEWID()),
        [staff_id] uniqueidentifier NOT NULL,
        [department_id] uniqueidentifier NULL,
        [payslip_id] uniqueidentifier NULL,
        [inquiry_type] nvarchar(30) NOT NULL,
        [subject] nvarchar(200) NOT NULL,
        [description] nvarchar(max) NOT NULL,
        [response] nvarchar(max) NULL,
        [replied_by] uniqueidentifier NULL,
        [replied_at] datetime2(0) NULL,
        [status] nvarchar(20) NULL DEFAULT ('open'),
        [submitted_at] datetime2(0) NULL DEFAULT (SYSUTCDATETIME()),
        [resolved_at] datetime2(0) NULL,
        CONSTRAINT [PK_complaints] PRIMARY KEY ([complaint_id]),
        CONSTRAINT [FK_complaints_payslips_payslip_id] FOREIGN KEY ([payslip_id]) REFERENCES [payroll].[payslips] ([payslip_id]) ON DELETE NO ACTION
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153146_InitialMicroservice'
)
BEGIN
    CREATE TABLE [payroll].[payslip_allowances] (
        [id] uniqueidentifier NOT NULL DEFAULT (NEWID()),
        [payslip_id] uniqueidentifier NOT NULL,
        [allowance_id] uniqueidentifier NULL,
        [name] nvarchar(100) NOT NULL,
        [amount] decimal(15,2) NOT NULL,
        CONSTRAINT [PK_payslip_allowances] PRIMARY KEY ([id]),
        CONSTRAINT [FK_payslip_allowances_allowance_types_allowance_id] FOREIGN KEY ([allowance_id]) REFERENCES [payroll].[allowance_types] ([allowance_id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_payslip_allowances_payslips_payslip_id] FOREIGN KEY ([payslip_id]) REFERENCES [payroll].[payslips] ([payslip_id]) ON DELETE CASCADE
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153146_InitialMicroservice'
)
BEGIN
    CREATE TABLE [payroll].[payslip_deductions] (
        [payslip_deduction_id] uniqueidentifier NOT NULL DEFAULT (NEWID()),
        [payslip_id] uniqueidentifier NOT NULL,
        [deduction_type] nvarchar(30) NOT NULL,
        [deduction_name] nvarchar(100) NOT NULL,
        [calculation_base] decimal(15,2) NOT NULL DEFAULT (0),
        [rate_percent] decimal(7,4) NULL,
        [amount] decimal(15,2) NOT NULL DEFAULT (0),
        [payer] nvarchar(20) NOT NULL DEFAULT ('employee'),
        [config_reference_id] uniqueidentifier NULL,
        [notes] nvarchar(max) NULL,
        [created_at] datetime2(0) NOT NULL DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT [PK_payslip_deductions] PRIMARY KEY ([payslip_deduction_id]),
        CONSTRAINT [FK_payslip_deductions_payslips_payslip_id] FOREIGN KEY ([payslip_id]) REFERENCES [payroll].[payslips] ([payslip_id]) ON DELETE CASCADE
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153146_InitialMicroservice'
)
BEGIN
    CREATE TABLE [payroll].[procedure_assignments] (
        [assignment_id] uniqueidentifier NOT NULL DEFAULT (NEWID()),
        [slip_id] uniqueidentifier NOT NULL,
        [staff_id] uniqueidentifier NOT NULL,
        [role] nvarchar(50) NOT NULL,
        [rule_id] uniqueidentifier NULL,
        [commission_amount] decimal(15,2) NULL,
        [payslip_id] uniqueidentifier NULL,
        [status] nvarchar(20) NULL DEFAULT ('pending'),
        CONSTRAINT [PK_procedure_assignments] PRIMARY KEY ([assignment_id]),
        CONSTRAINT [FK_procedure_assignments_commission_rules_rule_id] FOREIGN KEY ([rule_id]) REFERENCES [payroll].[commission_rules] ([rule_id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_procedure_assignments_payslips_payslip_id] FOREIGN KEY ([payslip_id]) REFERENCES [payroll].[payslips] ([payslip_id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_procedure_assignments_procedure_slips_slip_id] FOREIGN KEY ([slip_id]) REFERENCES [payroll].[procedure_slips] ([slip_id]) ON DELETE NO ACTION
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153146_InitialMicroservice'
)
BEGIN
    CREATE TABLE [payroll].[complaint_attachments] (
        [attachment_id] uniqueidentifier NOT NULL DEFAULT (NEWID()),
        [complaint_id] uniqueidentifier NOT NULL,
        [file_url] nvarchar(500) NOT NULL,
        [file_name] nvarchar(255) NULL,
        [uploaded_by] uniqueidentifier NOT NULL,
        [uploaded_at] datetime2(0) NULL DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT [PK_complaint_attachments] PRIMARY KEY ([attachment_id]),
        CONSTRAINT [FK_complaint_attachments_complaints_complaint_id] FOREIGN KEY ([complaint_id]) REFERENCES [payroll].[complaints] ([complaint_id]) ON DELETE CASCADE
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153146_InitialMicroservice'
)
BEGIN
    CREATE UNIQUE INDEX [IX_allowance_types_code] ON [payroll].[allowance_types] ([code]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153146_InitialMicroservice'
)
BEGIN
    CREATE INDEX [IX_commission_rules_service_id] ON [payroll].[commission_rules] ([service_id]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153146_InitialMicroservice'
)
BEGIN
    CREATE INDEX [IX_complaint_attachments_complaint_id] ON [payroll].[complaint_attachments] ([complaint_id]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153146_InitialMicroservice'
)
BEGIN
    CREATE INDEX [IX_complaints_payslip_id] ON [payroll].[complaints] ([payslip_id]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153146_InitialMicroservice'
)
BEGIN
    CREATE UNIQUE INDEX [IX_payroll_locks_pay_month] ON [payroll].[payroll_locks] ([pay_month]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153146_InitialMicroservice'
)
BEGIN
    CREATE INDEX [IX_payslip_allowances_allowance_id] ON [payroll].[payslip_allowances] ([allowance_id]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153146_InitialMicroservice'
)
BEGIN
    CREATE INDEX [IX_payslip_allowances_payslip_id] ON [payroll].[payslip_allowances] ([payslip_id]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153146_InitialMicroservice'
)
BEGIN
    CREATE INDEX [IX_payslip_deductions_payslip] ON [payroll].[payslip_deductions] ([payslip_id], [deduction_type]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153146_InitialMicroservice'
)
BEGIN
    CREATE INDEX [IX_payslips_bank_export_id] ON [payroll].[payslips] ([bank_export_id]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153146_InitialMicroservice'
)
BEGIN
    CREATE INDEX [IX_payslips_pay_month_status] ON [payroll].[payslips] ([pay_month], [status], [department_id]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153146_InitialMicroservice'
)
BEGIN
    CREATE UNIQUE INDEX [IX_payslips_staff_id_pay_month] ON [payroll].[payslips] ([staff_id], [pay_month]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153146_InitialMicroservice'
)
BEGIN
    CREATE INDEX [IX_procedure_assignments_payslip_id] ON [payroll].[procedure_assignments] ([payslip_id]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153146_InitialMicroservice'
)
BEGIN
    CREATE INDEX [IX_procedure_assignments_rule_id] ON [payroll].[procedure_assignments] ([rule_id]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153146_InitialMicroservice'
)
BEGIN
    CREATE INDEX [IX_procedure_assignments_slip_id] ON [payroll].[procedure_assignments] ([slip_id]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153146_InitialMicroservice'
)
BEGIN
    CREATE UNIQUE INDEX [IX_procedure_services_service_code] ON [payroll].[procedure_services] ([service_code]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153146_InitialMicroservice'
)
BEGIN
    CREATE INDEX [IX_procedure_slips_service_id] ON [payroll].[procedure_slips] ([service_id]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153146_InitialMicroservice'
)
BEGIN
    CREATE UNIQUE INDEX [IX_procedure_slips_slip_number] ON [payroll].[procedure_slips] ([slip_number]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153146_InitialMicroservice'
)
BEGIN
    CREATE INDEX [IX_staff_allowances_allowance_id] ON [payroll].[staff_allowances] ([allowance_id]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153146_InitialMicroservice'
)
BEGIN
    CREATE INDEX [IX_staff_allowances_staff_effective] ON [payroll].[staff_allowances] ([staff_id], [status], [effective_from], [effective_to]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153146_InitialMicroservice'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261022153146_InitialMicroservice', N'8.0.11');
END;
GO

COMMIT;
GO

BEGIN TRANSACTION;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153431_RefineMaternityPrecision'
)
BEGIN
    DECLARE @var0 sysname;
    SELECT @var0 = [d].[name]
    FROM [sys].[default_constraints] [d]
    INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
    WHERE ([d].[parent_object_id] = OBJECT_ID(N'[payroll].[maternity_cases]') AND [c].[name] = N'insurance_eligible');
    IF @var0 IS NOT NULL EXEC(N'ALTER TABLE [payroll].[maternity_cases] DROP CONSTRAINT [' + @var0 + '];');
    ALTER TABLE [payroll].[maternity_cases] ADD DEFAULT CAST(0 AS bit) FOR [insurance_eligible];
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153431_RefineMaternityPrecision'
)
BEGIN
    DECLARE @var1 sysname;
    SELECT @var1 = [d].[name]
    FROM [sys].[default_constraints] [d]
    INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
    WHERE ([d].[parent_object_id] = OBJECT_ID(N'[payroll].[maternity_cases]') AND [c].[name] = N'total_benefit_amount');
    IF @var1 IS NOT NULL EXEC(N'ALTER TABLE [payroll].[maternity_cases] DROP CONSTRAINT [' + @var1 + '];');
    ALTER TABLE [payroll].[maternity_cases] DROP COLUMN [total_benefit_amount];
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153431_RefineMaternityPrecision'
)
BEGIN
    EXEC(N'ALTER TABLE [payroll].[maternity_cases] ADD [total_benefit_amount] AS [benefit_amount] + [additional_benefit_amount] PERSISTED');
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153431_RefineMaternityPrecision'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261022153431_RefineMaternityPrecision', N'8.0.11');
END;
GO

COMMIT;
GO

