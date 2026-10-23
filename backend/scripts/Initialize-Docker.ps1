$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Push-Location $root
try {
    docker compose build
    if ($LASTEXITCODE -ne 0) { throw 'Docker build failed.' }
    docker compose up -d --wait sqlserver
    if ($LASTEXITCODE -ne 0) { throw 'SQL Server did not become healthy.' }
    foreach ($service in @('iam','hr','attendance','payroll','compliance','notification')) {
        docker compose run --rm --no-deps $service --MigrateOnly=true
        if ($LASTEXITCODE -ne 0) { throw "Migration failed: $service" }
    }
    docker compose run --rm --no-deps iam --BootstrapOnly=true
    if ($LASTEXITCODE -ne 0) { throw 'Set BOOTSTRAP_PASSWORD in .env before initializing a fresh database.' }
    docker compose up -d
    if ($LASTEXITCODE -ne 0) { throw 'Docker startup failed.' }
} finally { Pop-Location }
