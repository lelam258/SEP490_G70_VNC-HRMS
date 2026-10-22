using System.Diagnostics;

// Local development coordinator. Each API still runs in its own process.
var backendRoot = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "../../.."));
using var shutdown = new CancellationTokenSource();
var processes = new List<Process>();
Console.CancelKeyPress += (_, e) => { e.Cancel = true; shutdown.Cancel(); };

Process Start(string label, string directory, params string[] arguments)
{
    var info = new ProcessStartInfo("dotnet")
    {
        WorkingDirectory = directory,
        UseShellExecute = false,
        CreateNoWindow = true,
        RedirectStandardOutput = true,
        RedirectStandardError = true
    };
    foreach (var argument in arguments) info.ArgumentList.Add(argument);
    if (!info.Environment.ContainsKey("DOTNET_ENVIRONMENT")) info.Environment["DOTNET_ENVIRONMENT"] = "Development";
    if (!info.Environment.ContainsKey("ASPNETCORE_ENVIRONMENT")) info.Environment["ASPNETCORE_ENVIRONMENT"] = "Development";
    var process = new Process { StartInfo = info };
    process.OutputDataReceived += (_, e) => { if (e.Data is not null) Console.WriteLine($"[{label}] {e.Data}"); };
    process.ErrorDataReceived += (_, e) => { if (e.Data is not null) Console.Error.WriteLine($"[{label}] {e.Data}"); };
    process.Start();
    processes.Add(process);
    process.BeginOutputReadLine();
    process.BeginErrorReadLine();
    return process;
}

try
{
    foreach (var port in Enumerable.Range(5100, 7))
    {
        var probe = new System.Net.Sockets.TcpListener(System.Net.IPAddress.Loopback, port);
        try { probe.Start(); }
        catch (System.Net.Sockets.SocketException)
        {
            Console.Error.WriteLine($"Port {port} is already in use. Stop the running backend before starting another instance.");
            return 1;
        }
        finally { probe.Stop(); }
    }
    if (!args.Contains("--no-build"))
    {
        var build = Start("Build", backendRoot, "build", "VNC.HRMS.sln", "-c", "Release");
        await build.WaitForExitAsync(shutdown.Token);
        if (build.ExitCode != 0) return build.ExitCode;
    }

    var services = new[] { "IAM", "HR", "Attendance", "Payroll", "Compliance", "Notification" };
    var running = new List<(string Name, Process Process)>();
    foreach (var (service, index) in services.Select((name, index) => (name, index)))
    {
        var name = $"VNC.HRMS.{service}.API";
        var directory = Path.Combine(backendRoot, "Services", service, name);
        var dll = Path.Combine(directory, "bin", "Release", "net8.0", $"{name}.dll");
        running.Add((service, Start(service, directory, dll, "--urls", $"http://localhost:{5101 + index}")));
    }
    var gatewayDirectory = Path.Combine(backendRoot, "Gateway", "VNC.HRMS.Gateway");
    running.Add(("Gateway", Start("Gateway", gatewayDirectory,
        Path.Combine(gatewayDirectory, "bin", "Release", "net8.0", "VNC.HRMS.Gateway.dll"), "--urls", "http://localhost:5100")));

    Console.WriteLine("Starting Gateway: http://localhost:5100; API documentation: http://localhost:5100/swagger");
    Console.WriteLine("Press Ctrl+C to stop all services. First-time setup: scripts/Initialize-Local.ps1 (see README for legacy data migration).");
    using (var client = new HttpClient { Timeout = TimeSpan.FromSeconds(2) })
    {
        var ready = false;
        for (var attempt = 0; attempt < 60; attempt++)
        {
            shutdown.Token.ThrowIfCancellationRequested();
            if (running.Any(x => x.Process.HasExited)) break;
            try
            {
                using var response = await client.GetAsync("http://localhost:5100/swagger/index.html", shutdown.Token);
                if (response.IsSuccessStatusCode) { ready = true; break; }
            }
            catch (HttpRequestException) { }
            catch (OperationCanceledException) when (!shutdown.IsCancellationRequested) { }
            await Task.Delay(500, shutdown.Token);
        }
        if (ready && !args.Contains("--no-browser"))
        {
            try { Process.Start(new ProcessStartInfo("http://localhost:5100/swagger") { UseShellExecute = true }); }
            catch (Exception error) when (error is System.ComponentModel.Win32Exception or InvalidOperationException)
            { Console.WriteLine($"Open http://localhost:5100/swagger to view APIs. {error.Message}"); }
        }
    }
    await Task.WhenAny(running.Select(x => x.Process.WaitForExitAsync(shutdown.Token)));
    shutdown.Token.ThrowIfCancellationRequested();
    var stopped = running.First(x => x.Process.HasExited);
    Console.Error.WriteLine($"{stopped.Name} stopped (exit {stopped.Process.ExitCode}). See its logs above.");
    return stopped.Process.ExitCode == 0 ? 1 : stopped.Process.ExitCode;
}
catch (OperationCanceledException) when (shutdown.IsCancellationRequested) { return 0; }
catch (Exception error) { Console.Error.WriteLine(error.Message); return 1; }
finally
{
    foreach (var process in processes)
    {
        try
        {
            if (!process.HasExited)
            {
                if (OperatingSystem.IsWindows())
                {
                    var stop = new ProcessStartInfo("taskkill") { UseShellExecute = false, CreateNoWindow = true, RedirectStandardOutput = true, RedirectStandardError = true };
                    foreach (var argument in new[] { "/PID", process.Id.ToString(), "/T", "/F" }) stop.ArgumentList.Add(argument);
                    using var cleanup = Process.Start(stop);
                    cleanup?.WaitForExit(3000);
                }
                else process.Kill(entireProcessTree: true);
                process.WaitForExit(3000);
            }
        }
        catch (InvalidOperationException) { }
        catch (System.ComponentModel.Win32Exception error) { Console.Error.WriteLine($"Could not stop process {process.Id}: {error.Message}"); }
        finally { process.Dispose(); }
    }
}
