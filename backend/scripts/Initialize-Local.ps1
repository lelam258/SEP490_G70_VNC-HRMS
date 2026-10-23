param(
    [string]$Server = 'localhost',
    [string]$DatabasePrefix = 'VNC',
    [switch]$SkipBootstrap
)
$ErrorActionPreference = 'Stop'
$backendRoot = Split-Path -Parent $PSScriptRoot
$iamProject = Join-Path $backendRoot 'Services\IAM\VNC.HRMS.IAM.API\VNC.HRMS.IAM.API.csproj'
$stateDirectory = Join-Path $backendRoot '.local'
New-Item -ItemType Directory -Path $stateDirectory -Force | Out-Null
$statePath = Join-Path $stateDirectory 'microservices-secrets.json'
function New-Secret {
    $bytes = New-Object byte[] 48
    $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($bytes); [Convert]::ToBase64String($bytes) } finally { $rng.Dispose() }
}
if (Test-Path -LiteralPath $statePath) {
    $state = Get-Content -LiteralPath $statePath -Encoding UTF8 -Raw | ConvertFrom-Json
    if ($state.Server -ne $Server -or $state.DatabasePrefix -ne $DatabasePrefix) { throw 'Local state belongs to a different SQL server/database prefix.' }
} else {
    $oldPath = Join-Path $stateDirectory 'secrets.json'
    $old = if (Test-Path -LiteralPath $oldPath) { Get-Content -LiteralPath $oldPath -Encoding UTF8 -Raw | ConvertFrom-Json } else { $null }
    $state = [pscustomobject]@{
        Server = $Server; DatabasePrefix = $DatabasePrefix
        JwtSigningKey = $(if ($old.JwtSigningKey) { $old.JwtSigningKey } else { New-Secret })
        InternalApiKey = New-Secret
        AdminUsername = $(if ($old.AdminUsername) { $old.AdminUsername } else { 'admin' })
        AdminEmail = $(if ($old.AdminEmail) { $old.AdminEmail } else { 'admin@vnc.local' })
        AdminPassword = ('Vnc@1a' + (New-Secret).Substring(0,24))
    }
    $state | ConvertTo-Json | Set-Content -LiteralPath $statePath -Encoding UTF8
    if (-not $SkipBootstrap) {
        @('Initial administrator for NEW microservice databases (imported/existing accounts retain their previous password)', ('Username: ' + $state.AdminUsername), ('Password: ' + $state.AdminPassword)) |
            Set-Content -LiteralPath (Join-Path $stateDirectory 'microservices-admin.txt') -Encoding UTF8
    }
}
$settings = @{ 'Jwt:SigningKey' = $state.JwtSigningKey; 'InternalApi:Key' = $state.InternalApiKey }
foreach ($service in @('IAM','HR','Attendance','Payroll','Compliance','Notification')) {
    $builder = New-Object System.Data.SqlClient.SqlConnectionStringBuilder
    $builder['Data Source'] = $Server
    $builder['Initial Catalog'] = "${DatabasePrefix}_${service}_DB"
    $builder['Integrated Security'] = $true
    $builder['Encrypt'] = $true
    $builder['TrustServerCertificate'] = $true
    $settings["ConnectionStrings:$service"] = $builder.ConnectionString
}
$settings | ConvertTo-Json | dotnet user-secrets set --project $iamProject
if ($LASTEXITCODE -ne 0) { throw 'Failed to save shared development settings.' }
Push-Location $backendRoot
try {
    dotnet tool restore
    if ($LASTEXITCODE -ne 0) { throw 'EF tool restore failed.' }
    dotnet build VNC.HRMS.sln -c Release
    if ($LASTEXITCODE -ne 0) { throw 'Build failed.' }
    & (Join-Path $PSScriptRoot 'Update-Database.ps1') -Server $Server -DatabasePrefix $DatabasePrefix -NoBuild
    if (-not $SkipBootstrap) {
        $saved = @{}
        foreach ($name in @('DOTNET_ENVIRONMENT','Bootstrap__Username','Bootstrap__Email','Bootstrap__Password')) { $saved[$name] = [Environment]::GetEnvironmentVariable($name,'Process') }
        try {
            $env:DOTNET_ENVIRONMENT = 'Development'
            $env:Bootstrap__Username = $state.AdminUsername
            $env:Bootstrap__Email = $state.AdminEmail
            $env:Bootstrap__Password = $state.AdminPassword
            dotnet run --project $iamProject -c Release --no-build --no-launch-profile -- --BootstrapOnly=true
            if ($LASTEXITCODE -ne 0) { throw 'Admin bootstrap failed.' }
        } finally { foreach ($name in $saved.Keys) { [Environment]::SetEnvironmentVariable($name,$saved[$name],'Process') } }
    }
    Write-Output 'Setup complete. Run backend/scripts/Start-Local.ps1. New admin credentials: backend/.local/microservices-admin.txt. Legacy database is unchanged.'
} finally { Pop-Location }
