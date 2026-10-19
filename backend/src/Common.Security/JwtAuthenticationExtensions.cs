using System.Text;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
namespace Vnc.HRMS.Common.Security;
public static class JwtAuthenticationExtensions {
 public static IServiceCollection AddJwtBearerAuthentication(this IServiceCollection services, IConfiguration configuration) {
  var jwt = configuration.GetSection(JwtOptions.SectionName).Get<JwtOptions>() ?? throw new InvalidOperationException("Missing Jwt configuration section.");
  if (string.IsNullOrWhiteSpace(jwt.Issuer) || string.IsNullOrWhiteSpace(jwt.Audience)) throw new InvalidOperationException("Jwt:Issuer and Jwt:Audience must be configured.");
  if (Encoding.UTF8.GetByteCount(jwt.SigningKey) < 32) throw new InvalidOperationException("Set Jwt:SigningKey via secret configuration (minimum 32 bytes).");
  services.Configure<JwtOptions>(configuration.GetSection(JwtOptions.SectionName));
  services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(options => options.TokenValidationParameters = new TokenValidationParameters { ValidateIssuer=true, ValidIssuer=jwt.Issuer, ValidateAudience=true, ValidAudience=jwt.Audience, ValidateIssuerSigningKey=true, IssuerSigningKey=new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.SigningKey)), ValidateLifetime=true, ClockSkew=TimeSpan.FromSeconds(30) });
  services.AddAuthorization(); return services;
 }
}
