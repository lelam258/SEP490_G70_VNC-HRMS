using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Vnc.HRMS.Common.Exceptions;

namespace Vnc.HRMS.Middlewares;

public sealed class GlobalExceptionMiddleware(RequestDelegate next, ILogger<GlobalExceptionMiddleware> logger, IWebHostEnvironment environment)
{
    public async Task InvokeAsync(HttpContext context)
    {
        context.Response.Headers["X-Content-Type-Options"] = "nosniff";
        context.Response.Headers.CacheControl = "no-store";
        try { await next(context); }
        catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested) { }
        catch (Exception error)
        {
            if (context.Response.HasStarted) throw;
            var (status, message) = error switch
            {
                AppException known => (known.StatusCode, known.Message),
                DbUpdateConcurrencyException => (409, "Dữ liệu vừa được cập nhật. Vui lòng tải lại và thử lại."),
                DbUpdateException update when update.InnerException is SqlException sql && sql.Number is 2601 or 2627
                    => (409, "Tên đăng nhập, email, mã hoặc hồ sơ liên kết đã được sử dụng."),
                SqlException => (503, "Không kết nối được cơ sở dữ liệu. Vui lòng thử lại sau."),
                _ => (500, "Không hoàn tất được yêu cầu. Vui lòng thử lại hoặc liên hệ quản trị viên.")
            };
            if (status >= 500)
            {
                if (environment.IsDevelopment()) logger.LogError(error, "Request failed; trace: {TraceId}", context.TraceIdentifier);
                else logger.LogError("Request failed: {ErrorType}; trace: {TraceId}", error.GetType().Name, context.TraceIdentifier);
            }
            context.Response.StatusCode = status;
            await context.Response.WriteAsJsonAsync(new { message, traceId = context.TraceIdentifier }, context.RequestAborted);
        }
    }
}
