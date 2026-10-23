param(
    [string]$ConnectionString = 'Server=localhost;Database=VNC_HRMS_Iteration1;Integrated Security=True;Encrypt=True;TrustServerCertificate=True;',
    [string]$DatabasePrefix = 'VNC',
    [string]$LegacySourceDatabase = 'VNC_HRMS_Iteration1',
    [string]$Configuration = 'Debug'
)
$ErrorActionPreference='Stop'
$backendRoot=Split-Path -Parent $PSScriptRoot
$stateDirectory=Join-Path $backendRoot '.local'
New-Item -ItemType Directory -Path $stateDirectory -Force | Out-Null
$statePath=Join-Path $stateDirectory 'application-secrets.json'
$state=$null
foreach ($file in @('application-secrets.json','microservices-secrets.json','secrets.json')) {
    $candidate=Join-Path $stateDirectory $file
    if (Test-Path -LiteralPath $candidate) { $state=Get-Content -LiteralPath $candidate -Raw -Encoding UTF8 | ConvertFrom-Json; break }
}
if (-not $state) { $state=[pscustomobject]@{} }
if (-not $state.JwtSigningKey) {
    $bytes=New-Object byte[] 48; $rng=[Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
    $state | Add-Member -NotePropertyName JwtSigningKey -NotePropertyValue ([Convert]::ToBase64String($bytes)) -Force
}
$state | Add-Member -NotePropertyName ConnectionString -NotePropertyValue $ConnectionString -Force
@{ 'ConnectionStrings:DefaultConnection'=$ConnectionString; 'Jwt:SigningKey'=$state.JwtSigningKey } | ConvertTo-Json | dotnet user-secrets set --project (Join-Path $backendRoot 'Backend.csproj')
if ($LASTEXITCODE -ne 0) { throw 'Failed to save development configuration.' }
$state | ConvertTo-Json | Set-Content -LiteralPath $statePath -Encoding UTF8
Push-Location $backendRoot
try {
    dotnet tool restore
    if ($LASTEXITCODE -ne 0) { throw 'EF tool restore failed.' }
    dotnet build Backend.csproj -c $Configuration
    if ($LASTEXITCODE -ne 0) { throw 'Build failed.' }

    $builder=New-Object System.Data.SqlClient.SqlConnectionStringBuilder $ConnectionString
    $database=$builder['Initial Catalog']
    if ([string]::IsNullOrWhiteSpace($database)) { throw 'ConnectionString must specify a database.' }
    $builder['Initial Catalog']='master'; $connection=New-Object System.Data.SqlClient.SqlConnection $builder.ConnectionString
    try {
        $connection.Open(); $cmd=$connection.CreateCommand(); $cmd.CommandTimeout=120
        $cmd.CommandText='SELECT COUNT(*) FROM sys.databases WHERE name=@database'; [void]$cmd.Parameters.AddWithValue('@database',$database)
        if ($cmd.ExecuteScalar() -gt 0) {
            $cmd.CommandText="SELECT CONVERT(nvarchar(4000),SERVERPROPERTY('InstanceDefaultBackupPath'))"
            $backupDirectory=[string]$cmd.ExecuteScalar()
            if ([string]::IsNullOrWhiteSpace($backupDirectory)) { throw 'Cannot find SQL backup directory. Back up the database in SSMS first.' }
            $safeName=$database -replace '[^a-zA-Z0-9_-]','_'
            $backupPath=Join-Path $backupDirectory ($safeName+'_before_consolidation_'+(Get-Date -Format 'yyyyMMdd_HHmmss_fff')+'.bak')
            $quotedDatabase='['+$database.Replace(']',']]')+']'
            $cmd.CommandText="BACKUP DATABASE $quotedDatabase TO DISK=@path WITH COPY_ONLY,CHECKSUM;"
            [void]$cmd.Parameters.AddWithValue('@path',$backupPath); [void]$cmd.ExecuteNonQuery()
            Write-Output "Database backup: $backupPath"
        }
        $cmd.Dispose()
    } finally { $connection.Dispose() }
    & (Join-Path $PSScriptRoot 'Update-Database.ps1') -Configuration $Configuration -NoBuild
    $connection=New-Object System.Data.SqlClient.SqlConnection $ConnectionString
    try {
        $connection.Open(); $cmd=$connection.CreateCommand(); $cmd.CommandText='SELECT COUNT_BIG(*) FROM iam.users'
        $existingUsers=[long]$cmd.ExecuteScalar(); $cmd.Dispose()
    } finally { $connection.Dispose() }
    if ($existingUsers -eq 0) {
        & (Join-Path $PSScriptRoot 'Import-ExistingData.ps1') -ConnectionString $ConnectionString -DatabasePrefix $DatabasePrefix -LegacySourceDatabase $LegacySourceDatabase
    } else { Write-Output 'Existing application accounts preserved; import skipped.' }
    Write-Output 'Base setup complete. Run dotnet run. Swagger: http://localhost:5100/swagger. Health endpoint: GET /health.'
} finally { Pop-Location }
