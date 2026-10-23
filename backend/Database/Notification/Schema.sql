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
    WHERE [MigrationId] = N'20261022153152_InitialMicroservice'
)
BEGIN
    IF SCHEMA_ID(N'notification') IS NULL EXEC(N'CREATE SCHEMA [notification];');
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153152_InitialMicroservice'
)
BEGIN
    CREATE TABLE [notification].[notifications] (
        [notification_id] uniqueidentifier NOT NULL DEFAULT (NEWID()),
        [recipient_id] uniqueidentifier NOT NULL,
        [sender_service] nvarchar(50) NOT NULL,
        [type] nvarchar(50) NOT NULL,
        [title] nvarchar(200) NOT NULL,
        [body] nvarchar(max) NULL,
        [action_url] nvarchar(500) NULL,
        [entity_type] nvarchar(50) NULL,
        [entity_id] uniqueidentifier NULL,
        [channel] nvarchar(20) NULL DEFAULT ('in_app'),
        [is_read] bit NULL DEFAULT (0),
        [read_at] datetime2(0) NULL,
        [created_at] datetime2(0) NULL DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT [PK_notifications] PRIMARY KEY ([notification_id])
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153152_InitialMicroservice'
)
BEGIN
    CREATE INDEX [IX_notifications_recipient_unread] ON [notification].[notifications] ([recipient_id], [is_read], [created_at] DESC);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153152_InitialMicroservice'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261022153152_InitialMicroservice', N'8.0.11');
END;
GO

COMMIT;
GO

