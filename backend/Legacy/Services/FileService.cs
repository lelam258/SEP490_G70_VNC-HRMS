using Vnc.HRMS.Common.Exceptions;
using Vnc.HRMS.DTOs.Files;
using Vnc.HRMS.Integrations.Interfaces;
using Vnc.HRMS.Services.Interfaces;

namespace Vnc.HRMS.Services;

public sealed class FileService(ICloudinaryService cloudinary) : IFileService
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
        var valid = contentType switch {
            "image/jpeg" => count >= 3 && header[0] == 0xff && header[1] == 0xd8 && header[2] == 0xff,
            "image/png" => count == 8 && header.SequenceEqual(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 }),
            "application/pdf" => count >= 5 && System.Text.Encoding.ASCII.GetString(header, 0, 5) == "%PDF-",
            _ => false
        };
        if (!valid) throw new AppException(400, "Nội dung tệp không khớp định dạng đã chọn.");
        // IFormFile streams are seekable; do not send a file with its header removed.
        if (!stream.CanSeek) throw new AppException(400, "Không đọc được tệp tải lên.");
        stream.Position = 0;
        return await cloudinary.UploadAsync(stream, fileName, contentType, ct);
    }
}
