/* SSMS: run the WHOLE script. Default is a dry run and ROLLBACK.
   Scope defaults to October's CS1-101 / CS1-102 demo only.
   Keep staff, device mappings, schedules, leave, contracts, payroll and old audits.
   Back up the database before changing @Apply to 1.
*/
USE [VNC_HRMS_Iteration1];
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @Month nvarchar(7) = N'2026-10';
DECLARE @OnlyDemoStaff bit = 1; -- 1: CS1-101/102 only; 0: all imports in @Month
DECLARE @ResetOnCall bit = 1; -- also remove actual duty records in this scope
DECLARE @ResetMonthlyTimesheet bit = 1; -- remove the month's attendance snapshot, not payroll locks
DECLARE @Apply bit = 0; -- 0: show counts + ROLLBACK; 1: COMMIT

IF DB_NAME() <> N'VNC_HRMS_Iteration1'
    THROW 51000, N'Unexpected database. Reset aborted.', 1;
DECLARE @Start date = TRY_CONVERT(date, @Month + N'-01', 23);
IF @Start IS NULL OR CONVERT(char(7), @Start, 126) <> @Month
    THROW 51000, N'Month must be YYYY-MM.', 1;
DECLARE @Next date = DATEADD(month, 1, @Start);

DROP TABLE IF EXISTS #ResetStaff;
DROP TABLE IF EXISTS #ResetBatches;
DROP TABLE IF EXISTS #ResetRows;
DROP TABLE IF EXISTS #ResetDuties;
DROP TABLE IF EXISTS #ResetRecords;

