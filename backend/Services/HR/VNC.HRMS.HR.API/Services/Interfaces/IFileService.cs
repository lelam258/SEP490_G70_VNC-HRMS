using Vnc.HRMS.DTOs.Files;
namespace Vnc.HRMS.Services.Interfaces;
public interface IFileService
{
    Task<UploadFileResponse> UploadAsync(Stream stream, string fileName, string contentType, long length, CancellationToken ct);
}
