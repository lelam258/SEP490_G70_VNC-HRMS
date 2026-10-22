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
    WHERE [MigrationId] = N'20261022153137_InitialMicroservice'
)
BEGIN
    IF SCHEMA_ID(N'iam') IS NULL EXEC(N'CREATE SCHEMA [iam];');
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153137_InitialMicroservice'
)
BEGIN
    CREATE TABLE [iam].[audit_logs] (
        [log_id] uniqueidentifier NOT NULL DEFAULT (NEWID()),
        [user_id] uniqueidentifier NULL,
        [username] nvarchar(50) NULL,
        [action] nvarchar(100) NOT NULL,
        [entity_type] nvarchar(50) NULL,
        [entity_id] uniqueidentifier NULL,
        [old_value] nvarchar(max) NULL,
        [new_value] nvarchar(max) NULL,
        [ip_address] nvarchar(45) NULL,
        [user_agent] nvarchar(300) NULL,
        [created_at] datetime2(0) NULL DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT [PK_audit_logs] PRIMARY KEY ([log_id])
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153137_InitialMicroservice'
)
BEGIN
    CREATE TABLE [iam].[users] (
        [user_id] uniqueidentifier NOT NULL DEFAULT (NEWID()),
        [username] nvarchar(50) NOT NULL,
        [normalized_username] nvarchar(50) NOT NULL,
        [email] nvarchar(100) NULL,
        [employee_id] uniqueidentifier NULL,
        [is_provisioned] bit NOT NULL,
        [security_version] int NOT NULL,
        [version] rowversion NOT NULL,
        [full_name] nvarchar(100) NULL,
        [role] nvarchar(30) NOT NULL,
        [account_status] nvarchar(20) NOT NULL DEFAULT N'active',
        [created_at] datetime2(0) NOT NULL DEFAULT (SYSUTCDATETIME()),
        [updated_at] datetime2(0) NOT NULL DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT [PK_users] PRIMARY KEY ([user_id])
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153137_InitialMicroservice'
)
BEGIN
    CREATE TABLE [iam].[credentials] (
        [user_id] uniqueidentifier NOT NULL,
        [password_hash] nvarchar(255) NOT NULL,
        [version] rowversion NOT NULL,
        [failed_login_count] int NOT NULL,
        [locked_until] datetime2(0) NULL,
        [last_login] datetime2(0) NULL,
        [created_at] datetime2(0) NOT NULL DEFAULT (SYSUTCDATETIME()),
        [updated_at] datetime2(0) NOT NULL DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT [PK_credentials] PRIMARY KEY ([user_id]),
        CONSTRAINT [FK_credentials_users_user_id] FOREIGN KEY ([user_id]) REFERENCES [iam].[users] ([user_id]) ON DELETE NO ACTION
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153137_InitialMicroservice'
)
BEGIN
    CREATE TABLE [iam].[system_policies] (
        [policy_id] uniqueidentifier NOT NULL DEFAULT (NEWID()),
        [policy_key] nvarchar(100) NOT NULL,
        [policy_value] nvarchar(500) NOT NULL,
        [value_type] nvarchar(20) NULL DEFAULT ('string'),
        [description] nvarchar(max) NULL,
        [updated_by] uniqueidentifier NULL,
        [updated_at] datetime2(0) NULL DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT [PK_system_policies] PRIMARY KEY ([policy_id]),
        CONSTRAINT [FK_system_policies_users_updated_by] FOREIGN KEY ([updated_by]) REFERENCES [iam].[users] ([user_id]) ON DELETE NO ACTION
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153137_InitialMicroservice'
)
BEGIN
    CREATE TABLE [iam].[password_reset_tokens] (
        [id] uniqueidentifier NOT NULL,
        [user_id] uniqueidentifier NOT NULL,
        [token_hash] nvarchar(64) NOT NULL,
        [password_stamp] nvarchar(64) NOT NULL,
        [email] nvarchar(100) NOT NULL,
        [created_at] datetime2(0) NOT NULL,
        [expires_at] datetime2(0) NOT NULL,
        [used_at] datetime2(0) NULL,
        [attempts] int NOT NULL,
        [max_attempts] int NOT NULL,
        [code_length] int NOT NULL,
        CONSTRAINT [PK_password_reset_tokens] PRIMARY KEY ([id]),
        CONSTRAINT [FK_password_reset_tokens_credentials_user_id] FOREIGN KEY ([user_id]) REFERENCES [iam].[credentials] ([user_id]) ON DELETE CASCADE
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153137_InitialMicroservice'
)
BEGIN
    CREATE TABLE [iam].[refresh_tokens] (
        [token_id] uniqueidentifier NOT NULL DEFAULT (NEWID()),
        [user_id] uniqueidentifier NOT NULL,
        [account_version] int NOT NULL,
        [token_hash] nvarchar(255) NOT NULL,
        [device_info] nvarchar(200) NULL,
        [expires_at] datetime2(0) NOT NULL,
        [revoked] bit NOT NULL,
        [revoked_at] datetime2(0) NULL,
        [created_at] datetime2(0) NOT NULL DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT [PK_refresh_tokens] PRIMARY KEY ([token_id]),
        CONSTRAINT [FK_refresh_tokens_credentials_user_id] FOREIGN KEY ([user_id]) REFERENCES [iam].[credentials] ([user_id]) ON DELETE CASCADE
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153137_InitialMicroservice'
)
BEGIN
    CREATE UNIQUE INDEX [IX_password_reset_tokens_token_hash] ON [iam].[password_reset_tokens] ([token_hash]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153137_InitialMicroservice'
)
BEGIN
    CREATE INDEX [IX_password_reset_tokens_user_id] ON [iam].[password_reset_tokens] ([user_id]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153137_InitialMicroservice'
)
BEGIN
    CREATE UNIQUE INDEX [IX_refresh_tokens_token_hash] ON [iam].[refresh_tokens] ([token_hash]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153137_InitialMicroservice'
)
BEGIN
    CREATE INDEX [IX_refresh_tokens_user_id] ON [iam].[refresh_tokens] ([user_id]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153137_InitialMicroservice'
)
BEGIN
    CREATE UNIQUE INDEX [IX_system_policies_policy_key] ON [iam].[system_policies] ([policy_key]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153137_InitialMicroservice'
)
BEGIN
    CREATE INDEX [IX_system_policies_updated_by] ON [iam].[system_policies] ([updated_by]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153137_InitialMicroservice'
)
BEGIN
    EXEC(N'CREATE UNIQUE INDEX [IX_users_email] ON [iam].[users] ([email]) WHERE [email] IS NOT NULL');
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153137_InitialMicroservice'
)
BEGIN
    EXEC(N'CREATE UNIQUE INDEX [IX_users_employee_id] ON [iam].[users] ([employee_id]) WHERE [employee_id] IS NOT NULL');
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153137_InitialMicroservice'
)
BEGIN
    CREATE UNIQUE INDEX [IX_users_normalized_username] ON [iam].[users] ([normalized_username]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153137_InitialMicroservice'
)
BEGIN
    CREATE UNIQUE INDEX [IX_users_username] ON [iam].[users] ([username]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153137_InitialMicroservice'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261022153137_InitialMicroservice', N'8.0.11');
END;
GO

COMMIT;
GO

BEGIN TRANSACTION;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022180000_SplitHrAccountRoles'
)
BEGIN
    UPDATE [iam].[users] SET [role] = N'hr_manager', [security_version] = [security_version] + 1,
        [updated_at] = SYSUTCDATETIME() WHERE [role] = N'hr';
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022180000_SplitHrAccountRoles'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261022180000_SplitHrAccountRoles', N'8.0.11');
END;
GO

COMMIT;
GO