BEGIN TRY
    BEGIN TRANSACTION;

    SELECT staff_id, staff_code, device_enroll_id
    INTO #ResetStaff
    FROM dbo.staff WITH (UPDLOCK, HOLDLOCK)
    WHERE @OnlyDemoStaff = 0 OR staff_code IN (N'CS1-101', N'CS1-102');
    IF @OnlyDemoStaff = 1 AND (SELECT COUNT(*) FROM #ResetStaff) <> 2
        THROW 51000, N'Demo staff not found. Check the staff-code filter.', 1;

    SELECT b.import_id
    INTO #ResetBatches
    FROM dbo.attendance_imports b WITH (UPDLOCK, HOLDLOCK)
    WHERE b.pay_month = @Month AND (
        @OnlyDemoStaff = 0
        OR EXISTS (
            SELECT 1 FROM dbo.attendance_import_rows r
            JOIN #ResetStaff s ON r.StaffId = s.staff_id OR r.DeviceEnrollId = s.device_enroll_id
                OR (TRY_CONVERT(bigint, r.DeviceEnrollId) IS NOT NULL
                    AND TRY_CONVERT(bigint, r.DeviceEnrollId) = TRY_CONVERT(bigint, s.device_enroll_id))
            WHERE r.ImportId = b.import_id
        ) OR EXISTS (
            SELECT 1 FROM dbo.attendance_records r JOIN #ResetStaff s ON r.staff_id = s.staff_id
            WHERE r.import_id = b.import_id
        )
    );

    -- Never remove a mixed batch that also contains someone outside the chosen scope.
    IF @OnlyDemoStaff = 1 AND EXISTS (
        SELECT 1 FROM dbo.attendance_import_rows r
        WHERE r.ImportId IN (SELECT import_id FROM #ResetBatches)
          AND NOT EXISTS (
              SELECT 1 FROM #ResetStaff s WHERE r.StaffId = s.staff_id
                 OR (r.StaffId IS NULL AND (r.DeviceEnrollId = s.device_enroll_id
                    OR (TRY_CONVERT(bigint, r.DeviceEnrollId) IS NOT NULL
                        AND TRY_CONVERT(bigint, r.DeviceEnrollId) = TRY_CONVERT(bigint, s.device_enroll_id))))
          )
    ) THROW 51000, N'A batch contains other/unmapped staff. Use a narrower batch or reset the full month explicitly.', 1;

    SELECT Id, AttendanceId INTO #ResetRows FROM dbo.attendance_import_rows WITH (UPDLOCK, HOLDLOCK)
    WHERE ImportId IN (SELECT import_id FROM #ResetBatches);

    SELECT shift_id INTO #ResetDuties FROM dbo.on_call_shifts WITH (UPDLOCK, HOLDLOCK)
    WHERE @ResetOnCall = 1 AND shift_date >= @Start AND shift_date < @Next
      AND staff_id IN (SELECT staff_id FROM #ResetStaff);

    SELECT attendance_id INTO #ResetRecords FROM dbo.attendance_records WITH (UPDLOCK, HOLDLOCK)
    WHERE import_id IN (SELECT import_id FROM #ResetBatches)
       OR attendance_id IN (SELECT AttendanceId FROM #ResetRows)
       OR on_call_shift_id IN (SELECT shift_id FROM #ResetDuties);

    IF EXISTS (
        SELECT 1 FROM dbo.attendance_records r JOIN #ResetRecords t ON r.attendance_id = t.attendance_id
        WHERE r.work_date < @Start OR r.work_date >= @Next
           OR r.staff_id NOT IN (SELECT staff_id FROM #ResetStaff)
    ) THROW 51000, N'A linked attendance record is outside the selected scope. Reset aborted.', 1;

    -- Payroll remains untouched. Stop rather than leave payslips backed by deleted attendance.
    IF EXISTS (SELECT 1 FROM dbo.payslips WHERE pay_month = @Month)
       OR EXISTS (SELECT 1 FROM dbo.attendance_records WHERE attendance_id IN (SELECT attendance_id FROM #ResetRecords) AND payslip_id IS NOT NULL)
       OR EXISTS (
           SELECT 1 FROM dbo.payroll_locks WHERE pay_month = @Month AND (
               status IN (N'locked', N'finalized', N'paid', N'exported')
               OR exported_at IS NOT NULL OR exported_by IS NOT NULL OR NULLIF(export_file_url, N'') IS NOT NULL
           )
       ) THROW 51000, N'This month has payroll data/protection. No payroll changes are allowed; reset aborted.', 1;

    IF @ResetMonthlyTimesheet = 0 AND EXISTS (
        SELECT 1 FROM dbo.monthly_timesheets WHERE pay_month = @Month AND status IN (N'locked', N'confirmed', N'paid')
    ) THROW 51000, N'Monthly attendance is locked. Choose whether to reset its attendance snapshot.', 1;
    IF @ResetMonthlyTimesheet = 1 AND @OnlyDemoStaff = 1
       AND EXISTS (SELECT 1 FROM dbo.monthly_timesheets WHERE pay_month = @Month)
       AND (EXISTS (
           SELECT 1 FROM dbo.attendance_records WHERE work_date >= @Start AND work_date < @Next
           AND attendance_id NOT IN (SELECT attendance_id FROM #ResetRecords)
       ) OR EXISTS (
           SELECT 1 FROM dbo.on_call_shifts WHERE shift_date >= @Start AND shift_date < @Next
           AND shift_id NOT IN (SELECT shift_id FROM #ResetDuties)
       )) THROW 51000, N'The monthly snapshot also covers other attendance/duties. Reset aborted.', 1;

    IF EXISTS (
        SELECT 1 FROM dbo.on_call_shifts WHERE AttendanceEvidenceId IN (SELECT attendance_id FROM #ResetRecords)
        AND shift_id NOT IN (SELECT shift_id FROM #ResetDuties)
    ) OR EXISTS (
        SELECT 1 FROM dbo.attendance_records WHERE on_call_shift_id IN (SELECT shift_id FROM #ResetDuties)
        AND attendance_id NOT IN (SELECT attendance_id FROM #ResetRecords)
    ) OR EXISTS (
        SELECT 1 FROM dbo.attendance_import_rows WHERE AttendanceId IN (SELECT attendance_id FROM #ResetRecords)
        AND Id NOT IN (SELECT Id FROM #ResetRows)
    ) THROW 51000, N'Outside-scope references exist. No links will be removed silently.', 1;

    -- Review these counts. No permanent change occurs while @Apply = 0.
    SELECT @Month AS [Month], @OnlyDemoStaff AS DemoOnly,
        (SELECT COUNT(*) FROM #ResetBatches) AS Imports,
        (SELECT COUNT(*) FROM #ResetRows) AS SourceRows,
        (SELECT COUNT(*) FROM #ResetRecords) AS AttendanceRecords,
        (SELECT COUNT(*) FROM #ResetDuties) AS DutyRecords,
        (SELECT COUNT(*) FROM dbo.monthly_timesheets WHERE pay_month = @Month AND @ResetMonthlyTimesheet = 1) AS MonthlySnapshots;
    SELECT s.staff_code, r.validation_status, COUNT(*) AS RecordsToDelete
    FROM dbo.attendance_records r JOIN #ResetStaff s ON r.staff_id = s.staff_id
    WHERE r.attendance_id IN (SELECT attendance_id FROM #ResetRecords)
    GROUP BY s.staff_code, r.validation_status;

    -- Break only circular references belonging to the selected reset, then delete in FK order.
    UPDATE dbo.on_call_shifts SET AttendanceEvidenceId = NULL
    WHERE shift_id IN (SELECT shift_id FROM #ResetDuties);
    UPDATE dbo.attendance_records SET on_call_shift_id = NULL
    WHERE attendance_id IN (SELECT attendance_id FROM #ResetRecords);
    DELETE FROM dbo.attendance_import_rows WHERE Id IN (SELECT Id FROM #ResetRows);
    DECLARE @DeletedRows int = @@ROWCOUNT;
    DELETE FROM dbo.attendance_records WHERE attendance_id IN (SELECT attendance_id FROM #ResetRecords);
    DECLARE @DeletedRecords int = @@ROWCOUNT;
    DELETE FROM dbo.on_call_shifts WHERE shift_id IN (SELECT shift_id FROM #ResetDuties);
    DECLARE @DeletedDuties int = @@ROWCOUNT;
    DELETE FROM dbo.attendance_imports WHERE import_id IN (SELECT import_id FROM #ResetBatches);
    DECLARE @DeletedImports int = @@ROWCOUNT;
    DELETE FROM dbo.monthly_timesheets WHERE @ResetMonthlyTimesheet = 1 AND pay_month = @Month;
    DECLARE @DeletedSnapshots int = @@ROWCOUNT;

    INSERT dbo.audit_logs(log_id, username, action, entity_type, Module, Result, new_value, created_at)
    VALUES (NEWID(), LEFT(SUSER_SNAME(), 50), N'reset_attendance_demo', N'AttendanceReset', N'attendance', N'success',
        (SELECT @Month AS [month], @OnlyDemoStaff AS demoOnly, @DeletedImports AS imports,
            @DeletedRows AS sourceRows, @DeletedRecords AS attendanceRecords, @DeletedDuties AS dutyRecords,
            @DeletedSnapshots AS monthlySnapshots, N'User-run demo reset; schedules and payroll preserved' AS reason
         FOR JSON PATH, WITHOUT_ARRAY_WRAPPER), SYSUTCDATETIME());

    IF @Apply = 1 BEGIN
        COMMIT;
        PRINT N'COMMITTED: selected demo attendance reset. Staff, mappings, schedules and payroll preserved.';
    END ELSE BEGIN
        ROLLBACK;
        PRINT N'DRY RUN ONLY: all changes rolled back. Set @Apply = 1 and run the whole script to apply.';
    END;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK;
    THROW;
END CATCH;
