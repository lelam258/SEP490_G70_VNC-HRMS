[CmdletBinding()]
param(
    [string]$ConnectionString = 'Server=localhost;Database=VNC_HRMS_Iteration1;Integrated Security=True;Encrypt=True;TrustServerCertificate=True;',
    [switch]$Apply,
    [string]$Password,
    [string]$OutputPath
)
$ErrorActionPreference = 'Stop'
if ($Apply -and ([string]::IsNullOrWhiteSpace($Password) -or $Password.Length -lt 6 -or $Password.Length -gt 128)) { throw 'Provide a password of 6 to 128 characters with -Apply.' }

function Get-LoginStem([string]$FullName) {
    $normalized = $FullName.Replace([char]0x0110, [char]'D').Replace([char]0x0111, [char]'d').Normalize([Text.NormalizationForm]::FormD)
    $plain = -join ($normalized.ToCharArray() | Where-Object { [Globalization.CharUnicodeInfo]::GetUnicodeCategory($_) -ne [Globalization.UnicodeCategory]::NonSpacingMark })
    $stem = [regex]::Replace($plain.ToLowerInvariant(), '[^a-z0-9]', '')
    if ($stem.Length -lt 1) { throw "Cannot generate a login for $FullName" }
    return $stem
}

function Get-IdentityHash([string]$PlainPassword) {
    # ASP.NET Core Identity V3: marker, HMACSHA512, iterations, salt length, salt, subkey.
    $salt = New-Object byte[] 16
    $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($salt) } finally { $rng.Dispose() }
    $derive = [Security.Cryptography.Rfc2898DeriveBytes]::new($PlainPassword, $salt, 210000, [Security.Cryptography.HashAlgorithmName]::SHA512)
    try { $key = $derive.GetBytes(32) } finally { $derive.Dispose() }
    $bytes = New-Object byte[] 61
    $bytes[0] = 1
    [Buffer]::BlockCopy([BitConverter]::GetBytes([Net.IPAddress]::HostToNetworkOrder([int]2)),0,$bytes,1,4)
    [Buffer]::BlockCopy([BitConverter]::GetBytes([Net.IPAddress]::HostToNetworkOrder([int]210000)),0,$bytes,5,4)
    [Buffer]::BlockCopy([BitConverter]::GetBytes([Net.IPAddress]::HostToNetworkOrder([int]16)),0,$bytes,9,4)
    [Buffer]::BlockCopy($salt,0,$bytes,13,16)
    [Buffer]::BlockCopy($key,0,$bytes,29,32)
    return [Convert]::ToBase64String($bytes)
}

$connection = [Data.SqlClient.SqlConnection]::new($ConnectionString)
$transaction = $null
try {
    $connection.Open()
    $transaction = $connection.BeginTransaction([Data.IsolationLevel]::Serializable)
    $read = $connection.CreateCommand()
    $read.Transaction = $transaction
    $read.CommandText = @'
SELECT u.user_id,u.username,u.email,u.role,s.staff_code,s.full_name,s.status AS staff_status
FROM dbo.users u WITH (UPDLOCK,HOLDLOCK)
LEFT JOIN dbo.staff s ON s.user_id=u.user_id
ORDER BY s.staff_code,u.username
'@
    $table = [Data.DataTable]::new()
    $reader = $read.ExecuteReader()
    try { $table.Load($reader) } finally { $reader.Dispose() }
    $planned = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
    $plans = @()
    foreach ($row in $table.Rows) {
        if ($row.IsNull('staff_code') -or $row.role -eq 'admin' -or $row.staff_status -ne 'active') { continue }
        $stem = Get-LoginStem $row.full_name
        $number = 0
        do {
            $suffix = if ($number -eq 0) { '' } else { [string]$number }
            $localPart = $stem.Substring(0, [Math]::Min($stem.Length, 40 - $suffix.Length)) + $suffix
            $login = $localPart + '@gmail.com'
            $collision = $planned.Contains($login)
            foreach ($other in $table.Rows) {
                if ($other.user_id -ne $row.user_id -and ($other.username -eq $login -or $other.email -eq $login)) { $collision = $true; break }
            }
            $number++
        } while ($collision)
        [void]$planned.Add($login)
        $plans += [pscustomobject]@{ UserId=$row.user_id; StaffCode=$row.staff_code; FullName=$row.full_name; Username=$login; Role=$row.role }
    }
    foreach ($plan in $plans) {
        if (-not $Apply) { continue }
        $command = $connection.CreateCommand()
        $command.Transaction = $transaction
        $command.CommandText = @'
UPDATE dbo.users SET username=@username, normalized_username=UPPER(@username),
    password_hash=@hash, is_provisioned=1, account_status=N'active',
    failed_login_count=0, locked_until=NULL, security_version=security_version+1,updated_at=SYSUTCDATETIME()
WHERE user_id=@id AND role<>N'admin';
IF @@ROWCOUNT<>1 THROW 50010,N'Target account changed during update.',1;
UPDATE dbo.refresh_tokens SET revoked=1,revoked_at=SYSUTCDATETIME() WHERE user_id=@id AND revoked=0;
UPDATE dbo.password_reset_tokens SET used_at=SYSUTCDATETIME() WHERE user_id=@id AND used_at IS NULL;
'@
        [void]$command.Parameters.Add('@username',[Data.SqlDbType]::NVarChar,50)
        $command.Parameters['@username'].Value = $plan.Username
        [void]$command.Parameters.Add('@hash',[Data.SqlDbType]::NVarChar,255)
        $command.Parameters['@hash'].Value = Get-IdentityHash $Password
        [void]$command.Parameters.Add('@id',[Data.SqlDbType]::UniqueIdentifier)
        $command.Parameters['@id'].Value = $plan.UserId
        [void]$command.ExecuteNonQuery()
    }
    if ($Apply) { $transaction.Commit() } else { $transaction.Rollback() }
    $transaction = $null
    if ($Apply -and $OutputPath) {
        $plans | Select-Object StaffCode,FullName,Username,Role | Export-Csv -LiteralPath $OutputPath -NoTypeInformation -Encoding UTF8
    }
    $plans | Select-Object StaffCode,FullName,Username,Role | Format-Table -AutoSize
    Write-Output "Accounts: $($plans.Count); Applied: $($Apply.IsPresent)"
} catch {
    if ($transaction) { $transaction.Rollback() }
    throw
} finally { $connection.Dispose() }
