using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Vnc.HRMS.Integrations;
using Vnc.HRMS.Integrations.Interfaces;
using Vnc.HRMS.Models.Auth;
using Vnc.HRMS.Persistence;
using Vnc.HRMS.Repositories;
using Vnc.HRMS.Repositories.Interfaces;

namespace Vnc.HRMS.Configurations;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddDbContext<AppDbContext>(options => options.UseSqlServer(configuration.GetConnectionString("DefaultConnection")));
        services.AddScoped<IUnitOfWork, UnitOfWork>();
        services.AddScoped<IPasswordHasher<Credential>, PasswordHasher<Credential>>();
        services.Configure<PasswordHasherOptions>(options => options.IterationCount = 210_000);
        services.AddOptions<OtpOptions>().Bind(configuration.GetSection("Otp")).ValidateDataAnnotations().ValidateOnStart();
        services.Configure<SmtpSettings>(configuration.GetSection("Smtp"));
        services.AddSingleton<IEmailService, SmtpEmailService>();
        services.Configure<CloudinaryOptions>(configuration.GetSection("Cloudinary"));
        services.AddHttpClient<ICloudinaryService, CloudinaryService>(client => client.Timeout = TimeSpan.FromSeconds(30));
        // Register each module's repositories and services when that feature is introduced.
        return services;
    }
}
