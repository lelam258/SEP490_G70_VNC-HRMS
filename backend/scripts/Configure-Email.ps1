# Run on Windows with powershell.exe -NoProfile -STA -ExecutionPolicy Bypass -File scripts/Configure-Email.ps1
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()
$backendRoot = Split-Path -Parent $PSScriptRoot
$apiProject = Join-Path $backendRoot 'Backend.csproj'
$statePath = Join-Path $backendRoot '.local\secrets.json'
$resultPath = Join-Path $backendRoot '.local\email-setup-result.json'
New-Item -ItemType Directory -Path (Split-Path -Parent $resultPath) -Force | Out-Null
@{ Status = 'waiting_for_input'; SmtpSaved = $false; AdminEmailUpdated = $false } | ConvertTo-Json | Set-Content -LiteralPath $resultPath -Encoding UTF8

function Save-SmtpSettings([string]$address, [string]$appPassword) {
    $payload = @{
        'Smtp:Host' = 'smtp.gmail.com'; 'Smtp:Port' = '587'; 'Smtp:UseStartTls' = 'true'
        'Smtp:Username' = $address; 'Smtp:Password' = $appPassword
        'Smtp:FromEmail' = $address; 'Smtp:FromName' = 'VNC HRMS'
    } | ConvertTo-Json
    $start = New-Object System.Diagnostics.ProcessStartInfo
    $start.FileName = 'dotnet'
    $start.Arguments = 'user-secrets set --project "' + $apiProject + '"'
    $start.WorkingDirectory = $backendRoot
    $start.UseShellExecute = $false
    $start.CreateNoWindow = $true
    $start.RedirectStandardInput = $true
    $start.RedirectStandardOutput = $true
    $start.RedirectStandardError = $true
    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $start
    try {
        [void]$process.Start()
        $outputTask = $process.StandardOutput.ReadToEndAsync()
        $errorTask = $process.StandardError.ReadToEndAsync()
        # Pass credentials through stdin, never through command arguments or logs.
        $process.StandardInput.WriteLine($payload)
        $process.StandardInput.Close()
        if (!$process.WaitForExit(20000)) { $process.Kill(); throw 'Không lưu được cấu hình trong thời gian cho phép.' }
        [void]$outputTask.GetAwaiter().GetResult()
        [void]$errorTask.GetAwaiter().GetResult()
        if ($process.ExitCode -ne 0) { throw 'Không lưu được User Secrets. Kiểm tra .NET SDK và Backend.csproj.' }
    } finally { $payload = $null; $process.Dispose() }
}

function Update-AdminEmail([string]$address) {
    if (!(Test-Path -LiteralPath $statePath)) { throw 'Không tìm thấy thông tin admin ban đầu.' }
    $settings = Get-Content -LiteralPath $statePath -Raw -Encoding UTF8 | ConvertFrom-Json
    $session = $null
    try {
        $loginBody = @{ login = $settings.AdminUsername; password = $settings.AdminPassword } | ConvertTo-Json
        $session = Invoke-RestMethod 'http://localhost:5100/api/auth/login' -Method Post -ContentType 'application/json' -Body ([Text.Encoding]::UTF8.GetBytes($loginBody)) -TimeoutSec 10
        if ($session.user.role -ne 'admin') { throw 'Cần tài khoản quản trị viên.' }
        $headers = @{ Authorization = 'Bearer ' + $session.accessToken }
        $account = Invoke-RestMethod "http://localhost:5100/api/users/$($session.user.id)" -Headers $headers -TimeoutSec 10
        if ($account.email -ne $address) {
            $body = @{
                employeeId = $account.employeeId; username = $account.username; email = $address
                fullName = $account.fullName; role = $account.role; status = $account.status; version = $account.version
            } | ConvertTo-Json
            Invoke-RestMethod "http://localhost:5100/api/users/$($session.user.id)" -Method Put -Headers $headers -ContentType 'application/json' -Body ([Text.Encoding]::UTF8.GetBytes($body)) -TimeoutSec 10 | Out-Null
        }
        $settings.AdminEmail = $address
        $settings | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $statePath -Encoding UTF8
        $credentialsPath = Join-Path $backendRoot '.local\admin-credentials.txt'
        if (Test-Path -LiteralPath $credentialsPath) {
            $lines = Get-Content -LiteralPath $credentialsPath -Encoding UTF8
            $lines | ForEach-Object { if ($_ -match '^Email:') { 'Email: ' + $address } else { $_ } } | Set-Content -LiteralPath $credentialsPath -Encoding UTF8
        }
    } finally {
        if ($null -ne $session) {
            try { Invoke-RestMethod 'http://localhost:5100/api/auth/logout' -Method Post -Headers @{ Authorization = 'Bearer ' + $session.accessToken } -ContentType 'application/json' -Body '{}' -TimeoutSec 5 | Out-Null } catch { }
        }
        $loginBody = $null
        $session = $null
    }
}

$form = New-Object System.Windows.Forms.Form
$form.Text = 'VNC HRMS - Cấu hình Gmail gửi OTP'
$form.ClientSize = New-Object System.Drawing.Size(620, 395)
$form.StartPosition = 'CenterScreen'
$form.FormBorderStyle = 'FixedDialog'
$form.MaximizeBox = $false
$form.Font = New-Object System.Drawing.Font('Segoe UI', 10)

