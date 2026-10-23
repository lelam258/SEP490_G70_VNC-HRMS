namespace Vnc.HRMS.Models;
public sealed class AttendanceImport
{
    public Guid ImportId { get; set; }
    public string FileName { get; set; } = string.Empty;
    public string? FileUrl { get; set; }
    public Guid ImportedBy { get; set; }
    public DateTime? ImportDate { get; set; }
    public string? PayMonth { get; set; }
    public int? TotalRows { get; set; }
    public int? SuccessRows { get; set; }
    public int? ErrorRows { get; set; }
    public string? Status { get; set; }
    public string? ErrorLog { get; set; }
    public string? ColumnMapping { get; set; }
}
