param([string]$Server = 'localhost', [string]$DatabasePrefix = 'VNC', [switch]$NoBuild)
$ErrorActionPreference = 'Stop'
$backendRoot = Split-Path -Parent $PSScriptRoot
Push-Location $backendRoot
try {
    foreach ($service in @('IAM','HR','Attendance','Payroll','Compliance','Notification')) {
        $project = "Services/$service/VNC.HRMS.$service.API/VNC.HRMS.$service.API.csproj"
        $builder = New-Object System.Data.SqlClient.SqlConnectionStringBuilder
        $builder['Data Source'] = $Server
        $builder['Initial Catalog'] = "${DatabasePrefix}_${service}_DB"
        $builder['Integrated Security'] = $true; $builder['Encrypt'] = $true; $builder['TrustServerCertificate'] = $true
        $arguments = @('ef','database','update','--project',$project,'--startup-project',$project,'--configuration','Release','--connection',$builder.ConnectionString)
        if ($NoBuild) { $arguments += '--no-build' }
        & dotnet @arguments
        if ($LASTEXITCODE -ne 0) { throw "Migration failed for $service" }
    }
} finally { Pop-Location }
