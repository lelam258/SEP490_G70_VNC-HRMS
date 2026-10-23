using System.Security.Cryptography;
using System.Text;
namespace Vnc.HRMS.Security;
public sealed class InternalApiMiddleware(RequestDelegate next, IConfiguration configuration)
{
    public async Task InvokeAsync(HttpContext context)
    {
        if (context.Request.Path.StartsWithSegments("/internal"))
        {
            var expected = configuration["InternalApi:Key"] ?? "";
            var actual = context.Request.Headers["X-Internal-Key"].ToString();
            if (expected.Length < 32 || !CryptographicOperations.FixedTimeEquals(SHA256.HashData(Encoding.UTF8.GetBytes(expected)), SHA256.HashData(Encoding.UTF8.GetBytes(actual))))
            {
                context.Response.StatusCode = 401; return;
            }
        }
        await next(context);
    }
}
