namespace Vnc.HRMS.OrganizationService.Models;

public sealed class Position
{
    public Guid PositionId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? ScopeTag { get; set; }
    public string Status { get; set; } = "active";
}

