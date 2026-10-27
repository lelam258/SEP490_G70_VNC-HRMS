using Vnc.HRMS.Models.Users;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Vnc.HRMS.Integrations;
using Vnc.HRMS.Integrations.Interfaces;
using Vnc.HRMS.Models.Auth;
using Vnc.HRMS.Persistence;
using Vnc.HRMS.Repositories;
using Vnc.HRMS.Repositories.Interfaces;
using Vnc.HRMS.Services;
using Vnc.HRMS.Services.Interfaces;

namespace Vnc.HRMS.Configurations;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddDbContext<AppDbContext>(options => options.UseSqlServer(configuration.GetConnectionString("DefaultConnection")));
        services.AddHttpContextAccessor();
        services.AddScoped<IUnitOfWork, UnitOfWork>();
        services.AddScoped<IAuditLogHelper, AuditLogHelper>();
        services.AddScoped<IAuthRepository, AuthRepository>();
        services.AddScoped<IUserRepository, UserRepository>();
        services.AddScoped<IEmployeeRepository, EmployeeRepository>();
        services.AddScoped<IDepartmentRepository, DepartmentRepository>();
        services.AddScoped<IPayrollParameterRepository, PayrollParameterRepository>();
        services.AddScoped<ICompensationRepository, CompensationRepository>();
        services.AddScoped<ISelfServiceRepository, SelfServiceRepository>();
        services.AddScoped<IPayrollPeriodRepository, PayrollPeriodRepository>();
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<IAccountRecoveryService, AccountRecoveryService>();
        services.AddScoped<IUserService, UserService>();
        services.AddScoped<IEmployeeService, EmployeeService>();
        services.AddScoped<IDepartmentService, DepartmentService>();
        services.AddScoped<IPayrollParameterService, PayrollParameterService>();
        services.AddScoped<ICompensationService, CompensationService>();
        services.AddScoped<ISelfServiceProfileService, SelfServiceProfileService>();
        services.AddScoped<ILeaveRequestService, LeaveRequestService>();
        services.AddScoped<IPayrollPeriodService, PayrollPeriodService>();
        services.AddScoped<IPasswordHasher<User>, PasswordHasher<User>>();
        services.Configure<PasswordHasherOptions>(options => options.IterationCount = 210_000);
        services.AddOptions<OtpOptions>().Bind(configuration.GetSection("Otp")).ValidateDataAnnotations().ValidateOnStart();
        services.Configure<SmtpSettings>(configuration.GetSection("Smtp"));
        services.AddSingleton<IEmailService, SmtpEmailService>();
        services.Configure<CloudinaryOptions>(configuration.GetSection("Cloudinary"));
        services.AddHttpClient<ICloudinaryService, CloudinaryService>(client => client.Timeout = TimeSpan.FromSeconds(30));
        services.AddScoped<IFileService, FileService>();
        services.AddScoped<BootstrapService>();
        services.AddScoped<Vnc.HRMS.Contracts.IEmployeeDirectory, EmployeeDirectoryRepository>();
        services.AddScoped<Vnc.HRMS.Contracts.ISessionInspector, Vnc.HRMS.Security.LocalSessionInspector>();
        services.AddScoped<AttendanceRepository>(); services.AddScoped<AttendanceService>();
        services.AddScoped<PayrollRepository>(); services.AddScoped<PayrollService>();
        services.AddScoped<ComplianceRepository>(); services.AddScoped<ComplianceService>();
        services.AddScoped<NotificationRepository>(); services.AddScoped<NotificationService>();
        return services;
    }
}
