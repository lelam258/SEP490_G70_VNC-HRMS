param(
    [Parameter(Mandatory = $true)]
    [string]$ConnectionString
)

$ErrorActionPreference = 'Stop'
$backendRoot = Split-Path -Parent $PSScriptRoot
$previousConnection = $env:ConnectionStrings__DefaultConnection
Push-Location $backendRoot
try {
    $env:ConnectionStrings__DefaultConnection = $ConnectionString
    foreach ($service in 'AuthService', 'UserService', 'OrganizationService', 'EmployeeService') {
        $project = Join-Path $backendRoot "src/$service"
        dotnet ef database update --project $project --startup-project $project
        if ($LASTEXITCODE -ne 0) {
            throw "Database migration failed for $service. Earlier services may already be migrated; fix the error and rerun."
        }
    }
}
finally {
    $env:ConnectionStrings__DefaultConnection = $previousConnection
    Pop-Location
}
