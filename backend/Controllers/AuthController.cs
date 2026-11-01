using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Vnc.HRMS.DTOs.Auth;
using Vnc.HRMS.Services.Interfaces;

namespace Vnc.HRMS.Controllers;

[ApiController]
[Route("api/auth")]
public sealed class AuthController(IAuthService auth, IAccountRecoveryService recovery, IWebHostEnvironment environment, IConfiguration configuration) : ControllerBase
{
    private const string CookieName = "vnc.hrms.refresh";
    [HttpPost("login"), EnableRateLimiting("login")]
    public async Task<ActionResult<SessionResponse>> Login(LoginRequest request, CancellationToken ct)
        => CompleteLogin(await auth.LoginAsync(request, Request.Headers.UserAgent.ToString(), ct));

    [HttpPost("refresh"), EnableRateLimiting("login")]
    public async Task<ActionResult<SessionResponse>> Refresh(CancellationToken ct)
    {
        if (!AllowedCookieRequest()) return StatusCode(403, new { message = "Nguồn yêu cầu không hợp lệ." });
        try { return CompleteLogin(await auth.RefreshAsync(Request.Cookies[CookieName], Request.Headers.UserAgent.ToString(), ct)); }
        catch { DeleteCookie(); throw; }
    }

    [HttpPost("logout")]
    public async Task<IActionResult> Logout(CancellationToken ct)
    {
        if (!AllowedCookieRequest()) return StatusCode(403, new { message = "Nguồn yêu cầu không hợp lệ." });
        Guid.TryParse(User.FindFirstValue("jti"), out var sessionId);
        await auth.LogoutAsync(Request.Cookies[CookieName], sessionId == Guid.Empty ? null : sessionId, ct);
        DeleteCookie();
        return NoContent();
    }

    [Authorize, HttpGet("me")]
    public Task<CurrentUserDto> Me(CancellationToken ct) => auth.GetCurrentUserAsync(Guid.Parse(User.FindFirstValue("sub")!), ct);

    [Authorize, HttpPost("change-password")]
    public async Task<IActionResult> ChangePassword(ChangePasswordRequest request, CancellationToken ct)
    {
        await auth.ChangePasswordAsync(Guid.Parse(User.FindFirstValue("sub")!), request, ct);
        DeleteCookie(); return NoContent();
    }

    [HttpPost("forgot-password"), EnableRateLimiting("recovery")]
    public async Task<ActionResult<RecoveryChallengeResponse>> ForgotPassword(ForgotPasswordRequest request, CancellationToken ct)
        => Accepted(await recovery.ForgotAsync(request, ct));

    [HttpPost("reset-password"), EnableRateLimiting("login")]
    public async Task<IActionResult> ResetPassword(ResetPasswordRequest request, CancellationToken ct)
    {
        await recovery.ResetAsync(request, ct); DeleteCookie();
        return Ok(new { message = "Đặt lại mật khẩu thành công. Vui lòng đăng nhập bằng mật khẩu mới." });
    }

    private ActionResult<SessionResponse> CompleteLogin(AuthenticationResultDto result)
    {
        Response.Cookies.Append(CookieName, result.RefreshToken, CookieOptions(result.RefreshExpiresAt));
        return Ok(result.Session);
    }
    private CookieOptions CookieOptions(DateTime? expires = null) => new() { HttpOnly = true, Secure = !environment.IsDevelopment(), SameSite = SameSiteMode.Strict, Path = "/api/auth", Expires = expires };
    private void DeleteCookie() => Response.Cookies.Delete(CookieName, CookieOptions());
    private bool AllowedCookieRequest()
    {
        var origin = Request.Headers.Origin.ToString();
        var origins = configuration.GetSection("Cors:Origins").Get<string[]>() ?? ["http://localhost:5173"];
        return (origin.Length == 0 || origins.Contains(origin) || origin == $"{Request.Scheme}://{Request.Host}")
            && Request.ContentType?.StartsWith("application/json", StringComparison.OrdinalIgnoreCase) == true;
    }
}
