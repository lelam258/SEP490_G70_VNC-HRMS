using Microsoft.AspNetCore.Http;
using Vnc.HRMS.DTOs.SelfService;

namespace Vnc.HRMS.Services.Interfaces;

public interface ISelfServiceProfileService
{
    Task<UserProfileDto> GetProfileAsync(Guid userId, CancellationToken ct);
    Task<UserProfileDto> UpdateProfileAsync(Guid userId, UpdateProfileRequest request, CancellationToken ct);
    Task<UserProfileDto> UploadAvatarAsync(Guid userId, IFormFile file, CancellationToken ct);
}
