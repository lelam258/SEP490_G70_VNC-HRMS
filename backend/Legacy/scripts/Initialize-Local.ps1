param(
    [string]$ConnectionString = 'Server=localhost;Database=VNC_HRMS_Iteration1;Integrated Security=True;Encrypt=True;TrustServerCertificate=True;',
    [string]$StateDirectory = (Join-Path (Split-Path -Parent $PSScriptRoot) '.local')
)
$ErrorActionPreference = 'Stop'
$backendRoot = Split-Path -Parent $PSScriptRoot
New-Item -ItemType Directory -Path $StateDirectory -Force | Out-Null
$statePath = Join-Path $StateDirectory 'secrets.json'
if (Test-Path -LiteralPath $statePath) {
    $settings = Get-Content -LiteralPath $statePath -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($settings.ConnectionString -ne $ConnectionString) { throw 'Existing local state belongs to a different database. Use a separate StateDirectory.' }
} else {
    function New-Secret {
        $bytes = New-Object byte[] 48
        $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
        try { $rng.GetBytes($bytes); return [Convert]::ToBase64String($bytes) } finally { $rng.Dispose() }
    }
    $settings = [pscustomobject]@{ ConnectionString = $ConnectionString; JwtSigningKey = New-Secret; AdminUsername = 'admin'; AdminEmail = 'admin@vnc.local'; AdminPassword = ('Vnc@1a' + (New-Secret).Substring(0,24)) }
    $settings | ConvertTo-Json | Set-Content -LiteralPath $statePath -Encoding UTF8
    @('Initial administrator', ('Username: ' + $settings.AdminUsername), ('Email: ' + $settings.AdminEmail), ('Password: ' + $settings.AdminPassword)) |
        Set-Content -LiteralPath (Join-Path $StateDirectory 'admin-credentials.txt') -Encoding UTF8
}
Push-Location $backendRoot
$savedEnvironment = @{}
$names = 'ASPNETCORE_ENVIRONMENT','DOTNET_ENVIRONMENT','Bootstrap__Username','Bootstrap__Email','Bootstrap__Password','ConnectionStrings__DefaultConnection'
foreach ($name in $names) { $savedEnvironment[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }
try {
    dotnet tool restore
    if ($LASTEXITCODE -ne 0) { throw 'EF Core tool restore failed.' }
    # Reuse the former Auth User Secrets ID to preserve SMTP without copying credentials.
    @{ 'ConnectionStrings:DefaultConnection' = $settings.ConnectionString; 'Jwt:SigningKey' = $settings.JwtSigningKey } |
        ConvertTo-Json | dotnet user-secrets set --project Backend.csproj
    if ($LASTEXITCODE -ne 0) { throw 'User Secrets setup failed.' }
    $env:ASPNETCORE_ENVIRONMENT = 'Development'
    $env:DOTNET_ENVIRONMENT = 'Development'
    $env:ConnectionStrings__DefaultConnection = $settings.ConnectionString
    dotnet build Backend.csproj
    if ($LASTEXITCODE -ne 0) { throw 'Backend build failed.' }
    & (Join-Path $PSScriptRoot 'Update-Database.ps1') -ConnectionString $settings.ConnectionString -NoBuild
    $env:Bootstrap__Username = $settings.AdminUsername
    $env:Bootstrap__Email = $settings.AdminEmail
    $env:Bootstrap__Password = $settings.AdminPassword
    dotnet run --project Backend.csproj --no-build --no-launch-profile -- --BootstrapOnly=true --OpenBrowser=false
    if ($LASTEXITCODE -ne 0) { throw 'Administrator initialization failed.' }
    Write-Output 'Setup complete. Daily startup: cd backend, then dotnet run.'
    Write-Output 'Swagger: http://localhost:5100/swagger. Administrator details: backend/.local/admin-credentials.txt.'
} finally {
    foreach ($name in $names) { [Environment]::SetEnvironmentVariable($name, $savedEnvironment[$name], 'Process') }
    Pop-Location
}
