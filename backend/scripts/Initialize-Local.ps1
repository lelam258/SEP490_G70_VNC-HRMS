param(
    [string]$ConnectionString = 'Server=localhost;Database=VNC_HRMS_Iteration1;Integrated Security=True;Encrypt=True;TrustServerCertificate=True;',
    [string]$Configuration = 'Debug',
    [switch]$SkipBootstrap
)
$ErrorActionPreference = 'Stop'
$backendRoot=Split-Path -Parent $PSScriptRoot; $project=Join-Path $backendRoot 'Backend.csproj'
$stateDirectory=Join-Path $backendRoot '.local'; New-Item -ItemType Directory -Path $stateDirectory -Force | Out-Null
$statePath=Join-Path $stateDirectory 'application-secrets.json'
function New-Secret {
    $bytes=New-Object byte[] 48; $rng=[Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($bytes); [Convert]::ToBase64String($bytes) } finally { $rng.Dispose() }
}
$old=$null
foreach ($file in @('application-secrets.json','microservices-secrets.json','secrets.json')) {
    $candidate=Join-Path $stateDirectory $file
    if (Test-Path -LiteralPath $candidate) { $old=Get-Content -LiteralPath $candidate -Encoding UTF8 -Raw | ConvertFrom-Json; break }
}
$state=[pscustomobject]@{
    ConnectionString=$ConnectionString
    JwtSigningKey=$(if ($old.JwtSigningKey) { $old.JwtSigningKey } else { New-Secret })
    AdminUsername=$(if ($old.AdminUsername) { $old.AdminUsername } else { 'admin' })
    AdminEmail=$(if ($old.AdminEmail) { $old.AdminEmail } else { 'admin@vnc.local' })
    AdminPassword=$(if ($old.AdminPassword) { $old.AdminPassword } else { 'Vnc@1a'+(New-Secret).Substring(0,24) })
}
@{ 'ConnectionStrings:DefaultConnection'=$ConnectionString; 'Jwt:SigningKey'=$state.JwtSigningKey } | ConvertTo-Json | dotnet user-secrets set --project $project
if ($LASTEXITCODE -ne 0) { throw 'Failed to save development settings.' }
$state | ConvertTo-Json | Set-Content -LiteralPath $statePath -Encoding UTF8
Push-Location $backendRoot
try {
    dotnet tool restore
    if ($LASTEXITCODE -ne 0) { throw 'EF tool restore failed.' }
    dotnet build Backend.csproj -c $Configuration
    if ($LASTEXITCODE -ne 0) { throw 'Build failed.' }
    # SQL Server writes its own backup before any schema/data changes.
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
            $backupPath=Join-Path $backupDirectory ($safeName+'_before_schema_update_'+(Get-Date -Format 'yyyyMMdd_HHmmss_fff')+'.bak')
            $quotedDatabase='['+$database.Replace(']',']]')+']'
            $cmd.CommandText="BACKUP DATABASE $quotedDatabase TO DISK=@path WITH COPY_ONLY,CHECKSUM;"
            [void]$cmd.Parameters.AddWithValue('@path',$backupPath); [void]$cmd.ExecuteNonQuery()
            Write-Output "Database backup: $backupPath"
        }
        $cmd.Dispose()
    } finally { $connection.Dispose() }
    & (Join-Path $PSScriptRoot 'Update-Database.ps1') -Configuration $Configuration -NoBuild
    if (-not $SkipBootstrap) {
        $connection=New-Object System.Data.SqlClient.SqlConnection $ConnectionString
        try {
            $connection.Open(); $cmd=$connection.CreateCommand()
            $cmd.CommandText="SELECT COUNT_BIG(*) FROM dbo.users WHERE role='admin' AND is_provisioned=1"
            $hadAdmin=[long]$cmd.ExecuteScalar() -gt 0; $cmd.Dispose()
        } finally { $connection.Dispose() }
        $saved=@{}
        foreach ($name in @('DOTNET_ENVIRONMENT','Bootstrap__Username','Bootstrap__Email','Bootstrap__Password')) { $saved[$name]=[Environment]::GetEnvironmentVariable($name,'Process') }
        try {
            $env:DOTNET_ENVIRONMENT='Development'; $env:Bootstrap__Username=$state.AdminUsername
            $env:Bootstrap__Email=$state.AdminEmail; $env:Bootstrap__Password=$state.AdminPassword
            dotnet run --project Backend.csproj -c $Configuration --no-build --no-launch-profile -- --BootstrapOnly=true --OpenBrowser=false
            if ($LASTEXITCODE -ne 0) { throw 'Administrator initialization failed.' }
        } finally { foreach ($name in $saved.Keys) { [Environment]::SetEnvironmentVariable($name,$saved[$name],'Process') } }
        if (-not $hadAdmin) {
            @('Initial administrator credentials (existing account passwords are never reset by this script)',('Username: '+$state.AdminUsername),('Email: '+$state.AdminEmail),('Password: '+$state.AdminPassword)) |
                Set-Content -LiteralPath (Join-Path $stateDirectory 'admin-credentials.txt') -Encoding UTF8
        } else { Write-Output 'Use the existing administrator password; credential files are not overwritten.' }
    }
    Write-Output 'Setup complete. In backend run: dotnet run. Swagger: http://localhost:5100/swagger. Credentials: backend/.local/admin-credentials.txt'
} finally { Pop-Location }
