param([string]$Server = 'localhost', [int]$BasePort = 15100, [switch]$NoBuild)
$ErrorActionPreference = 'Stop'
$backendRoot = Split-Path -Parent $PSScriptRoot
$services = @('IAM','HR','Attendance','Payroll','Compliance','Notification')
$prefix = 'VNC_ArchitectureVerify_' + [Guid]::NewGuid().ToString('N').Substring(0,8)
$logDirectory = Join-Path $backendRoot ".local/$prefix"
New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
$saved = @{}
function Set-LocalEnvironment([string]$name, [string]$value) {
    if (-not $saved.ContainsKey($name)) { $saved[$name] = [Environment]::GetEnvironmentVariable($name,'Process') }
    [Environment]::SetEnvironmentVariable($name,$value,'Process')
}
function Assert-True($condition, [string]$message) { if (-not $condition) { throw $message } }
function Request([string]$method, [string]$route, $body, [string]$token, [int]$expected, [string]$origin = '') {
    $headers = @{}
    if ($token) { $headers.Authorization = "Bearer $token" }
    if ($origin) { $headers.Origin = $origin }
    $arguments = @{ Uri = "http://localhost:$BasePort$route"; Method = $method; Headers = $headers; UseBasicParsing = $true; ContentType = 'application/json'; WebSession = $script:webSession }
    if ($null -ne $body) { $arguments.Body = $body | ConvertTo-Json -Depth 10 }
    try { $response = Invoke-WebRequest @arguments; $status = [int]$response.StatusCode }
    catch {
        if (-not $_.Exception.Response) { throw }
        $status = [int]$_.Exception.Response.StatusCode
        if ($status -ne $expected) { throw }
        return $null
    }
    Assert-True ($status -eq $expected) "$method $route expected $expected, got $status"
    if ($response.Content) { return $response.Content | ConvertFrom-Json }
}
$processes = @()
$script:webSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
try {
    if (-not $NoBuild) {
        Push-Location $backendRoot
        try { dotnet build VNC.HRMS.sln -c Release } finally { Pop-Location }
        if ($LASTEXITCODE -ne 0) { throw 'Build failed.' }
    }
    Set-LocalEnvironment 'DOTNET_ENVIRONMENT' 'Development'
    Set-LocalEnvironment 'ASPNETCORE_ENVIRONMENT' 'Development'
    Set-LocalEnvironment 'Jwt__SigningKey' ([Guid]::NewGuid().ToString('N') + [Guid]::NewGuid().ToString('N'))
    Set-LocalEnvironment 'InternalApi__Key' ([Guid]::NewGuid().ToString('N') + [Guid]::NewGuid().ToString('N'))
    Set-LocalEnvironment 'Services__IAM' "http://localhost:$($BasePort+1)"
    Set-LocalEnvironment 'Services__HR' "http://localhost:$($BasePort+2)"
    Set-LocalEnvironment 'OpenBrowser' 'false'
    Set-LocalEnvironment 'Bootstrap__Username' 'verify-admin'
    Set-LocalEnvironment 'Bootstrap__Email' 'verify-admin@vnc.test'
    $adminPassword = 'Verify@1a' + [Guid]::NewGuid().ToString('N')
    Set-LocalEnvironment 'Bootstrap__Password' $adminPassword
    foreach ($service in $services) {
        $builder = New-Object System.Data.SqlClient.SqlConnectionStringBuilder
        $builder['Data Source'] = $Server; $builder['Initial Catalog'] = "${prefix}_${service}_DB"
        $builder['Integrated Security'] = $true; $builder['Encrypt'] = $true; $builder['TrustServerCertificate'] = $true
        Set-LocalEnvironment "ConnectionStrings__$service" $builder.ConnectionString
        $offset = 1 + [Array]::IndexOf($services,$service)
        Set-LocalEnvironment "ReverseProxy__Clusters__${service}__Destinations__primary__Address" "http://localhost:$($BasePort+$offset)/"
    }
    & (Join-Path $PSScriptRoot 'Update-Database.ps1') -Server $Server -DatabasePrefix $prefix -NoBuild
    $iamDirectory = Join-Path $backendRoot 'Services/IAM/VNC.HRMS.IAM.API'
    Push-Location $iamDirectory
    try {
        dotnet run -c Release --no-build --no-launch-profile -- --BootstrapOnly=true
        if ($LASTEXITCODE -ne 0) { throw 'Test admin bootstrap failed.' }
    } finally { Pop-Location }
    $projects = $services | ForEach-Object { "Services/$_/VNC.HRMS.$_.API" }
    $projects += 'Gateway/VNC.HRMS.Gateway'
    foreach ($relative in $projects) {
        $directory = Join-Path $backendRoot $relative
        $name = Split-Path -Leaf $directory
        $offset = if ($name -eq 'VNC.HRMS.Gateway') { 0 } else { 1 + [Array]::IndexOf($projects,$relative) }
        $dll = Join-Path $directory "bin/Release/net8.0/$name.dll"
        $processes += Start-Process dotnet -ArgumentList @(('"' + $dll + '"'),'--urls',"http://localhost:$($BasePort+$offset)") -WorkingDirectory $directory -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logDirectory "$name.log") -RedirectStandardError (Join-Path $logDirectory "$name.err")
    }
    for ($attempt=0; $attempt -lt 60; $attempt++) {
        $ready = $true
        foreach ($offset in 0..6) {
            try { [void](Invoke-WebRequest "http://localhost:$($BasePort+$offset)/health" -UseBasicParsing -TimeoutSec 1) }
            catch { $ready = $false; break }
        }
        if ($ready) { break }
        Start-Sleep -Milliseconds 500
    }
    Assert-True $ready "Services failed to start. See $logDirectory"
    $swagger = Invoke-WebRequest "http://localhost:$BasePort/swagger/index.html" -UseBasicParsing
    Assert-True ($swagger.StatusCode -eq 200) 'Gateway Swagger UI is unavailable.'
    foreach ($service in $services) {
        $document = Request GET "/swagger/services/$service/swagger.json" $null '' 200
        Assert-True ($document.openapi -and $document.paths) "Swagger document missing for $service"
        Assert-True (-not ($document.paths.PSObject.Properties.Name -like '/internal/*')) "Internal routes exposed in $service documentation."
    }
    foreach ($offset in 1..6) {
        $response = Invoke-WebRequest "http://localhost:$($BasePort+$offset)/health/ready" -UseBasicParsing
        Assert-True ($response.StatusCode -eq 200) 'A service database is not ready.'
    }
    [void](Request GET '/api/employees' $null '' 401)
    [void](Request GET '/internal/employees/00000000-0000-0000-0000-000000000000' $null '' 404)
    try { Invoke-WebRequest "http://localhost:$($BasePort+2)/internal/employees/00000000-0000-0000-0000-000000000000" -UseBasicParsing | Out-Null; throw 'Internal endpoint accepted missing key.' }
    catch { Assert-True ($_.Exception.Response -and [int]$_.Exception.Response.StatusCode -eq 401) 'Internal endpoint is not protected.' }
    $login = Request POST '/api/auth/login' @{login='verify-admin';password=$adminPassword} '' 200
    $adminToken = $login.accessToken
    Assert-True ($adminToken.Length -gt 50) 'Login did not return a token.'
    [void](Request GET '/api/auth/me' $null $adminToken 200)
    [void](Request GET '/api/employees' $null $adminToken 403)
    [void](Request POST '/api/departments' @{code='DENIED';name='Denied'} $adminToken 403)
    $initialHrAccount = Request POST '/api/users' @{username='verify-hr-manager';email='verify-hr-manager@vnc.test';fullName='Verification HR Manager';role='hr_manager';status='active';password=$adminPassword} $adminToken 201
    [void](Request POST '/api/users' @{username='denied-unlinked';role='employee';status='active';password=$adminPassword} $adminToken 400)
    $hrLogin = Request POST '/api/auth/login' @{login='verify-hr-manager';password=$adminPassword} '' 200
    $hrToken = $hrLogin.accessToken
    [void](Request GET '/api/users' $null $hrToken 403)
    $department = Request POST '/api/departments' @{code='VERIFY';name='Architecture Verification'} $hrToken 201
    $employee = Request POST '/api/employees' @{code='VERIFY001';name='Verification Employee';email='verify-employee@vnc.test';departmentId=$department.id} $hrToken 201
    $options = @(Request GET '/api/users/employee-options' $null $adminToken 200)
    Assert-True ($options.Count -eq 1 -and $options[0].id -eq $employee.id) 'Administrator account employee picker is broken.'
    Assert-True (-not ($options[0].PSObject.Properties.Name -contains 'dateOfBirth')) 'Account employee picker leaked profile fields.'
    [void](Request PUT "/api/departments/$($department.id)" @{code='VERIFY';name='Updated Verification';status='inactive'} $hrToken 200)
    [void](Request POST '/api/employees' @{code='DENIED';name='Denied';departmentId=$department.id} $hrToken 400)
    [void](Request PUT "/api/departments/$($department.id)" @{code='VERIFY';name='Updated Verification';status='active'} $hrToken 200)
    $employeePassword = 'Employee@1a' + [Guid]::NewGuid().ToString('N')
    [void](Request POST '/api/auth/register' @{employeeCode='VERIFY001';email='verify-employee@vnc.test';username='verify-employee';password=$employeePassword;role='admin'} '' 201)
    [void](Request POST '/api/auth/register' @{employeeCode='VERIFY001';email='verify-employee@vnc.test';username='duplicate-employee';password=$employeePassword} '' 409)
    $employeeLogin = Request POST '/api/auth/login' @{login='verify-employee';password=$employeePassword} '' 200
    Assert-True ($employeeLogin.user.role -eq 'employee') 'Public registration allowed role escalation.'
    [void](Request GET '/api/employees' $null $employeeLogin.accessToken 403)
    [void](Request GET '/api/notifications' $null $employeeLogin.accessToken 200)
    $roleTokens = @{admin=$adminToken; hr_manager=$hrToken; employee=$employeeLogin.accessToken}
    $roleAccounts = @{}
    foreach ($role in @('hr_manager','hr_staff','accountant','department_head')) {
        $staff = Request POST '/api/employees' @{code="VR_$role";name="Verification $role";email="verify-$role@vnc.test";departmentId=$department.id} $hrToken 201
        $account = Request POST '/api/users' @{employeeId=$staff.id;username="verify-$role";email=$staff.email;fullName=$staff.name;role=$role;status='active';password=$employeePassword} $adminToken 201
        $roleAccounts[$role] = $account
        $roleLogin = Request POST '/api/auth/login' @{login="verify-$role";password=$employeePassword} '' 200
        Assert-True ($roleLogin.user.role -eq $role) "Login returned an incorrect role: $role"
        $roleTokens[$role] = $roleLogin.accessToken
        [void](Request POST '/api/auth/login' @{login=$staff.email;password=$employeePassword} '' 200)
    }
    foreach ($role in @('admin','hr_manager','hr_staff','accountant','department_head','employee')) {
        $accountStatus = if ($role -eq 'admin') { 200 } else { 403 }
        $hrStatus = if ($role -eq 'hr_manager') { 200 } else { 403 }
        [void](Request GET '/api/users' $null $roleTokens[$role] $accountStatus)
        [void](Request GET '/api/users/employee-options' $null $roleTokens[$role] $accountStatus)
        [void](Request GET '/api/employees' $null $roleTokens[$role] $hrStatus)
        [void](Request GET '/api/departments' $null $roleTokens[$role] $hrStatus)
        if ($role -ne 'hr_manager') { [void](Request POST '/api/employees' @{code='DENIED';name='Denied'} $roleTokens[$role] 403) }
        if ($role -ne 'admin') { [void](Request POST '/api/users' @{username='denied';role='admin';status='active'} $roleTokens[$role] 403) }
    }
    [void](Request POST '/api/users' @{employeeId=$employee.id;username='invalid-role';role='hr';status='active';password=$employeePassword} $adminToken 400)
    $account = $roleAccounts['hr_manager']
    $update = @{employeeId=$account.employeeId;username=$account.username;email=$account.email;fullName=$account.fullName;role='hr_staff';status='active';version=$account.version}
    $changed = Request PUT "/api/users/$($account.id)" $update $adminToken 200
    [void](Request GET '/api/employees' $null $roleTokens['hr_manager'] 401)
    $relogin = Request POST '/api/auth/login' @{login=$account.username;password=$employeePassword} '' 200
    [void](Request GET '/api/employees' $null $relogin.accessToken 403)
    $update.role='hr_manager'; $update.version=$changed.version
    [void](Request PUT "/api/users/$($account.id)" $update $adminToken 200)
    $account = $roleAccounts['accountant']
    $update = @{employeeId=$account.employeeId;username=$account.username;email=$account.email;fullName=$account.fullName;role='accountant';status='inactive';version=$account.version}
    $changed = Request PUT "/api/users/$($account.id)" $update $adminToken 200
    [void](Request GET '/api/auth/me' $null $roleTokens['accountant'] 401)
    [void](Request POST '/api/auth/login' @{login=$account.username;password=$employeePassword} '' 401)
    $update.status='active'; $update.version=$changed.version
    [void](Request PUT "/api/users/$($account.id)" $update $adminToken 200)
    $initialHrStaff = Request POST '/api/employees' @{code='VR_FIRST_HR';name='Initial HR Manager';departmentId=$department.id} $hrToken 201
    $update = @{employeeId=$initialHrStaff.id;username=$initialHrAccount.username;email=$initialHrAccount.email;fullName=$initialHrAccount.fullName;role='hr_manager';status='active';version=$initialHrAccount.version}
    [void](Request PUT "/api/users/$($initialHrAccount.id)" $update $adminToken 200)
    [void](Request GET '/api/employees' $null $hrToken 401)
    foreach ($route in @('/api/attendance/records','/api/payroll/payslips','/api/compliance/certificates')) {
        $page = Request GET $route $null $adminToken 200
        Assert-True ($page.total -eq 0 -and $page.pageSize -eq 25) "Unexpected page at $route"
    }
    # Refresh cookie path survives YARP; account session revocation propagates to HR immediately.
    [void](Request POST '/api/auth/login' @{login='verify-employee';password=$employeePassword} '' 200)
    [void](Request POST '/api/auth/refresh' @{} '' 200 "http://localhost:$BasePort")
    $script:webSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
    $secondLogin = Request POST '/api/auth/login' @{login='verify-admin';password=$adminPassword} '' 200
    [void](Request POST '/api/auth/logout' @{} '' 403 'https://untrusted.example')
    [void](Request GET '/api/users' $null $secondLogin.accessToken 200)
    [void](Request POST '/api/auth/logout' @{} '' 204 "http://localhost:$BasePort")
    [void](Request GET '/api/employees' $null $secondLogin.accessToken 401)
    [void](Request POST '/api/auth/refresh' @{} '' 401 "http://localhost:$BasePort")
    # Reconstruct a legacy-shaped fixture from this run's rows, then exercise the offline importer.
    $legacyDatabase = "${prefix}_Legacy_DB"
    $fixtureBuilder = New-Object System.Data.SqlClient.SqlConnectionStringBuilder
    $fixtureBuilder['Data Source'] = $Server; $fixtureBuilder['Initial Catalog'] = 'master'
    $fixtureBuilder['Integrated Security'] = $true; $fixtureBuilder['Encrypt'] = $true; $fixtureBuilder['TrustServerCertificate'] = $true
    $fixtureConnection = New-Object System.Data.SqlClient.SqlConnection $fixtureBuilder.ConnectionString
    try {
        $fixtureConnection.Open()
        $command = $fixtureConnection.CreateCommand(); $command.CommandText = "CREATE DATABASE [$legacyDatabase]"; [void]$command.ExecuteNonQuery()
        $fixtureConnection.ChangeDatabase($legacyDatabase)
        $command.CommandText = "EXEC('CREATE SCHEMA users'); EXEC('CREATE SCHEMA auth'); EXEC('CREATE SCHEMA organization'); EXEC('CREATE SCHEMA employees');"
        [void]$command.ExecuteNonQuery()
        foreach ($fixture in @(@('IAM','iam','users','users'),@('IAM','iam','credentials','auth'),@('HR','hr','positions','organization'),@('HR','hr','departments','organization'),@('HR','hr','staff','employees'),@('HR','hr','contracts','employees'),@('HR','hr','degrees','employees'))) {
            $owner,$schema,$table,$legacySchema = $fixture
            $command.CommandText = "SELECT * INTO [$legacySchema].[$table] FROM [${prefix}_${owner}_DB].[$schema].[$table]"
            [void]$command.ExecuteNonQuery()
        }
        $command.CommandText = "UPDATE users.users SET role='hr' WHERE username='verify-hr-manager'; SELECT COUNT(*) FROM users.users;"
        $expectedAccounts = $command.ExecuteScalar()
        foreach ($owner in @('IAM','HR')) {
            $fixtureBuilder['Initial Catalog'] = "${prefix}_Import_${owner}_DB"
            Push-Location $backendRoot
            try {
                dotnet ef database update --project "Services/$owner/VNC.HRMS.$owner.API" --startup-project "Services/$owner/VNC.HRMS.$owner.API" --configuration Release --no-build --connection $fixtureBuilder.ConnectionString
                if ($LASTEXITCODE -ne 0) { throw 'Import fixture migration failed.' }
            } finally { Pop-Location }
        }
        & (Join-Path $PSScriptRoot 'Import-LegacyData.ps1') -Server $Server -SourceDatabase $legacyDatabase -DatabasePrefix "${prefix}_Import"
        $command.CommandText = "SELECT COUNT(*) FROM [${prefix}_Import_IAM_DB].iam.users u JOIN [${prefix}_Import_HR_DB].hr.staff s ON u.employee_id=s.staff_id AND s.user_id=u.user_id WHERE u.username='verify-employee'"
        Assert-True ($command.ExecuteScalar() -eq 1) 'Imported account/staff links are inconsistent.'
        $command.CommandText = "SELECT COUNT(*) FROM [${prefix}_Import_IAM_DB].iam.credentials target JOIN [${prefix}_IAM_DB].iam.credentials original ON target.user_id=original.user_id AND target.password_hash=original.password_hash"
        Assert-True ($command.ExecuteScalar() -eq $expectedAccounts) 'Importer did not preserve password hashes.'
        $command.CommandText = "SELECT role FROM [${prefix}_Import_IAM_DB].iam.users WHERE username='verify-hr-manager'"
        Assert-True ($command.ExecuteScalar() -eq 'hr_manager') 'Importer did not normalize the legacy HR role.'
        $rejected = $false
        try { & (Join-Path $PSScriptRoot 'Import-LegacyData.ps1') -Server $Server -SourceDatabase $legacyDatabase -DatabasePrefix "${prefix}_Import" }
        catch { $rejected = $true }
        Assert-True $rejected 'Importer accepted populated destination tables.'
        $command.CommandText = "SELECT COUNT(*) FROM [${prefix}_Import_IAM_DB].iam.users"
        Assert-True ($command.ExecuteScalar() -eq $expectedAccounts) 'Rejected import changed destination rows.'
    } finally { $fixtureConnection.Dispose() }
    Write-Output 'PASS: six SQL migrations/readiness, Gateway routing, login/cookie refresh/logout, IAM-to-HR registration, duplicate prevention, role checks, internal-key protection, domain pagination, session revocation, legacy import/hash preservation and rejection of populated import destinations.'
} finally {
    foreach ($serviceProcess in $processes) { if (-not $serviceProcess.HasExited) { $serviceProcess.Kill(); $serviceProcess.WaitForExit(5000) | Out-Null }; $serviceProcess.Dispose() }
    # Delete only databases created by this invocation, identified by an unguessable test prefix.
    $cleanupBuilder = New-Object System.Data.SqlClient.SqlConnectionStringBuilder
    $cleanupBuilder['Data Source'] = $Server; $cleanupBuilder['Initial Catalog'] = 'master'
    $cleanupBuilder['Integrated Security'] = $true; $cleanupBuilder['Encrypt'] = $true; $cleanupBuilder['TrustServerCertificate'] = $true
    $cleanupConnection = New-Object System.Data.SqlClient.SqlConnection $cleanupBuilder.ConnectionString
    try {
        $cleanupConnection.Open()
        $databases = @($services | ForEach-Object { "${prefix}_${_}_DB" })
        $databases += "${prefix}_Import_IAM_DB", "${prefix}_Import_HR_DB", "${prefix}_Legacy_DB"
        foreach ($database in $databases) {
            if ($database -notmatch '^VNC_ArchitectureVerify_[0-9a-f]{8}_((IAM|HR|Attendance|Payroll|Compliance|Notification|Legacy)|Import_(IAM|HR))_DB$') { throw 'Unsafe test database cleanup target.' }
            $command = $cleanupConnection.CreateCommand()
            $command.CommandText = "IF DB_ID(N'$database') IS NOT NULL BEGIN ALTER DATABASE [$database] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [$database]; END"
            [void]$command.ExecuteNonQuery()
        }
    } finally { $cleanupConnection.Dispose(); foreach ($name in $saved.Keys) { [Environment]::SetEnvironmentVariable($name,$saved[$name],'Process') } }
}
