using System.Diagnostics;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Vnc.HRMS.Configurations;
using Vnc.HRMS.Middlewares;
using Vnc.HRMS.Services;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddControllers().ConfigureApiBehaviorOptions(options => options.InvalidModelStateResponseFactory = context =>
    new BadRequestObjectResult(new { message = "Dữ liệu không hợp lệ. Vui lòng kiểm tra các trường bắt buộc.", errors = context.ModelState
        .Where(x => x.Value?.Errors.Count > 0).ToDictionary(x => x.Key, x => x.Value!.Errors.Select(e => e.ErrorMessage).ToArray()) }));
builder.Services.AddApplication(builder.Configuration).AddJwtSecurity(builder.Configuration).AddApiDocumentation();
builder.Services.AddCors(options => options.AddDefaultPolicy(policy => policy
    .WithOrigins(builder.Configuration.GetSection("Cors:Origins").Get<string[]>() ?? ["http://localhost:5173"])
    .AllowAnyHeader().AllowAnyMethod().AllowCredentials()));
builder.Services.AddRateLimiter(options => {
    options.RejectionStatusCode = 429;
    options.OnRejected = async (context, ct) => {
        if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retry)) context.HttpContext.Response.Headers.RetryAfter = ((int)Math.Ceiling(retry.TotalSeconds)).ToString();
        await context.HttpContext.Response.WriteAsJsonAsync(new { message = "Bạn thao tác quá nhiều lần. Vui lòng đợi rồi thử lại." }, ct);
    };
    foreach (var name in new[] { "recovery", "login" }) {
        var limit = name == "login" ? 30 : 5;
        var window = name == "login" ? TimeSpan.FromMinutes(1) : TimeSpan.FromMinutes(15);
        options.AddPolicy(name, context => RateLimitPartition.GetFixedWindowLimiter(context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions { PermitLimit = limit, Window = window, QueueLimit = 0 }));
    }
});
var app = builder.Build();
if (app.Configuration.GetValue("BootstrapOnly", false)) {
    using var scope = app.Services.CreateScope();
    await scope.ServiceProvider.GetRequiredService<BootstrapService>().InitializeAsync(CancellationToken.None);
    return;
}
app.UseMiddleware<GlobalExceptionMiddleware>();
app.UseRouting();
app.UseCors();
app.UseAuthentication();
app.UseMiddleware<Vnc.HRMS.Security.SessionSecurityMiddleware>();
app.UseAuthorization();
app.UseRateLimiter();
if (app.Environment.IsDevelopment()) {
    app.UseSwagger();
    app.UseSwaggerUI(options => options.UseRequestInterceptor("function(request) { request.credentials = 'include'; if (request.method === 'POST' && !request.body) { request.headers['Content-Type'] = 'application/json'; request.body = '{}'; } return request; }"));
    app.Lifetime.ApplicationStarted.Register(() => {
        if (!app.Configuration.GetValue("OpenBrowser", true)) return;
        try { Process.Start(new ProcessStartInfo($"{app.Urls.FirstOrDefault() ?? "http://localhost:5100"}/swagger") { UseShellExecute = true }); }
        catch (Exception error) when (error is System.ComponentModel.Win32Exception or InvalidOperationException) { app.Logger.LogInformation("Open http://localhost:5100/swagger to view the APIs."); }
    });
}
app.MapControllers();
await app.RunAsync();

public partial class Program { }
