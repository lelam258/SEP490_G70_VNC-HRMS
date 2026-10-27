using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Vnc.HRMS.Common.Exceptions;
using Vnc.HRMS.DTOs.SelfService;
using Vnc.HRMS.Services.Interfaces;

namespace Vnc.HRMS.Controllers;

[ApiController]
[Authorize(Policy = "SelfService")]
[Route("api/me/profile")]
public sealed class MyProfileController(ISelfServiceProfileService profileService) : ControllerBase
{
    private Guid GetCurrentUserId()
    {
        var sub = User.FindFirst("sub")?.Value ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!Guid.TryParse(sub, out var userId))
        {
            throw new AppException(401, "Chưa xác thực người dùng.");
        }
        return userId;
    }

    [HttpGet]
    public Task<UserProfileDto> GetProfile(CancellationToken ct)
        => profileService.GetProfileAsync(GetCurrentUserId(), ct);

    [HttpPut]
    public Task<UserProfileDto> UpdateProfile(UpdateProfileRequest request, CancellationToken ct)
        => profileService.UpdateProfileAsync(GetCurrentUserId(), request, ct);

    [HttpPost("avatar")]
    [RequestSizeLimit(3 * 1024 * 1024)]
    public Task<UserProfileDto> UploadAvatar(IFormFile file, CancellationToken ct)
        => profileService.UploadAvatarAsync(GetCurrentUserId(), file, ct);
}
