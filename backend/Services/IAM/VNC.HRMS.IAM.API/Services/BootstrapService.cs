using Vnc.HRMS.DTOs.Users;
using Vnc.HRMS.Repositories.Interfaces;
using Vnc.HRMS.Services.Interfaces;

namespace Vnc.HRMS.Services;

public sealed class BootstrapService(IConfiguration configuration, IUserRepository users, IUserService accounts, ILogger<BootstrapService> logger)
{
    public async Task InitializeAsync(CancellationToken ct)
    {
        if (await users.HasProvisionedAdminAsync(ct)) { logger.LogInformation("Administrator already exists; existing account is preserved."); return; }
        var username = configuration["Bootstrap:Username"] ?? throw new InvalidOperationException("Bootstrap:Username is required for first-time setup.");
        var password = configuration["Bootstrap:Password"] ?? throw new InvalidOperationException("Bootstrap:Password is required for first-time setup.");
        await accounts.CreateAsync(new SaveAccountRequest(null, username, configuration["Bootstrap:Email"], "Administrator", "admin", "active", password, null), true, ct);
        logger.LogInformation("Initial administrator created. Credentials are stored privately by Initialize-Local.ps1.");
    }
}
