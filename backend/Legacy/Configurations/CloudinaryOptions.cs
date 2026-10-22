namespace Vnc.HRMS.Configurations;
public sealed class CloudinaryOptions
{
    public string CloudName { get; init; } = string.Empty;
    public string ApiKey { get; init; } = string.Empty;
    public string ApiSecret { get; init; } = string.Empty;
    public string Folder { get; init; } = "vnc-hrms";
}
