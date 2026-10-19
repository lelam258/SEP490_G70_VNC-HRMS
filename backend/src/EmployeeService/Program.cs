using Vnc.HRMS.EmployeeService.Data;
using Vnc.HRMS.Common.Security;
var builder=WebApplication.CreateBuilder(args); builder.Services.AddServiceDatabase(builder.Configuration); builder.Services.AddJwtBearerAuthentication(builder.Configuration); var app=builder.Build(); app.UseAuthentication(); app.UseAuthorization();
app.MapGet("/health",()=>Results.Ok(new {service="employees",status="ok"}));
app.MapGet("/api/employees",()=>Results.StatusCode(StatusCodes.Status501NotImplemented)).RequireAuthorization(); app.Run();
