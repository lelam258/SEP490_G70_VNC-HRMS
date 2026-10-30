using System.ComponentModel.DataAnnotations;
using System.Data;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Identity;
using Vnc.HRMS.Common.Utils;
using Vnc.HRMS.Models.Auth;
using Vnc.HRMS.Models.Users;
using Vnc.HRMS.Repositories.Interfaces;
using Vnc.HRMS.Security;

namespace Vnc.HRMS.Services;

public sealed class BootstrapService(IConfiguration configuration, IUserRepository users,
    IUnitOfWork unitOfWork, IPasswordHasher<User> hasher, ILogger<BootstrapService> logger)
{
    public async Task InitializeAsync(CancellationToken ct)
    {
        // Bootstrap is an explicit setup operation; normal API startup never changes accounts.
        await using var transaction = await unitOfWork.BeginTransactionAsync(ct, IsolationLevel.Serializable);
        if (await users.HasProvisionedAdminAsync(ct))
        {
            logger.LogInformation("Administrator already exists; existing account is preserved.");
            return;
        }
        var username = configuration["Bootstrap:Username"]?.Trim() ?? throw new InvalidOperationException("Bootstrap:Username is required for first-time setup.");
        var password = configuration["Bootstrap:Password"] ?? throw new InvalidOperationException("Bootstrap:Password is required for first-time setup.");
        var email = string.IsNullOrWhiteSpace(configuration["Bootstrap:Email"]) ? null : configuration["Bootstrap:Email"]!.Trim().ToLowerInvariant();
        if (!Regex.IsMatch(username, @"^[a-zA-Z0-9._-]{3,50}$") || !PasswordHelper.IsStrong(password)
            || email is not null && (email.Length > 100 || !new EmailAddressAttribute().IsValid(email)))
            throw new InvalidOperationException("Invalid initial administrator settings. Use a valid username/email and a 6-128 character password containing an uppercase letter, a digit and a special character.");
        var user = new User
        {
            UserId = Guid.NewGuid(), Username = username, NormalizedUsername = username.ToUpperInvariant(),
            Email = email, FullName = "Administrator", Role = AccountRoles.Administrator,
            AccountStatus = "active", IsProvisioned = true
        };
        user.PasswordHash = hasher.HashPassword(user, password);
        users.Add(user);
        await unitOfWork.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        logger.LogInformation("Initial administrator created. Credentials are stored privately by Initialize-Local.ps1.");
    }
}
