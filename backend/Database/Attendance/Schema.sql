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
    WHERE [MigrationId] = N'20261022153143_InitialMicroservice'
)
BEGIN
    IF SCHEMA_ID(N'attendance') IS NULL EXEC(N'CREATE SCHEMA [attendance];');
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153143_InitialMicroservice'
)
BEGIN
    CREATE TABLE [attendance].[attendance_imports] (
        [import_id] uniqueidentifier NOT NULL DEFAULT (NEWID()),
        [file_name] nvarchar(255) NOT NULL,
        [file_url] nvarchar(500) NULL,
        [imported_by] uniqueidentifier NOT NULL,
        [import_date] datetime2(0) NULL DEFAULT (SYSUTCDATETIME()),
        [pay_month] nvarchar(7) NULL,
        [total_rows] int NULL DEFAULT (0),
        [success_rows] int NULL DEFAULT (0),
        [error_rows] int NULL DEFAULT (0),
        [status] nvarchar(20) NULL DEFAULT ('pending'),
        [error_log] nvarchar(max) NULL,
        [column_mapping] nvarchar(max) NULL,
        CONSTRAINT [PK_attendance_imports] PRIMARY KEY ([import_id]),
        CONSTRAINT [CK_attendance_imports_1] CHECK ([total_rows] >= 0 AND [success_rows] >= 0 AND [error_rows] >= 0)
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153143_InitialMicroservice'
)
BEGIN
    CREATE TABLE [attendance].[leave_requests] (
        [request_id] uniqueidentifier NOT NULL DEFAULT (NEWID()),
        [staff_id] uniqueidentifier NOT NULL,
        [department_id] uniqueidentifier NOT NULL,
        [leave_type] nvarchar(50) NOT NULL,
        [start_date] date NOT NULL,
        [end_date] date NOT NULL,
        [total_days] decimal(4,1) NULL,
        [reason] nvarchar(max) NULL,
        [attachment_url] nvarchar(500) NULL,
        [status] nvarchar(20) NULL DEFAULT ('pending'),
        [approved_by] uniqueidentifier NULL,
        [approved_at] datetime2(0) NULL,
        [rejected_reason] nvarchar(max) NULL,
        [created_at] datetime2(0) NULL DEFAULT (SYSUTCDATETIME()),
        [updated_at] datetime2(0) NULL DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT [PK_leave_requests] PRIMARY KEY ([request_id]),
        CONSTRAINT [CK_leave_requests_1] CHECK ([end_date] >= [start_date]),
        CONSTRAINT [CK_leave_requests_2] CHECK ([total_days] IS NULL OR [total_days] > 0)
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153143_InitialMicroservice'
)
BEGIN
    CREATE TABLE [attendance].[monthly_timesheets] (
        [timesheet_id] uniqueidentifier NOT NULL DEFAULT (NEWID()),
        [pay_month] nvarchar(7) NOT NULL,
        [status] nvarchar(20) NOT NULL DEFAULT ('draft'),
        [locked_by] uniqueidentifier NULL,
        [locked_at] datetime2(0) NULL,
        [created_at] datetime2(0) NOT NULL DEFAULT (SYSUTCDATETIME()),
        [updated_at] datetime2(0) NOT NULL DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT [PK_monthly_timesheets] PRIMARY KEY ([timesheet_id]),
        CONSTRAINT [CK_monthly_timesheets_1] CHECK ([pay_month] LIKE '[12][0-9][0-9][0-9]-[01][0-9]' AND TRY_CONVERT(date, [pay_month] + '-01', 23) IS NOT NULL)
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153143_InitialMicroservice'
)
BEGIN
    CREATE TABLE [attendance].[on_call_shifts] (
        [shift_id] uniqueidentifier NOT NULL DEFAULT (NEWID()),
        [staff_id] uniqueidentifier NOT NULL,
        [department_id] uniqueidentifier NOT NULL,
        [shift_date] date NOT NULL,
        [shift_category] nvarchar(30) NOT NULL,
        [shift_start] datetime2(0) NULL,
        [shift_end] datetime2(0) NULL,
        [recorded_by] uniqueidentifier NOT NULL,
        [confirmed_by] uniqueidentifier NULL,
        [confirmed_at] datetime2(0) NULL,
        [status] nvarchar(20) NULL DEFAULT ('pending'),
        [rejected_reason] nvarchar(max) NULL,
        [note] nvarchar(max) NULL,
        [created_at] datetime2(0) NULL DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT [PK_on_call_shifts] PRIMARY KEY ([shift_id]),
        CONSTRAINT [CK_on_call_shifts_1] CHECK ([shift_end] IS NULL OR [shift_start] IS NULL OR [shift_end] > [shift_start])
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153143_InitialMicroservice'
)
BEGIN
    CREATE TABLE [attendance].[work_schedule_templates] (
        [template_id] uniqueidentifier NOT NULL DEFAULT (NEWID()),
        [name] nvarchar(100) NOT NULL,
        [shift_start] time NOT NULL,
        [shift_end] time NOT NULL,
        [break_minutes] int NULL DEFAULT (0),
        [standard_hours] decimal(4,2) NULL,
        [description] nvarchar(max) NULL,
        [status] nvarchar(20) NULL DEFAULT ('active'),
        CONSTRAINT [PK_work_schedule_templates] PRIMARY KEY ([template_id]),
        CONSTRAINT [CK_work_schedule_templates_1] CHECK ([break_minutes] >= 0)
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153143_InitialMicroservice'
)
BEGIN
    CREATE TABLE [attendance].[attendance_records] (
        [attendance_id] uniqueidentifier NOT NULL DEFAULT (NEWID()),
        [staff_id] uniqueidentifier NOT NULL,
        [staff_code] nvarchar(20) NOT NULL,
        [department_id] uniqueidentifier NULL,
        [import_id] uniqueidentifier NULL,
        [on_call_shift_id] uniqueidentifier NULL,
        [work_date] date NOT NULL,
        [shift_type] nvarchar(30) NULL,
        [check_in] datetime2(0) NULL,
        [check_out] datetime2(0) NULL,
        [actual_hours] decimal(5,2) NULL,
        [source] nvarchar(20) NULL DEFAULT ('fingerprint'),
        [validation_status] nvarchar(20) NULL DEFAULT ('pending'),
        [note] nvarchar(max) NULL,
        [reconciled_by] uniqueidentifier NULL,
        [reconciled_at] datetime2(0) NULL,
        [reconcile_note] nvarchar(max) NULL,
        [confirmed_by] uniqueidentifier NULL,
        [confirmed_at] datetime2(0) NULL,
        [payslip_id] uniqueidentifier NULL,
        [created_at] datetime2(0) NULL DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT [PK_attendance_records] PRIMARY KEY ([attendance_id]),
        CONSTRAINT [CK_attendance_records_1] CHECK ([check_out] IS NULL OR [check_in] IS NULL OR [check_out] >= [check_in]),
        CONSTRAINT [CK_attendance_records_2] CHECK ([actual_hours] IS NULL OR [actual_hours] >= 0),
        CONSTRAINT [FK_attendance_records_attendance_imports_import_id] FOREIGN KEY ([import_id]) REFERENCES [attendance].[attendance_imports] ([import_id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_attendance_records_on_call_shifts_on_call_shift_id] FOREIGN KEY ([on_call_shift_id]) REFERENCES [attendance].[on_call_shifts] ([shift_id]) ON DELETE NO ACTION
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153143_InitialMicroservice'
)
BEGIN
    CREATE INDEX [IX_attendance_records_import_id] ON [attendance].[attendance_records] ([import_id]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153143_InitialMicroservice'
)
BEGIN
    CREATE INDEX [IX_attendance_records_on_call_shift_id] ON [attendance].[attendance_records] ([on_call_shift_id]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153143_InitialMicroservice'
)
BEGIN
    CREATE INDEX [IX_attendance_records_staff_code_work_date] ON [attendance].[attendance_records] ([staff_code], [work_date]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153143_InitialMicroservice'
)
BEGIN
    EXEC(N'CREATE UNIQUE INDEX [IX_attendance_records_staff_id_work_date_shift_type] ON [attendance].[attendance_records] ([staff_id], [work_date], [shift_type]) WHERE [shift_type] IS NOT NULL');
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153143_InitialMicroservice'
)
BEGIN
    CREATE INDEX [IX_attendance_records_work_date] ON [attendance].[attendance_records] ([work_date], [department_id], [validation_status]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153143_InitialMicroservice'
)
BEGIN
    CREATE UNIQUE INDEX [IX_monthly_timesheets_pay_month] ON [attendance].[monthly_timesheets] ([pay_month]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261022153143_InitialMicroservice'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261022153143_InitialMicroservice', N'8.0.11');
END;
GO

COMMIT;
GO

