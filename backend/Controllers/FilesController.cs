using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Vnc.HRMS.DTOs.Files;
using Vnc.HRMS.Security;
using Vnc.HRMS.Services.Interfaces;

namespace Vnc.HRMS.Controllers;

[ApiController, Authorize(Roles = $"{AccountRoles.Administrator},{AccountRoles.HrManager}"), Route("api/files")]
public sealed class FilesController(IFileService files, IWebHostEnvironment env) : ControllerBase
{
    [HttpPost, RequestSizeLimit(11 * 1024 * 1024)]
    public async Task<ActionResult<UploadFileResponse>> Upload(IFormFile file, CancellationToken ct)
    {
        await using var stream = file.OpenReadStream();
        return Ok(await files.UploadAsync(stream, file.FileName, file.ContentType, file.Length, ct));
    }

    [HttpGet("{fileName}"), AllowAnonymous]
    public IActionResult GetLocalFile(string fileName)
    {
        var cleanName = Path.GetFileName(fileName);
        if (string.IsNullOrWhiteSpace(cleanName) || cleanName != fileName)
            return NotFound();

        var fullPath = Path.Combine(env.ContentRootPath, ".local", "uploads", cleanName);
        if (!System.IO.File.Exists(fullPath))
            return NotFound();

        var ext = Path.GetExtension(cleanName).ToLowerInvariant();
        var contentType = ext switch
        {
            ".pdf" => "application/pdf",
            ".png" => "image/png",
            ".jpg" or ".jpeg" => "image/jpeg",
            _ => "application/octet-stream"
        };

        return PhysicalFile(fullPath, contentType);
    }
}
