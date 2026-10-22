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
using Vnc.HRMS.Repositories.Interfaces;
using Vnc.HRMS.Services;
using Vnc.HRMS.Services.Interfaces;
var builder = WebApplication.CreateBuilder(args);
builder.Services.AddControllers();
builder.Services.AddServiceTransport(builder.Configuration);
builder.Services.AddDbContext<IamDbContext>(options => options.UseSqlServer(builder.Configuration.GetConnectionString("IAM")));
builder.Services.AddJwtSecurity(builder.Configuration).AddApiDocumentation();
builder.Services.AddScoped<IAuthRepository, AuthRepository>();
builder.Services.AddScoped<IUserRepository, UserRepository>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IUserService, UserService>();
builder.Services.AddScoped<IAccountRecoveryService, AccountRecoveryService>();
builder.Services.AddScoped<IUnitOfWork, UnitOfWork>();
builder.Services.AddScoped<ISessionInspector, LocalSessionInspector>();
builder.Services.AddHttpClient<IEmployeeDirectory, EmployeeDirectoryClient>(client => ServiceClients.Configure(client, builder.Configuration, "HR"));
builder.Services.AddScoped<Microsoft.AspNetCore.Identity.IPasswordHasher<Vnc.HRMS.Models.Auth.Credential>, Microsoft.AspNetCore.Identity.PasswordHasher<Vnc.HRMS.Models.Auth.Credential>>();
builder.Services.Configure<Microsoft.AspNetCore.Identity.PasswordHasherOptions>(options => options.IterationCount = 210_000);
builder.Services.AddOptions<OtpOptions>().Bind(builder.Configuration.GetSection("Otp")).ValidateDataAnnotations().ValidateOnStart();
builder.Services.Configure<SmtpSettings>(builder.Configuration.GetSection("Smtp"));
builder.Services.AddSingleton<Vnc.HRMS.Integrations.Interfaces.IEmailService, Vnc.HRMS.Integrations.SmtpEmailService>();
builder.Services.AddScoped<BootstrapService>();
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
    await scope.ServiceProvider.GetRequiredService<IamDbContext>().Database.MigrateAsync(); return;
}
if (app.Configuration.GetValue("BootstrapOnly", false)) { using var scope = app.Services.CreateScope(); await scope.ServiceProvider.GetRequiredService<BootstrapService>().InitializeAsync(CancellationToken.None); return; }
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
app.MapGet("/health", () => Results.Ok(new { status = "ok", service = "IAM" }));
app.MapGet("/health/ready", async (IamDbContext db, CancellationToken ct) => await db.Database.CanConnectAsync(ct) ? Results.Ok(new { status = "ready" }) : Results.StatusCode(503));
await app.RunAsync();
public partial class Program { }
