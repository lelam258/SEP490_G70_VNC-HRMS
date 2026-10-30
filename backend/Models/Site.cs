namespace Vnc.HRMS.Models;

public sealed class Site
{
    public Guid SiteId { get; set; }
    public string SiteCode { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Address { get; set; }
    public string Status { get; set; } = "active";
}

