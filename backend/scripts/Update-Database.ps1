param([string]$ConnectionString, [string]$Configuration = 'Debug', [switch]$NoBuild)
$ErrorActionPreference = 'Stop'
$backendRoot = Split-Path -Parent $PSScriptRoot
$previousConnection = $env:ConnectionStrings__DefaultConnection
Push-Location $backendRoot
try {
    if ($ConnectionString) { $env:ConnectionStrings__DefaultConnection = $ConnectionString }
    if (!$NoBuild) {
        dotnet build Backend.csproj --configuration $Configuration
        if ($LASTEXITCODE -ne 0) { throw 'Backend build failed.' }
    }
    # Preserve the existing schema histories while using one API.
    foreach ($context in 'AuthDbContext','UserDbContext','OrganizationDbContext','EmployeeDbContext','PayrollDbContext') {
        dotnet ef database update --project Backend.csproj --startup-project Backend.csproj --context $context --configuration $Configuration --no-build
        if ($LASTEXITCODE -ne 0) { throw "Migration failed for $context. Fix the error and rerun; existing data is preserved." }
    }
} finally { $env:ConnectionStrings__DefaultConnection = $previousConnection; Pop-Location }
