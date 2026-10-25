using Microsoft.EntityFrameworkCore;
using Vnc.HRMS.Models.Users;
using Vnc.HRMS.Persistence;
using Vnc.HRMS.Repositories.Interfaces;

namespace Vnc.HRMS.Repositories;

public sealed class UserRepository(AppDbContext db) : IUserRepository
{
    public Task<User?> FindByLoginAsync(string login, CancellationToken ct)
    {
        var username = login.Trim().ToUpperInvariant();
        var email = login.Trim().ToLowerInvariant();
        return db.Users.AsNoTracking().SingleOrDefaultAsync(x => x.NormalizedUsername == username || x.Email == email, ct);
    }
    public Task<User?> FindAsync(Guid id, CancellationToken ct) => db.Users.SingleOrDefaultAsync(x => x.UserId == id, ct);
    public Task<bool> HasProvisionedAdminAsync(CancellationToken ct) => db.Users.AnyAsync(x => x.Role == "admin" && x.IsProvisioned, ct);
    public void Add(User user) => db.Users.Add(user);
}
