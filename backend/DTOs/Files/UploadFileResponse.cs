namespace Vnc.HRMS.DTOs.Files;
public sealed record UploadFileResponse(string PublicId, string Url, string ResourceType, long Bytes);
