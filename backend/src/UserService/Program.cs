using Vnc.HRMS.UserService.Data;
using Vnc.HRMS.Common.Security;
var builder=WebApplication.CreateBuilder(args); builder.Services.AddServiceDatabase(builder.Configuration); builder.Services.AddJwtBearerAuthentication(builder.Configuration); var app=builder.Build(); app.UseAuthentication(); app.UseAuthorization();
app.MapGet("/health",()=>Results.Ok(new {service="users",status="ok"}));
app.MapGet("/api/users",()=>Results.StatusCode(StatusCodes.Status501NotImplemented)).RequireAuthorization(); app.Run();
