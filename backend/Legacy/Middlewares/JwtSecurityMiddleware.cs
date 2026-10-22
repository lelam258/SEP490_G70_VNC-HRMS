using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Vnc.HRMS.Repositories.Interfaces;

namespace Vnc.HRMS.Middlewares;

// ASP.NET Core JwtBearer validates signature, issuer, audience and expiry first.
// This middleware checks the current SQL session and account permissions.
public sealed class JwtSecurityMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context, IAuthRepository auth)
    {
        if (context.User.Identity?.IsAuthenticated == true && context.GetEndpoint()?.Metadata.GetMetadata<IAuthorizeData>() is not null) {
            var validClaims = Guid.TryParse(context.User.FindFirstValue("jti"), out var sessionId)
                && Guid.TryParse(context.User.FindFirstValue("sub"), out _);
            var session = validClaims ? await auth.InspectSessionAsync(sessionId, context.RequestAborted) : null;
            if (session is null || session.UserId.ToString() != context.User.FindFirstValue("sub")) {
                context.Response.StatusCode = 401;
                await context.Response.WriteAsJsonAsync(new { message = "Phiên đăng nhập đã kết thúc hoặc tài khoản không khả dụng." });
                return;
            }
            var identity = (ClaimsIdentity)context.User.Identity;
            foreach (var claim in identity.FindAll("role").ToArray()) identity.RemoveClaim(claim);
            identity.AddClaim(new("role", session.Role));
        }
        await next(context);
    }
}
