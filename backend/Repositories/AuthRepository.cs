using Microsoft.EntityFrameworkCore;
using Vnc.HRMS.Common.Utils;
using Vnc.HRMS.DTOs.Auth;
using Vnc.HRMS.Models.Auth;
using Vnc.HRMS.Persistence;
using Vnc.HRMS.Repositories.Interfaces;

namespace Vnc.HRMS.Repositories;

public sealed class AuthRepository(AppDbContext db) : IAuthRepository
{
    public Task<Credential?> FindCredentialAsync(Guid userId, CancellationToken ct) => db.Credentials.SingleOrDefaultAsync(x => x.UserId == userId, ct);
    public void AddCredential(Credential credential) => db.Credentials.Add(credential);
    public async Task RecordFailedLoginAsync(Guid userId, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        await db.Credentials.Where(x => x.UserId == userId).ExecuteUpdateAsync(set => set
            .SetProperty(x => x.FailedLoginCount, x => x.LockedUntil != null && x.LockedUntil <= now ? 1 : x.FailedLoginCount + 1)
            .SetProperty(x => x.LockedUntil, x => (x.LockedUntil == null || x.LockedUntil > now) && x.FailedLoginCount + 1 >= 5 ? now.AddMinutes(15) : (DateTime?)null)
            .SetProperty(x => x.UpdatedAt, now), ct);
    }
    public Task<RefreshToken?> FindRefreshTokenAsync(string hash, CancellationToken ct) => db.RefreshTokens.AsNoTracking().SingleOrDefaultAsync(x => x.TokenHash == hash, ct);
    public async Task<bool> ConsumeRefreshTokenAsync(Guid id, CancellationToken ct) => await db.RefreshTokens
        .Where(x => x.TokenId == id && !x.Revoked && x.ExpiresAt > DateTime.UtcNow)
        .ExecuteUpdateAsync(set => set.SetProperty(x => x.Revoked, true).SetProperty(x => x.RevokedAt, DateTime.UtcNow), ct) == 1;
    public async Task SaveSessionAsync(RefreshToken session, Credential credential, CancellationToken ct)
    {
        db.RefreshTokens.Add(session);
        db.Entry(credential).Property(x => x.UpdatedAt).IsModified = true;
        await db.SaveChangesAsync(ct);
    }
    public Task<SessionIdentityDto?> InspectSessionAsync(Guid id, CancellationToken ct) => (from session in db.RefreshTokens.AsNoTracking()
        join user in db.Users.AsNoTracking() on session.UserId equals user.UserId
        where session.TokenId == id && !session.Revoked && session.ExpiresAt > DateTime.UtcNow
            && user.AccountStatus == "active" && user.IsProvisioned && user.SecurityVersion == session.AccountVersion
        select new SessionIdentityDto(user.UserId, user.Role, user.FullName ?? user.Username)).SingleOrDefaultAsync(ct);
    public async Task RevokeSessionsAsync(Guid userId, CancellationToken ct) => await db.RefreshTokens.Where(x => x.UserId == userId && !x.Revoked)
        .ExecuteUpdateAsync(set => set.SetProperty(x => x.Revoked, true).SetProperty(x => x.RevokedAt, DateTime.UtcNow), ct);
    public async Task RevokeSessionAsync(Guid? id, string? hash, CancellationToken ct) => await db.RefreshTokens.Where(x => x.TokenId == id || x.TokenHash == hash)
        .ExecuteUpdateAsync(set => set.SetProperty(x => x.Revoked, true).SetProperty(x => x.RevokedAt, DateTime.UtcNow), ct);
    public async Task InvalidateOtpsAsync(Guid userId, CancellationToken ct) => await db.PasswordResetTokens.Where(x => x.UserId == userId && x.UsedAt == null)
        .ExecuteUpdateAsync(set => set.SetProperty(x => x.UsedAt, DateTime.UtcNow), ct);

    public async Task<bool> CreateRecoveryAsync(PasswordResetToken token, CancellationToken ct)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        // The same credential-first lock order is used by reset and resend.
        var credential = await db.Credentials.FromSqlInterpolated($"SELECT * FROM [auth].[credentials] WITH (UPDLOCK, HOLDLOCK) WHERE [user_id] = {token.UserId}")
            .AsNoTracking().SingleOrDefaultAsync(ct);
        if (credential is null) return false;
        token.PasswordStamp = PasswordHelper.Hash(credential.PasswordHash);
        await db.PasswordResetTokens.Where(x => x.UserId == token.UserId && x.ExpiresAt <= DateTime.UtcNow).ExecuteDeleteAsync(ct);
        await InvalidateOtpsAsync(token.UserId, ct);
        db.PasswordResetTokens.Add(token);
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return true;
    }
    public async Task DeleteRecoveryAsync(Guid id, CancellationToken ct) => await db.PasswordResetTokens.Where(x => x.Id == id).ExecuteDeleteAsync(ct);

    public async Task<PasswordResetToken?> ReserveOtpAttemptAsync(Guid id, CancellationToken ct)
    {
        var token = await db.PasswordResetTokens.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id && x.UsedAt == null && x.ExpiresAt > DateTime.UtcNow
            && x.CodeLength >= 6 && x.CodeLength <= 8 && x.Attempts < x.MaxAttempts, ct);
        if (token is null) return null;
        var updated = await db.PasswordResetTokens.Where(x => x.Id == id && x.UsedAt == null && x.ExpiresAt > DateTime.UtcNow && x.Attempts < x.MaxAttempts)
            .ExecuteUpdateAsync(set => set.SetProperty(x => x.Attempts, x => x.Attempts + 1), ct);
        return updated == 1 ? token : null;
    }

    public async Task<bool> ResetPasswordAsync(PasswordResetToken token, string originalHash, string newHash, CancellationToken ct)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        var updated = await db.Credentials.Where(x => x.UserId == token.UserId && x.PasswordHash == originalHash).ExecuteUpdateAsync(set => set
            .SetProperty(x => x.PasswordHash, newHash).SetProperty(x => x.FailedLoginCount, 0)
            .SetProperty(x => x.LockedUntil, (DateTime?)null).SetProperty(x => x.UpdatedAt, DateTime.UtcNow), ct);
        if (updated != 1) return false;
        var consumed = await db.PasswordResetTokens.Where(x => x.Id == token.Id && x.UsedAt == null && x.ExpiresAt > DateTime.UtcNow && x.Attempts <= x.MaxAttempts)
            .ExecuteUpdateAsync(set => set.SetProperty(x => x.UsedAt, DateTime.UtcNow), ct);
        if (consumed != 1) return false;
        await InvalidateOtpsAsync(token.UserId, ct);
        await RevokeSessionsAsync(token.UserId, ct);
        await transaction.CommitAsync(ct);
        return true;
    }
}
