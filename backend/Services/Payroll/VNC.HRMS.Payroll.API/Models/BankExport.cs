namespace Vnc.HRMS.Models;
public sealed class BankExport
{
    public Guid ExportId { get; set; }
    public string PayMonth { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
    public string? FileUrl { get; set; }
    public Guid ExportedBy { get; set; }
    public DateTime ExportedAt { get; set; }
    public string Status { get; set; } = string.Empty;
    public int RowCount { get; set; }
    public string? Notes { get; set; }
}
