namespace Vnc.HRMS.Models;
public sealed class ComplaintAttachment
{
    public Guid AttachmentId { get; set; }
    public Guid ComplaintId { get; set; }
    public string FileUrl { get; set; } = string.Empty;
    public string? FileName { get; set; }
    public Guid UploadedBy { get; set; }
    public DateTime? UploadedAt { get; set; }
}