function Add-Label([string]$text, [int]$y, [int]$height = 25) {
    $label = New-Object System.Windows.Forms.Label
    $label.Text = $text
    $label.Location = New-Object System.Drawing.Point(22, $y)
    $label.Size = New-Object System.Drawing.Size(575, $height)
    $form.Controls.Add($label)
    return $label
}
[void](Add-Label 'Thiết lập một lần để hệ thống tự gửi OTP qua Gmail.' 18)
[void](Add-Label 'Địa chỉ Gmail của bạn' 55)
$emailBox = New-Object System.Windows.Forms.TextBox
$emailBox.Location = New-Object System.Drawing.Point(22, 82)
$emailBox.Size = New-Object System.Drawing.Size(575, 28)
$form.Controls.Add($emailBox)
[void](Add-Label 'Mật khẩu ứng dụng Gmail (16 ký tự Google cấp)' 123)
$passwordBox = New-Object System.Windows.Forms.TextBox
$passwordBox.Location = New-Object System.Drawing.Point(22, 150)
$passwordBox.Size = New-Object System.Drawing.Size(575, 28)
$passwordBox.UseSystemPasswordChar = $true
$form.Controls.Add($passwordBox)
$googleLink = New-Object System.Windows.Forms.LinkLabel
$googleLink.Text = 'Mở trang tạo mật khẩu ứng dụng Gmail'
$googleLink.Location = New-Object System.Drawing.Point(22, 190)
$googleLink.Size = New-Object System.Drawing.Size(575, 26)
$googleLink.Add_LinkClicked({
    $browser = New-Object System.Diagnostics.ProcessStartInfo('https://myaccount.google.com/apppasswords')
    $browser.UseShellExecute = $true
    [void][System.Diagnostics.Process]::Start($browser)
})
$form.Controls.Add($googleLink)
[void](Add-Label 'Google yêu cầu bật Xác minh 2 bước trước khi tạo mật khẩu ứng dụng.' 220 40)
$updateAdmin = New-Object System.Windows.Forms.CheckBox
$updateAdmin.Text = 'Dùng Gmail này để nhận OTP cho tài khoản admin'
$updateAdmin.Checked = $false
$updateAdmin.Location = New-Object System.Drawing.Point(22, 266)
$updateAdmin.Size = New-Object System.Drawing.Size(575, 26)
$form.Controls.Add($updateAdmin)
$statusLabel = Add-Label '' 298 43
$statusLabel.ForeColor = [System.Drawing.Color]::Firebrick
$saveButton = New-Object System.Windows.Forms.Button
$saveButton.Text = 'Lưu cấu hình'
$saveButton.Location = New-Object System.Drawing.Point(452, 350)
$saveButton.Size = New-Object System.Drawing.Size(145, 32)
$form.Controls.Add($saveButton)
$cancelButton = New-Object System.Windows.Forms.Button
$cancelButton.Text = 'Đóng'
$cancelButton.Location = New-Object System.Drawing.Point(330, 350)
$cancelButton.Size = New-Object System.Drawing.Size(105, 32)
$cancelButton.Add_Click({ $form.Close() })
$form.Controls.Add($cancelButton)
$form.AcceptButton = $saveButton
$saveButton.Add_Click({
    $address = $emailBox.Text.Trim().ToLowerInvariant()
    try {
        $parsedAddress = New-Object System.Net.Mail.MailAddress($address)
        if ($parsedAddress.Address -ne $address) { throw 'Invalid email' }
    } catch { $statusLabel.Text = 'Bạn nhập địa chỉ Gmail đầy đủ, ví dụ ten@gmail.com.'; return }
    $appPassword = $passwordBox.Text.Replace(' ', '').Trim()
    if ($appPassword.Length -ne 16) { $statusLabel.Text = 'Dán mật khẩu ứng dụng 16 ký tự Google cấp vào ô thứ hai.'; return }
    $saveButton.Enabled = $false
    $cancelButton.Enabled = $false
    $statusLabel.Text = 'Đang lưu cấu hình riêng và cập nhật email admin…'
    $form.Refresh()
    try {
        Save-SmtpSettings $address $appPassword
        $adminUpdated = $false
        if ($updateAdmin.Checked) {
            try { Update-AdminEmail $address; $adminUpdated = $true }
            catch { $adminUpdated = $false }
        }
        @{ Status = 'saved'; SmtpSaved = $true; Email = $address; AdminEmailUpdated = $adminUpdated; AdminEmailRequested = $updateAdmin.Checked } |
            ConvertTo-Json | Set-Content -LiteralPath $resultPath -Encoding UTF8
        $passwordBox.Clear()
        [void][System.Windows.Forms.MessageBox]::Show('Đã lưu Gmail gửi OTP. Quay lại cuộc trò chuyện để hoàn tất áp dụng cấu hình.', 'VNC HRMS', 'OK', 'Information')
        $form.Close()
    } catch {
        $statusLabel.Text = 'Chưa lưu được cấu hình. Kiểm tra .NET SDK rồi thử lại.'
        $saveButton.Enabled = $true
        $cancelButton.Enabled = $true
    } finally { $appPassword = $null }
})
try { [void]$form.ShowDialog() }
finally { $passwordBox.Clear(); $form.Dispose() }
Write-Output 'Email configuration window closed. Credentials were not printed.'
