using System.Globalization;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Options;
using Vnc.HRMS.Common.Exceptions;
using Vnc.HRMS.Configurations;
using Vnc.HRMS.DTOs.Files;
using Vnc.HRMS.Integrations.Interfaces;

namespace Vnc.HRMS.Integrations;

public sealed class CloudinaryService(HttpClient client, IOptionsMonitor<CloudinaryOptions> options) : ICloudinaryService
{
    public async Task<UploadFileResponse> UploadAsync(Stream file, string fileName, string contentType, CancellationToken ct)
    {
        var settings = options.CurrentValue;
        if (!Regex.IsMatch(settings.CloudName, "^[a-zA-Z0-9_-]+$") || string.IsNullOrWhiteSpace(settings.ApiKey) || string.IsNullOrWhiteSpace(settings.ApiSecret))
            throw new AppException(503, "Chức năng lưu trữ tệp chưa được cấu hình Cloudinary.");
        var timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString(CultureInfo.InvariantCulture);
        // Signed Upload API: alphabetically sorted parameters, followed by the API secret.
        // Authenticated delivery keeps personnel documents out of public CDN URLs.
        var toSign = $"folder={settings.Folder}&timestamp={timestamp}&type=authenticated";
        var signature = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(toSign + settings.ApiSecret))).ToLowerInvariant();
        using var body = new MultipartFormDataContent();
        body.Add(new StringContent(settings.ApiKey), "api_key");
        body.Add(new StringContent(timestamp), "timestamp");
        body.Add(new StringContent(settings.Folder), "folder");
        body.Add(new StringContent("authenticated"), "type");
        body.Add(new StringContent(signature), "signature");
        var content = new StreamContent(file);
        content.Headers.ContentType = new MediaTypeHeaderValue(contentType);
        body.Add(content, "file", Path.GetFileName(fileName));
        using var response = await client.PostAsync($"https://api.cloudinary.com/v1_1/{settings.CloudName}/auto/upload", body, ct);
        if (!response.IsSuccessStatusCode) throw new AppException(502, "Chưa tải được tệp lên Cloudinary. Vui lòng kiểm tra cấu hình hoặc thử lại.");
        using var document = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync(ct), cancellationToken: ct);
        var result = document.RootElement;
        return new(result.GetProperty("public_id").GetString()!, result.GetProperty("secure_url").GetString()!,
            result.GetProperty("resource_type").GetString()!, result.GetProperty("bytes").GetInt64());
    }
}
