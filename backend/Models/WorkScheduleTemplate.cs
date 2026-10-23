namespace Vnc.HRMS.Models;
public sealed class WorkScheduleTemplate
{
    public Guid TemplateId { get; set; }
    public string Name { get; set; } = string.Empty;
    public TimeOnly ShiftStart { get; set; }
    public TimeOnly ShiftEnd { get; set; }
    public int? BreakMinutes { get; set; }
    public decimal? StandardHours { get; set; }
    public string? Description { get; set; }
    public string? Status { get; set; }
}
