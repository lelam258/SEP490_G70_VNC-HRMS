namespace Vnc.HRMS.Integrations.Interfaces;
public interface IEmailService
{
    bool IsConfigured { get; }
    Task SendOtpAsync(string recipient, string code, int expiresInMinutes, CancellationToken ct);
}
