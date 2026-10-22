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
    WHERE [MigrationId] = N'20261022153149_InitialMicroservice'
)
BEGIN
    IF SCHEMA_ID(N'compliance') IS NULL EXEC(N'CREATE SCHEMA [compliance];');
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153149_InitialMicroservice'
)
BEGIN
    CREATE TABLE [compliance].[certificates] (
        [certificate_id] uniqueidentifier NOT NULL DEFAULT (NEWID()),
        [staff_id] uniqueidentifier NOT NULL,
        [department_id] uniqueidentifier NULL,
        [certificate_number] nvarchar(100) NULL,
        [certificate_type] nvarchar(100) NOT NULL,
        [issuing_authority] nvarchar(200) NULL,
        [issue_date] date NULL,
        [expiry_date] date NULL,
        [scope_of_practice] nvarchar(200) NULL,
        [cme_cycle_months] int NULL,
        [cme_required_credits] decimal(6,2) NULL,
        [status] nvarchar(20) NULL DEFAULT ('active'),
        [file_url] nvarchar(500) NULL,
        [uploaded_by] uniqueidentifier NULL,
        [created_at] datetime2(0) NULL DEFAULT (SYSUTCDATETIME()),
        [updated_at] datetime2(0) NULL DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT [PK_certificates] PRIMARY KEY ([certificate_id]),
        CONSTRAINT [CK_certificates_1] CHECK ([expiry_date] IS NULL OR [issue_date] IS NULL OR [expiry_date] >= [issue_date])
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153149_InitialMicroservice'
)
BEGIN
    CREATE TABLE [compliance].[cme_cycles] (
        [cycle_id] uniqueidentifier NOT NULL DEFAULT (NEWID()),
        [certificate_id] uniqueidentifier NOT NULL,
        [cycle_number] int NOT NULL,
        [cycle_start] date NOT NULL,
        [cycle_end] date NOT NULL,
        [required_credits] decimal(6,2) NOT NULL,
        [earned_credits] decimal(6,2) NULL DEFAULT (0),
        [status] nvarchar(20) NULL DEFAULT ('active'),
        CONSTRAINT [PK_cme_cycles] PRIMARY KEY ([cycle_id]),
        CONSTRAINT [CK_cme_cycles_1] CHECK ([cycle_end] >= [cycle_start]),
        CONSTRAINT [CK_cme_cycles_2] CHECK ([cycle_number] > 0 AND [required_credits] >= 0 AND [earned_credits] >= 0),
        CONSTRAINT [FK_cme_cycles_certificates_certificate_id] FOREIGN KEY ([certificate_id]) REFERENCES [compliance].[certificates] ([certificate_id]) ON DELETE NO ACTION
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153149_InitialMicroservice'
)
BEGIN
    CREATE TABLE [compliance].[compliance_scans] (
        [scan_id] uniqueidentifier NOT NULL DEFAULT (NEWID()),
        [staff_id] uniqueidentifier NOT NULL,
        [department_id] uniqueidentifier NULL,
        [certificate_id] uniqueidentifier NULL,
        [scan_date] datetime2(0) NULL DEFAULT (SYSUTCDATETIME()),
        [expiry_date] date NULL,
        [days_remaining] int NULL,
        [cme_credits_earned] decimal(6,2) NULL,
        [cme_credits_needed] decimal(6,2) NULL,
        [compliance_status] nvarchar(30) NOT NULL,
        [alert_sent] bit NULL DEFAULT (0),
        [alert_sent_at] datetime2(0) NULL,
        CONSTRAINT [PK_compliance_scans] PRIMARY KEY ([scan_id]),
        CONSTRAINT [FK_compliance_scans_certificates_certificate_id] FOREIGN KEY ([certificate_id]) REFERENCES [compliance].[certificates] ([certificate_id]) ON DELETE NO ACTION
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153149_InitialMicroservice'
)
BEGIN
    CREATE TABLE [compliance].[cme_records] (
        [cme_id] uniqueidentifier NOT NULL DEFAULT (NEWID()),
        [certificate_id] uniqueidentifier NOT NULL,
        [cme_cycle_id] uniqueidentifier NULL,
        [course_name] nvarchar(200) NOT NULL,
        [provider] nvarchar(200) NULL,
        [completed_date] date NOT NULL,
        [credits] decimal(5,2) NOT NULL,
        [file_url] nvarchar(500) NULL,
        [verified] bit NULL DEFAULT (0),
        [verified_by] uniqueidentifier NULL,
        [verified_at] datetime2(0) NULL,
        [created_at] datetime2(0) NULL DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT [PK_cme_records] PRIMARY KEY ([cme_id]),
        CONSTRAINT [CK_cme_records_1] CHECK ([credits] >= 0),
        CONSTRAINT [FK_cme_records_certificates_certificate_id] FOREIGN KEY ([certificate_id]) REFERENCES [compliance].[certificates] ([certificate_id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_cme_records_cme_cycles_cme_cycle_id] FOREIGN KEY ([cme_cycle_id]) REFERENCES [compliance].[cme_cycles] ([cycle_id]) ON DELETE NO ACTION
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153149_InitialMicroservice'
)
BEGIN
    EXEC(N'CREATE UNIQUE INDEX [IX_certificates_certificate_number] ON [compliance].[certificates] ([certificate_number]) WHERE [certificate_number] IS NOT NULL');
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153149_InitialMicroservice'
)
BEGIN
    CREATE INDEX [IX_certificates_expiry_date] ON [compliance].[certificates] ([expiry_date], [status]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153149_InitialMicroservice'
)
BEGIN
    CREATE UNIQUE INDEX [IX_cme_cycles_certificate_id_cycle_number] ON [compliance].[cme_cycles] ([certificate_id], [cycle_number]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153149_InitialMicroservice'
)
BEGIN
    CREATE INDEX [IX_cme_cycles_cycle_end] ON [compliance].[cme_cycles] ([cycle_end], [status]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153149_InitialMicroservice'
)
BEGIN
    CREATE INDEX [IX_cme_records_certificate_id] ON [compliance].[cme_records] ([certificate_id]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153149_InitialMicroservice'
)
BEGIN
    CREATE INDEX [IX_cme_records_cme_cycle_id] ON [compliance].[cme_records] ([cme_cycle_id]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153149_InitialMicroservice'
)
BEGIN
    CREATE INDEX [IX_compliance_scans_certificate_id] ON [compliance].[compliance_scans] ([certificate_id]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153149_InitialMicroservice'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261022153149_InitialMicroservice', N'8.0.11');
END;
GO

COMMIT;
GO

