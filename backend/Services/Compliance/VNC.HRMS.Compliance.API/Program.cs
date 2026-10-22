using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.RateLimiting;
using System.Threading.RateLimiting;
using Vnc.HRMS;
using Vnc.HRMS.Contracts;
using Vnc.HRMS.Configurations;
using Vnc.HRMS.Persistence;
using Vnc.HRMS.Middlewares;
using Vnc.HRMS.Security;

using Vnc.HRMS.Repositories;
using Vnc.HRMS.Services;
var builder = WebApplication.CreateBuilder(args);
builder.Services.AddControllers();
builder.Services.AddServiceTransport(builder.Configuration);
builder.Services.AddScoped<ComplianceRepository>();
builder.Services.AddScoped<ComplianceService>();
builder.Services.AddDbContext<ComplianceDbContext>(options => options.UseSqlServer(builder.Configuration.GetConnectionString("Compliance")));
builder.Services.AddJwtSecurity(builder.Configuration).AddApiDocumentation();
builder.Services.AddHttpClient<ISessionInspector, SessionInspectorClient>(client => ServiceClients.Configure(client, builder.Configuration, "IAM"));
builder.Services.AddCors(options => options.AddDefaultPolicy(policy => policy.WithOrigins(builder.Configuration.GetSection("Cors:Origins").Get<string[]>() ?? ["http://localhost:5173"]).AllowAnyHeader().AllowAnyMethod().AllowCredentials()));
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = 429;
    foreach (var name in new[] { "recovery", "registration", "login" }) options.AddPolicy(name, context => RateLimitPartition.GetFixedWindowLimiter(context.Connection.RemoteIpAddress?.ToString() ?? "unknown", _ => new FixedWindowRateLimiterOptions { PermitLimit = name == "login" ? 30 : 5, Window = name == "login" ? TimeSpan.FromMinutes(1) : TimeSpan.FromMinutes(15), QueueLimit = 0 }));
});
var app = builder.Build();
if (app.Configuration.GetValue("MigrateOnly", false))
{
    using var scope = app.Services.CreateScope();
    await scope.ServiceProvider.GetRequiredService<ComplianceDbContext>().Database.MigrateAsync(); return;
}

app.UseMiddleware<GlobalExceptionMiddleware>();
app.UseForwardedHeaders();
app.UseRouting();
app.UseCors();
app.UseMiddleware<InternalApiMiddleware>();
app.UseAuthentication();
app.UseMiddleware<SessionSecurityMiddleware>();
app.UseAuthorization();
app.UseRateLimiter();
if (app.Environment.IsDevelopment()) { app.UseSwagger(); app.UseSwaggerUI(); }
app.MapControllers();
app.MapGet("/health", () => Results.Ok(new { status = "ok", service = "Compliance" }));
app.MapGet("/health/ready", async (ComplianceDbContext db, CancellationToken ct) => await db.Database.CanConnectAsync(ct) ? Results.Ok(new { status = "ready" }) : Results.StatusCode(503));
await app.RunAsync();
public partial class Program { }
