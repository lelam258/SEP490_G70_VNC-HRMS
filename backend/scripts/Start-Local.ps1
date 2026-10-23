param([switch]$NoBuild)
$ErrorActionPreference = 'Stop'
$backendRoot = Split-Path -Parent $PSScriptRoot
if (-not $NoBuild) {
    Push-Location $backendRoot
    try { dotnet build VNC.HRMS.sln -c Release } finally { Pop-Location }
    if ($LASTEXITCODE -ne 0) { throw 'Build failed.' }
}
$projects = @('IAM','HR','Attendance','Payroll','Compliance','Notification') | ForEach-Object { "Services/$_/VNC.HRMS.$_.API" }
$projects += 'Gateway/VNC.HRMS.Gateway'
$processes = @()
try {
    foreach ($relative in $projects) {
        $directory = Join-Path $backendRoot $relative
        $name = Split-Path -Leaf $directory
        $project = Join-Path $directory "$name.csproj"
        # Set working directory so appsettings.json is resolved independently per service.
        $processes += Start-Process dotnet -ArgumentList @('run','--project',('"' + $project + '"'),'-c','Release','--no-build') -WorkingDirectory $directory -WindowStyle Hidden -PassThru
    }
    Write-Output 'Gateway: http://localhost:5100; service Swagger: ports 5101-5106. Ctrl+C stops all child processes.'
    while ($true) {
        Start-Sleep -Seconds 2
        foreach ($process in $processes) { if ($process.HasExited) { throw "A service stopped with exit code $($process.ExitCode). Run its project separately to inspect logs." } }
    }
} finally {
    foreach ($process in $processes) {
        if (-not $process.HasExited) { & taskkill /PID $process.Id /T /F 2>$null | Out-Null }
    }
}
