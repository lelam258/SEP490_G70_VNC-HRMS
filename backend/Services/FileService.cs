using Vnc.HRMS.Common.Exceptions;
using Vnc.HRMS.DTOs.Files;
using Vnc.HRMS.Integrations.Interfaces;
using Vnc.HRMS.Services.Interfaces;

namespace Vnc.HRMS.Services;

public sealed class FileService(ICloudinaryService cloudinary, IWebHostEnvironment env) : IFileService
{
    public async Task<UploadFileResponse> UploadAsync(Stream stream, string fileName, string contentType, long length, CancellationToken ct)
    {
        if (length is <= 0 or > 10 * 1024 * 1024) throw new AppException(400, "Tệp phải có dung lượng từ 1 byte đến 10 MB.");
        var extension = Path.GetExtension(fileName).ToLowerInvariant();
        var allowed = (extension is ".jpg" or ".jpeg" && contentType == "image/jpeg") || (extension == ".png" && contentType == "image/png")
            || (extension == ".pdf" && contentType == "application/pdf");
        if (!allowed) throw new AppException(400, "Chỉ hỗ trợ ảnh JPG, PNG và tài liệu PDF.");
        // Verify file signatures rather than trusting the browser's content type alone.
        var header = new byte[8];
        var count = await stream.ReadAtLeastAsync(header, 8, throwOnEndOfStream: false, cancellationToken: ct);
        var valid = contentType switch
        {
            "image/jpeg" => count >= 3 && header[0] == 0xff && header[1] == 0xd8 && header[2] == 0xff,
            "image/png" => count == 8 && header.SequenceEqual(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 }),
            "application/pdf" => count >= 5 && System.Text.Encoding.ASCII.GetString(header, 0, 5) == "%PDF-",
            _ => false
        };
        if (!valid) throw new AppException(400, "Nội dung tệp không khớp định dạng đã chọn.");
        // IFormFile streams are seekable; do not send a file with its header removed.
        if (!stream.CanSeek) throw new AppException(400, "Không đọc được tệp tải lên.");
        stream.Position = 0;

        try
        {
            return await cloudinary.UploadAsync(stream, fileName, contentType, ct);
        }
        catch (AppException ex) when (ex.StatusCode == 503)
        {
            // Local storage fallback when Cloudinary credentials are not configured
            stream.Position = 0;
            var uploadsDir = Path.Combine(env.ContentRootPath, ".local", "uploads");
            Directory.CreateDirectory(uploadsDir);

            var safeBaseName = Path.GetFileNameWithoutExtension(fileName);
            safeBaseName = string.Concat(safeBaseName.Where(ch => char.IsLetterOrDigit(ch) || ch is '-' or '_'));
            if (string.IsNullOrWhiteSpace(safeBaseName)) safeBaseName = "proof";
            if (safeBaseName.Length > 40) safeBaseName = safeBaseName[..40];

            var storedFileName = $"{DateTime.UtcNow:yyyyMMddHHmmss}_{Guid.NewGuid():N}_{safeBaseName}{extension}";
            var fullPath = Path.Combine(uploadsDir, storedFileName);

            await using (var fileStream = new FileStream(fullPath, FileMode.Create, FileAccess.Write, FileShare.None))
            {
                await stream.CopyToAsync(fileStream, ct);
            }

            var resourceType = extension == ".pdf" ? "raw" : "image";
            return new UploadFileResponse(storedFileName, $"/api/files/{storedFileName}", resourceType, length);
        }
    }
}
