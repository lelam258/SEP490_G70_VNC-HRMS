param(
    [string]$ConnectionString = 'Server=localhost;Database=VNC_HRMS_Iteration1;Integrated Security=True;Encrypt=True;TrustServerCertificate=True;',
    [string]$DatabasePrefix = 'VNC',
    [string]$LegacySourceDatabase = 'VNC_HRMS_Iteration1'
)
# Run offline. Source tables remain unchanged; destination business tables must be empty.
# Sessions and OTPs are excluded; users must log in again and request new codes.
$ErrorActionPreference = 'Stop'
function Quote-Identifier([string]$value) { '[' + $value.Replace(']', ']]') + ']' }
$connection = New-Object System.Data.SqlClient.SqlConnection $ConnectionString
$transaction = $null
function Invoke-Scalar([string]$sql) {
    $cmd = $connection.CreateCommand()
    try { $cmd.Transaction=$transaction; $cmd.CommandText=$sql; $cmd.CommandTimeout=120; $cmd.ExecuteScalar() } finally { $cmd.Dispose() }
}
function Invoke-Sql([string]$sql) {
    $cmd = $connection.CreateCommand()
    try { $cmd.Transaction=$transaction; $cmd.CommandText=$sql; $cmd.CommandTimeout=120; [void]$cmd.ExecuteNonQuery() } finally { $cmd.Dispose() }
}
try {
    $connection.Open()
    $target = Quote-Identifier $connection.Database
    $sourceIamName = "${DatabasePrefix}_IAM_DB"; $sourceIam = Quote-Identifier $sourceIamName
    if ($sourceIamName -eq $connection.Database) { throw 'Source and destination must differ.' }
    $hasMicroserviceData = $false; $literalIam = $sourceIamName.Replace("'", "''")
    if (Invoke-Scalar "SELECT COUNT(*) FROM sys.databases WHERE name=N'$literalIam'") {
        $hasMicroserviceData = (Invoke-Scalar "SELECT COUNT_BIG(*) FROM $sourceIam.iam.users") -gt 0
    }
    $legacy = Quote-Identifier $LegacySourceDatabase
    $legacyMap = @{ users='users'; credentials='auth'; positions='organization'; departments='organization'; staff='employees'; contracts='employees'; degrees='employees' }
    if (-not $hasMicroserviceData) {
        $literalLegacy = $LegacySourceDatabase.Replace("'", "''")
        if (-not (Invoke-Scalar "SELECT COUNT(*) FROM sys.databases WHERE name=N'$literalLegacy'")) { Write-Output 'No previous data to import.'; return }
        if (-not (Invoke-Scalar "SELECT COUNT(*) FROM $legacy.sys.tables t JOIN $legacy.sys.schemas s ON s.schema_id=t.schema_id WHERE s.name='users' AND t.name='users'")) { Write-Output 'No previous data to import.'; return }
        if (-not (Invoke-Scalar "SELECT COUNT_BIG(*) FROM $legacy.users.users")) { Write-Output 'No previous data to import.'; return }
    }
    $transaction = $connection.BeginTransaction([System.Data.IsolationLevel]::Serializable)
    $cmd=$connection.CreateCommand(); $cmd.Transaction=$transaction
    $cmd.CommandText="SELECT s.name AS schema_name,t.name AS table_name FROM sys.tables t JOIN sys.schemas s ON s.schema_id=t.schema_id WHERE s.name IN ('iam','hr','attendance','payroll','compliance','notification') ORDER BY s.name,t.name"
    $reader=$cmd.ExecuteReader(); $tables=New-Object System.Data.DataTable
    $tables.Load($reader); $reader.Dispose(); $cmd.Dispose()
    if ($tables.Rows.Count -eq 0) { throw 'Apply the application migration before importing.' }
    foreach ($table in $tables.Rows) {
        $qualified="$target.$(Quote-Identifier $table.schema_name).$(Quote-Identifier $table.table_name)"
        if (Invoke-Scalar "SELECT COUNT_BIG(*) FROM $qualified WITH (UPDLOCK,HOLDLOCK)") { throw "Destination $($table.schema_name).$($table.table_name) is not empty. Import cancelled without overwriting data." }
        Invoke-Sql "ALTER TABLE $qualified NOCHECK CONSTRAINT ALL;"
    }
    $copied=@()
    foreach ($table in $tables.Rows) {
        $schema=[string]$table.schema_name; $name=[string]$table.table_name
        if ($name -in @('refresh_tokens','password_reset_tokens')) { continue }
        if ($hasMicroserviceData) {
            $module=@{ iam='IAM'; hr='HR'; attendance='Attendance'; payroll='Payroll'; compliance='Compliance'; notification='Notification' }[$schema]
            $sourceName="${DatabasePrefix}_${module}_DB"; $sourceDb=Quote-Identifier $sourceName; $oldSchema=$schema
            $literalSource=$sourceName.Replace("'", "''")
            if (-not (Invoke-Scalar "SELECT COUNT(*) FROM sys.databases WHERE name=N'$literalSource'")) { throw "Source $sourceName is missing. Restore it before importing." }
        } else {
            if (-not $legacyMap.ContainsKey($name)) { continue }
            $sourceDb=$legacy; $oldSchema=$legacyMap[$name]
        }
        $targetTable="$target.$(Quote-Identifier $schema).$(Quote-Identifier $name)"
        $sourceTable="$sourceDb.$(Quote-Identifier $oldSchema).$(Quote-Identifier $name)"
        Invoke-Sql @"
SET XACT_ABORT ON;
DECLARE @columns nvarchar(max), @identity bit;
IF EXISTS (
 SELECT 1 FROM $target.sys.columns c JOIN $target.sys.tables t ON c.object_id=t.object_id JOIN $target.sys.schemas s ON s.schema_id=t.schema_id
 WHERE s.name='$schema' AND t.name='$name' AND c.system_type_id<>189 AND c.is_computed=0
 AND NOT EXISTS (SELECT 1 FROM $sourceDb.sys.columns sc JOIN $sourceDb.sys.tables st ON sc.object_id=st.object_id JOIN $sourceDb.sys.schemas ss ON ss.schema_id=st.schema_id
 WHERE ss.name='$oldSchema' AND st.name='$name' AND sc.name=c.name)
) THROW 51001, 'Source columns do not match application schema.', 1;
SELECT @columns=STRING_AGG(CONVERT(nvarchar(max),QUOTENAME(c.name)),',') WITHIN GROUP (ORDER BY c.column_id), @identity=CONVERT(bit,MAX(CONVERT(int,c.is_identity)))
FROM $target.sys.columns c JOIN $target.sys.tables t ON c.object_id=t.object_id JOIN $target.sys.schemas s ON s.schema_id=t.schema_id
WHERE s.name='$schema' AND t.name='$name' AND c.system_type_id<>189 AND c.is_computed=0;
IF @columns IS NULL THROW 51002, 'Destination schema is missing.', 1;
DECLARE @sql nvarchar(max)=CASE WHEN @identity=1 THEN N'SET IDENTITY_INSERT $targetTable ON;' ELSE N'' END
+ N'INSERT INTO $targetTable ('+@columns+') SELECT '+@columns+' FROM $sourceTable;'
+ CASE WHEN @identity=1 THEN N'SET IDENTITY_INSERT $targetTable OFF;' ELSE N'' END;
EXEC sys.sp_executesql @sql;
IF (SELECT COUNT_BIG(*) FROM $targetTable)<>(SELECT COUNT_BIG(*) FROM $sourceTable) THROW 51003, 'Copied row count mismatch.', 1;
"@
        $count=Invoke-Scalar "SELECT COUNT_BIG(*) FROM $targetTable"
        $copied+="$schema.$name=$count"
    }
    $credentialSource=if ($hasMicroserviceData) { "$sourceIam.iam.credentials" } else { "$legacy.auth.credentials" }
    Invoke-Sql @"
IF EXISTS (SELECT 1 FROM $target.iam.credentials c FULL JOIN $credentialSource old ON old.user_id=c.user_id WHERE c.user_id IS NULL OR old.user_id IS NULL OR c.password_hash<>old.password_hash)
 THROW 51004, 'Credential verification failed.', 1;
IF EXISTS (SELECT 1 FROM $target.iam.users u LEFT JOIN $target.hr.staff s ON s.staff_id=u.employee_id WHERE u.employee_id IS NOT NULL AND s.staff_id IS NULL)
 THROW 51005, 'Account references a missing employee.', 1;
IF EXISTS (SELECT 1 FROM $target.hr.staff s LEFT JOIN $target.iam.users u ON u.user_id=s.user_id WHERE s.user_id IS NOT NULL AND (u.user_id IS NULL OR u.employee_id IS NULL OR u.employee_id<>s.staff_id))
 THROW 51006, 'Employee/account links conflict.', 1;
IF EXISTS (SELECT 1 FROM $target.hr.staff s JOIN $target.iam.users u ON u.employee_id=s.staff_id WHERE s.user_id IS NOT NULL AND s.user_id<>u.user_id)
 THROW 51007, 'Employee/account links conflict.', 1;
UPDATE s SET user_id=u.user_id FROM $target.hr.staff s JOIN $target.iam.users u ON u.employee_id=s.staff_id WHERE s.user_id IS NULL;
UPDATE $target.iam.users SET role='hr_manager',security_version=security_version+1,updated_at=SYSUTCDATETIME() WHERE role='hr';
IF EXISTS (SELECT 1 FROM $target.iam.users WHERE role NOT IN ('admin','hr_manager','hr_staff','accountant','department_head','employee'))
 THROW 51008, 'Unknown account role.', 1;
"@
    foreach ($table in $tables.Rows) { Invoke-Sql "ALTER TABLE $target.$(Quote-Identifier $table.schema_name).$(Quote-Identifier $table.table_name) WITH CHECK CHECK CONSTRAINT ALL;" }
    $transaction.Commit()
    Write-Output ('Imported: '+($copied -join '; '))
    Write-Output 'IDs, password hashes and roles preserved. Sources unchanged. Log in again and request new OTPs.'
} catch {
    if ($transaction) { try { $transaction.Rollback() } catch { } }
    throw
} finally { if ($transaction) { $transaction.Dispose() }; $connection.Dispose() }
