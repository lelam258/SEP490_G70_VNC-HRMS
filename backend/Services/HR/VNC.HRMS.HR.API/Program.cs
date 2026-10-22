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
builder.Services.AddDbContext<HrDbContext>(options => options.UseSqlServer(builder.Configuration.GetConnectionString("HR")));
builder.Services.AddJwtSecurity(builder.Configuration).AddApiDocumentation();
builder.Services.AddHttpClient<ISessionInspector, SessionInspectorClient>(client => ServiceClients.Configure(client, builder.Configuration, "IAM"));
builder.Services.AddScoped<IEmployeeRepository, EmployeeRepository>();
builder.Services.AddScoped<IDepartmentRepository, DepartmentRepository>();
builder.Services.AddScoped<IEmployeeService, EmployeeService>();
builder.Services.AddScoped<IDepartmentService, DepartmentService>();
builder.Services.AddScoped<IUnitOfWork, UnitOfWork>();
builder.Services.Configure<CloudinaryOptions>(builder.Configuration.GetSection("Cloudinary"));
builder.Services.AddHttpClient<Vnc.HRMS.Integrations.Interfaces.ICloudinaryService, Vnc.HRMS.Integrations.CloudinaryService>(client => client.Timeout = TimeSpan.FromSeconds(30));
builder.Services.AddScoped<IFileService, FileService>();
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
    await scope.ServiceProvider.GetRequiredService<HrDbContext>().Database.MigrateAsync(); return;
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
app.MapGet("/health", () => Results.Ok(new { status = "ok", service = "HR" }));
app.MapGet("/health/ready", async (HrDbContext db, CancellationToken ct) => await db.Database.CanConnectAsync(ct) ? Results.Ok(new { status = "ready" }) : Results.StatusCode(503));
await app.RunAsync();
public partial class Program { }
