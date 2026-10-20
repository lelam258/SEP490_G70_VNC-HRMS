using System.Net;
using System.Net.Mail;
using System.Text;
using Microsoft.Extensions.Options;
using Vnc.HRMS.Configurations;
using Vnc.HRMS.Integrations.Interfaces;

namespace Vnc.HRMS.Integrations;

public sealed class SmtpEmailService(IOptionsMonitor<SmtpSettings> settings) : IEmailService
{
    public bool IsConfigured => !string.IsNullOrWhiteSpace(settings.CurrentValue.Host) && settings.CurrentValue.Port is > 0 and <= 65535
        && !string.IsNullOrWhiteSpace(settings.CurrentValue.Username) && !string.IsNullOrWhiteSpace(settings.CurrentValue.Password)
        && MailAddress.TryCreate(settings.CurrentValue.FromEmail, out _);

    public async Task SendOtpAsync(string recipient, string code, int expiresInMinutes, CancellationToken ct)
    {
        var smtp = settings.CurrentValue;
        using var message = new MailMessage { From = new MailAddress(smtp.FromEmail, smtp.FromName), Subject = "Mã OTP đặt lại mật khẩu VNC HRMS",
            Body = $"Mã OTP đặt lại mật khẩu của bạn là: {code}\n\nMã có hiệu lực trong {expiresInMinutes} phút và chỉ sử dụng được một lần. Không chia sẻ mã này với người khác. Nếu bạn không yêu cầu, hãy bỏ qua email này.",
            BodyEncoding = Encoding.UTF8, SubjectEncoding = Encoding.UTF8, IsBodyHtml = false };
        message.To.Add(new MailAddress(recipient));
        using var client = new SmtpClient(smtp.Host, smtp.Port) { EnableSsl = smtp.UseStartTls, UseDefaultCredentials = false, Credentials = new NetworkCredential(smtp.Username, smtp.Password) };
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
        timeout.CancelAfter(TimeSpan.FromSeconds(15));
        await client.SendMailAsync(message, timeout.Token);
    }
}
