using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Vnc.HRMS.Contracts;
namespace Vnc.HRMS.Security;
public sealed class SessionSecurityMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context, ISessionInspector inspector)
    {
        if (context.User.Identity?.IsAuthenticated == true && context.GetEndpoint()?.Metadata.GetMetadata<IAuthorizeData>() is not null)
        {
            var session = Guid.TryParse(context.User.FindFirstValue("jti"), out var id) ? await inspector.InspectAsync(id, context.RequestAborted) : null;
            if (session is null || session.UserId.ToString() != context.User.FindFirstValue("sub"))
            {
                context.Response.StatusCode = 401;
                await context.Response.WriteAsJsonAsync(new { message = "Phiên đăng nhập đã kết thúc." }); return;
            }
            var identity = (ClaimsIdentity)context.User.Identity;
            foreach (var claim in identity.FindAll("role").ToArray()) identity.RemoveClaim(claim);
            identity.AddClaim(new("role", session.Role));
        }
        await next(context);
    }
}
