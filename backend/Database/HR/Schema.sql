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
    WHERE [MigrationId] = N'20261022153140_InitialMicroservice'
)
BEGIN
    IF SCHEMA_ID(N'hr') IS NULL EXEC(N'CREATE SCHEMA [hr];');
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153140_InitialMicroservice'
)
BEGIN
    CREATE TABLE [hr].[positions] (
        [position_id] uniqueidentifier NOT NULL DEFAULT (NEWID()),
        [name] nvarchar(100) NOT NULL,
        [scope_tag] nvarchar(50) NULL,
        [status] nvarchar(20) NOT NULL DEFAULT N'active',
        CONSTRAINT [PK_positions] PRIMARY KEY ([position_id])
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153140_InitialMicroservice'
)
BEGIN
    CREATE TABLE [hr].[contracts] (
        [contract_id] uniqueidentifier NOT NULL DEFAULT (NEWID()),
        [staff_id] uniqueidentifier NOT NULL,
        [contract_code] nvarchar(30) NULL,
        [contract_type] nvarchar(50) NOT NULL,
        [daily_rate] decimal(15,2) NOT NULL,
        [effective_from] date NOT NULL,
        [effective_to] date NULL,
        [is_insurance_eligible] bit NOT NULL DEFAULT CAST(1 AS bit),
        [insurance_salary_basis] decimal(15,2) NULL,
        [status] nvarchar(20) NOT NULL DEFAULT N'active',
        [file_url] nvarchar(500) NULL,
        [created_at] datetime2(0) NOT NULL DEFAULT (SYSUTCDATETIME()),
        [updated_at] datetime2(0) NOT NULL DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT [PK_contracts] PRIMARY KEY ([contract_id]),
        CONSTRAINT [CK_contracts_1] CHECK ([effective_to] IS NULL OR [effective_to] >= [effective_from]),
        CONSTRAINT [CK_contracts_2] CHECK ([daily_rate] >= 0 AND ([insurance_salary_basis] IS NULL OR [insurance_salary_basis] >= 0))
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153140_InitialMicroservice'
)
BEGIN
    CREATE TABLE [hr].[degrees] (
        [degree_id] uniqueidentifier NOT NULL DEFAULT (NEWID()),
        [staff_id] uniqueidentifier NOT NULL,
        [degree_type] nvarchar(50) NULL,
        [degree_name] nvarchar(200) NULL,
        [issued_by] nvarchar(200) NULL,
        [issued_at] date NULL,
        [file_url] nvarchar(500) NULL,
        [created_at] datetime2(0) NOT NULL DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT [PK_degrees] PRIMARY KEY ([degree_id])
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153140_InitialMicroservice'
)
BEGIN
    CREATE TABLE [hr].[departments] (
        [department_id] uniqueidentifier NOT NULL DEFAULT (NEWID()),
        [dept_code] nvarchar(20) NOT NULL,
        [name] nvarchar(100) NOT NULL,
        [manager_id] uniqueidentifier NULL,
        [status] nvarchar(20) NOT NULL DEFAULT N'active',
        [created_at] datetime2(0) NOT NULL DEFAULT (SYSUTCDATETIME()),
        [updated_at] datetime2(0) NOT NULL DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT [PK_departments] PRIMARY KEY ([department_id])
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153140_InitialMicroservice'
)
BEGIN
    CREATE TABLE [hr].[staff] (
        [staff_id] uniqueidentifier NOT NULL DEFAULT (NEWID()),
        [user_id] uniqueidentifier NULL,
        [staff_code] nvarchar(20) NOT NULL,
        [device_enroll_id] nvarchar(50) NULL,
        [full_name] nvarchar(100) NOT NULL,
        [date_of_birth] date NULL,
        [gender] nvarchar(10) NULL,
        [phone] nvarchar(20) NULL,
        [email] nvarchar(100) NULL,
        [id_card_number] nvarchar(20) NULL,
        [avatar_url] nvarchar(500) NULL,
        [department_id] uniqueidentifier NULL,
        [position_id] uniqueidentifier NULL,
        [scope_of_practice] nvarchar(200) NULL,
        [date_joined] date NOT NULL,
        [date_left] date NULL,
        [dependent_count] int NOT NULL,
        [status] nvarchar(20) NOT NULL DEFAULT N'active',
        [created_by] uniqueidentifier NULL,
        [created_at] datetime2(0) NOT NULL DEFAULT (SYSUTCDATETIME()),
        [updated_at] datetime2(0) NOT NULL DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT [PK_staff] PRIMARY KEY ([staff_id]),
        CONSTRAINT [CK_staff_1] CHECK ([date_left] IS NULL OR [date_left] >= [date_joined]),
        CONSTRAINT [CK_staff_2] CHECK ([dependent_count] >= 0),
        CONSTRAINT [FK_staff_departments_department_id] FOREIGN KEY ([department_id]) REFERENCES [hr].[departments] ([department_id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_staff_positions_position_id] FOREIGN KEY ([position_id]) REFERENCES [hr].[positions] ([position_id]) ON DELETE NO ACTION
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153140_InitialMicroservice'
)
BEGIN
    EXEC(N'CREATE UNIQUE INDEX [IX_contracts_contract_code] ON [hr].[contracts] ([contract_code]) WHERE [contract_code] IS NOT NULL');
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153140_InitialMicroservice'
)
BEGIN
    CREATE INDEX [IX_contracts_staff_id] ON [hr].[contracts] ([staff_id]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153140_InitialMicroservice'
)
BEGIN
    CREATE INDEX [IX_degrees_staff_id] ON [hr].[degrees] ([staff_id]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153140_InitialMicroservice'
)
BEGIN
    CREATE UNIQUE INDEX [IX_departments_dept_code] ON [hr].[departments] ([dept_code]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153140_InitialMicroservice'
)
BEGIN
    CREATE INDEX [IX_departments_manager_id] ON [hr].[departments] ([manager_id]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153140_InitialMicroservice'
)
BEGIN
    CREATE UNIQUE INDEX [IX_departments_name] ON [hr].[departments] ([name]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153140_InitialMicroservice'
)
BEGIN
    CREATE UNIQUE INDEX [IX_positions_name] ON [hr].[positions] ([name]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153140_InitialMicroservice'
)
BEGIN
    CREATE INDEX [IX_staff_department_id] ON [hr].[staff] ([department_id]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153140_InitialMicroservice'
)
BEGIN
    EXEC(N'CREATE UNIQUE INDEX [IX_staff_device_enroll_id] ON [hr].[staff] ([device_enroll_id]) WHERE [device_enroll_id] IS NOT NULL');
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153140_InitialMicroservice'
)
BEGIN
    EXEC(N'CREATE UNIQUE INDEX [IX_staff_email] ON [hr].[staff] ([email]) WHERE [email] IS NOT NULL');
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153140_InitialMicroservice'
)
BEGIN
    EXEC(N'CREATE UNIQUE INDEX [IX_staff_id_card_number] ON [hr].[staff] ([id_card_number]) WHERE [id_card_number] IS NOT NULL');
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153140_InitialMicroservice'
)
BEGIN
    CREATE INDEX [IX_staff_position_id] ON [hr].[staff] ([position_id]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153140_InitialMicroservice'
)
BEGIN
    CREATE UNIQUE INDEX [IX_staff_staff_code] ON [hr].[staff] ([staff_code]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153140_InitialMicroservice'
)
BEGIN
    EXEC(N'CREATE UNIQUE INDEX [IX_staff_user_id] ON [hr].[staff] ([user_id]) WHERE [user_id] IS NOT NULL');
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153140_InitialMicroservice'
)
BEGIN
    ALTER TABLE [hr].[contracts] ADD CONSTRAINT [FK_contracts_staff_staff_id] FOREIGN KEY ([staff_id]) REFERENCES [hr].[staff] ([staff_id]) ON DELETE NO ACTION;
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153140_InitialMicroservice'
)
BEGIN
    ALTER TABLE [hr].[degrees] ADD CONSTRAINT [FK_degrees_staff_staff_id] FOREIGN KEY ([staff_id]) REFERENCES [hr].[staff] ([staff_id]) ON DELETE NO ACTION;
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153140_InitialMicroservice'
)
BEGIN
    ALTER TABLE [hr].[departments] ADD CONSTRAINT [FK_departments_staff_manager_id] FOREIGN KEY ([manager_id]) REFERENCES [hr].[staff] ([staff_id]) ON DELETE NO ACTION;
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153140_InitialMicroservice'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261022153140_InitialMicroservice', N'8.0.11');
END;
GO

COMMIT;
GO

