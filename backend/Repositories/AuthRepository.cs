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
}
