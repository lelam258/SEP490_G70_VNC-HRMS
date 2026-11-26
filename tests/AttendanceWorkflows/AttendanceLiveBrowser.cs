using System.Diagnostics;
using System.Net;
using System.Net.Sockets;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Vnc.HRMS.Persistence;
using Vnc.HRMS.Services;
using Vnc.HRMS.Services.Rules;

internal static class AttendanceLiveBrowser
{
    public static async Task Run(DbContextOptions<AppDbContext> options, string apiUrl, string file, string month,
        Guid hrId, string hrToken, Guid accountantId, string accountantToken, Guid staffId, Guid facilityId,
        Action<bool, string> check, CancellationToken ct, Func<object?[][], byte[]> workbook)
    {
        var path = Path.GetFullPath(file);
        byte[] bytes;
        using (var source = File.Open(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite)) {
            using var output = new MemoryStream(); await source.CopyToAsync(output, ct); bytes = output.ToArray();
        }
        var rows = new AttendanceWorkbookParser().Parse(bytes, month);
        await using var db = new AppDbContext(options);
        if (!db.Database.GetDbConnection().Database.StartsWith("VNC_Attendance_Test_", StringComparison.Ordinal))
            throw new InvalidOperationException("Live attendance import requires the owned disposable database.");
        var used = (await db.Staff.AsNoTracking().Where(x => x.DeviceEnrollId != null).Select(x => x.DeviceEnrollId!).ToArrayAsync(ct))
            .Select(AttendanceRules.DeviceKey).ToHashSet();
        var device = rows.Select(x => x.DeviceEnrollId).First(x => x.Length > 0 && !used.Contains(AttendanceRules.DeviceKey(x)));
        var today = DateOnly.FromDateTime(DateTimeOffset.UtcNow.ToOffset(TimeSpan.FromHours(7)).DateTime);
        var demoMonth = today.ToString("yyyy-MM");
        var demoBytes = workbook([["Employee ID", "Date", "In 1", "Out 1", "In 2", "Out 2", "Hours"],
            [device, new DateOnly(today.Year, today.Month, 1).ToString("yyyy-MM-dd"), "07:00", "11:00", "13:30", "17:00", 7.5m]]);
        Directory.CreateDirectory(".local");
        var demoFile = Path.GetFullPath(Path.Combine(".local", "attendance-open-month-test-" + Guid.NewGuid().ToString("N") + ".xlsx"));
        await File.WriteAllBytesAsync(demoFile, demoBytes, ct);
        object Session(Guid id, string role, string token) => new { accessToken = token, expiresAt = DateTime.UtcNow.AddMinutes(10),
            user = new { id, username = "live." + role, name = "Live test " + role, role, email = (string?)null } };
        var listener = new TcpListener(IPAddress.Loopback, 0); listener.Start(); var port = ((IPEndPoint)listener.LocalEndpoint).Port; listener.Stop();
        var appUrl = $"http://127.0.0.1:{port}";
        var viteInfo = new ProcessStartInfo("node") { WorkingDirectory = Path.GetFullPath("frontend"), UseShellExecute = false,
            CreateNoWindow = true, WindowStyle = ProcessWindowStyle.Hidden, RedirectStandardOutput = true, RedirectStandardError = true };
        foreach (var arg in new[] { Path.GetFullPath("frontend/node_modules/vite/bin/vite.js"), "--host", "127.0.0.1", "--port", port.ToString(), "--strictPort" }) viteInfo.ArgumentList.Add(arg);
        viteInfo.Environment["API_PROXY_TARGET"] = apiUrl;
        using var vite = Process.Start(viteInfo) ?? throw new Exception("Could not start isolated Vite.");
        var logs = new System.Collections.Concurrent.ConcurrentQueue<string>();
        vite.OutputDataReceived += (_, e) => { if (e.Data != null) logs.Enqueue(e.Data); };
        vite.ErrorDataReceived += (_, e) => { if (e.Data != null) logs.Enqueue(e.Data); };
        vite.BeginOutputReadLine(); vite.BeginErrorReadLine();
        try {
            using var http = new HttpClient(); var ready = false;
            for (var attempt = 0; attempt < 120; attempt++) {
                try { using var response = await http.GetAsync(appUrl, ct); if (response.IsSuccessStatusCode) { ready = true; break; } }
                catch (HttpRequestException) { }
                if (vite.HasExited) break; await Task.Delay(100, ct);
            }
            if (!ready) throw new Exception("Isolated Vite did not start: " + string.Join(Environment.NewLine, logs.TakeLast(15)));
            var info = new ProcessStartInfo("node") { WorkingDirectory = Path.GetFullPath("."), UseShellExecute = false,
                CreateNoWindow = true, WindowStyle = ProcessWindowStyle.Hidden, RedirectStandardOutput = true, RedirectStandardError = true };
            info.ArgumentList.Add("--experimental-websocket"); info.ArgumentList.Add(Path.GetFullPath("tests/verify-attendance-live-import.mjs"));
            info.Environment["ATTENDANCE_LIVE_CONFIG"] = JsonSerializer.Serialize(new { appUrl, file = path, month,
                defaultMonth = AttendanceRules.Month(month).Start.AddMonths(1).ToString("yyyy-MM"), rows = rows.Length,
                staffId, facilityId, deviceId = device, demoFile, demoMonth,
                hrSession = Session(hrId, "hr_staff", hrToken), accountantSession = Session(accountantId, "accountant", accountantToken) });
            using var browser = Process.Start(info) ?? throw new Exception("Could not start live browser checks.");
            browser.OutputDataReceived += (_, e) => { if (e.Data != null) Console.WriteLine(e.Data); };
            browser.ErrorDataReceived += (_, e) => { if (e.Data != null) Console.WriteLine(e.Data); };
            browser.BeginOutputReadLine(); browser.BeginErrorReadLine();
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct); timeout.CancelAfter(TimeSpan.FromMinutes(4));
            try { await browser.WaitForExitAsync(timeout.Token); }
            finally { if (!browser.HasExited) { browser.Kill(true); await browser.WaitForExitAsync(ct); } }
            check(browser.ExitCode == 0, "Chrome analyzes the supplied workbook through live Vite/API/SQL without API fixtures");
            db.ChangeTracker.Clear();
            check(!await db.AttendanceImports.AnyAsync(x => x.PayMonth == month, ct),
                "Analysis and the rejected locked-month upload create no persisted import batch");
            var (start, end) = AttendanceRules.Month(month);
            check(!await db.AttendanceRecords.AnyAsync(x => x.WorkDate >= start && x.WorkDate <= end, ct),
                "Analyzing a locked month never inserts attendance records");
            check(!await db.PayrollLocks.AnyAsync(x => x.PayMonth == month, ct),
                "Attendance analysis and mapping do not create or alter the separate payroll period");
            var demoBatch = await db.AttendanceImports.AsNoTracking().SingleAsync(x => x.FileName == Path.GetFileName(demoFile), ct);
            var demoRecords = await db.AttendanceRecords.AsNoTracking().Where(x => x.ImportId == demoBatch.ImportId).ToArrayAsync(ct);
            check(demoRecords.Length == 1 && demoRecords[0].StaffId == staffId && demoRecords[0].ValidationStatus == "flagged"
                && demoRecords[0].ConfirmedAt is null && demoRecords[0].ActualHours == 7.5m && demoBatch.OriginalFile!.SequenceEqual(demoBytes),
                "A clearly synthetic open-month workbook completes real staging and unconfirmed commit without modifying payroll");
        }
        finally { if (!vite.HasExited) { vite.Kill(true); await vite.WaitForExitAsync(ct); } File.Delete(demoFile); }
    }
}
