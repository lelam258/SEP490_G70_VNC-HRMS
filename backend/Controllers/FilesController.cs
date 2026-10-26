using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Vnc.HRMS.DTOs.Files;
using Vnc.HRMS.Security;
using Vnc.HRMS.Services.Interfaces;

namespace Vnc.HRMS.Controllers;

[ApiController, Authorize(Roles = $"{AccountRoles.Administrator},{AccountRoles.HrManager}"), Route("api/files")]
public sealed class FilesController(IFileService files) : ControllerBase
{
    [HttpPost, RequestSizeLimit(11 * 1024 * 1024)]
    public async Task<ActionResult<UploadFileResponse>> Upload(IFormFile file, CancellationToken ct)
    {
        await using var stream = file.OpenReadStream();
        return Ok(await files.UploadAsync(stream, file.FileName, file.ContentType, file.Length, ct));
    }
}
