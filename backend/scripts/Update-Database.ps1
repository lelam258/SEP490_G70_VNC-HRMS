param([string]$Configuration = 'Debug', [switch]$NoBuild)
$ErrorActionPreference = 'Stop'
Push-Location (Split-Path -Parent $PSScriptRoot)
try {
    $arguments=@('ef','database','update','--project','Backend.csproj','--startup-project','Backend.csproj','--configuration',$Configuration)
    if ($NoBuild) { $arguments+='--no-build' }
    & dotnet @arguments
    if ($LASTEXITCODE -ne 0) { throw 'Database migration failed.' }
} finally { Pop-Location }
