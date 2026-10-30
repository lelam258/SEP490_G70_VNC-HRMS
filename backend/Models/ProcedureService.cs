namespace Vnc.HRMS.Models;

public sealed class ProcedureService
{
    public Guid ServiceId { get; set; }
    public string ServiceCode { get; set; } = string.Empty;
    public string ServiceName { get; set; } = string.Empty;
    public string? Category { get; set; }
    public decimal? BasePrice { get; set; }
    public string? Status { get; set; }
}
