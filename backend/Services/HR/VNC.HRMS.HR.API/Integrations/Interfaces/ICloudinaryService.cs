using Vnc.HRMS.DTOs.Files;
namespace Vnc.HRMS.Integrations.Interfaces;
public interface ICloudinaryService
{
    Task<UploadFileResponse> UploadAsync(Stream file, string fileName, string contentType, CancellationToken ct);
}
