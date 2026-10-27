using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;

namespace Vnc.HRMS.Configurations;

public static class AuthenticationConfiguration
{
    public static IServiceCollection AddJwtSecurity(this IServiceCollection services, IConfiguration configuration)
    {
        var jwt = configuration.GetSection("Jwt").Get<JwtOptions>() ?? throw new InvalidOperationException("Missing JWT configuration.");
        if (string.IsNullOrWhiteSpace(jwt.Issuer) || string.IsNullOrWhiteSpace(jwt.Audience) || Encoding.UTF8.GetByteCount(jwt.SigningKey) < 32)
            throw new InvalidOperationException("Set Jwt:Issuer, Jwt:Audience and a signing key of at least 32 bytes in User Secrets or environment variables.");
        services.Configure<JwtOptions>(configuration.GetSection("Jwt"));
        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(options =>
        {
            options.MapInboundClaims = false;
            options.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidIssuer = jwt.Issuer,
                ValidateAudience = true,
                ValidAudience = jwt.Audience,
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.SigningKey)),
                ValidateLifetime = true,
                ClockSkew = TimeSpan.FromSeconds(15),
                NameClaimType = "name",
                RoleClaimType = "role"
            };
        });
        services.AddAuthorization(options => {
            options.AddPolicy("Admin", policy => policy.RequireAuthenticatedUser().RequireRole(Vnc.HRMS.Security.AccountRoles.Administrator));
            options.AddPolicy("HRManager", policy => policy.RequireAuthenticatedUser().RequireRole(Vnc.HRMS.Security.AccountRoles.HrManager));
            options.AddPolicy("Accountant", policy => policy.RequireAuthenticatedUser().RequireRole(Vnc.HRMS.Security.AccountRoles.Accountant));
            options.AddPolicy("SelfService", policy => policy.RequireAuthenticatedUser());
        });
        return services;
    }
}
