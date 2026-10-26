using Microsoft.EntityFrameworkCore;
using Vnc.HRMS.DTOs.Users;
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
        return db.Users.Include(x => x.Employee).AsNoTracking().SingleOrDefaultAsync(x => x.NormalizedUsername == username || x.Email == email, ct);
    }
    public Task<User?> FindAsync(Guid id, CancellationToken ct) => db.Users.Include(x => x.Employee).SingleOrDefaultAsync(x => x.UserId == id, ct);
    private IQueryable<AccountDto> Details(IQueryable<User> query) => from user in query
                                                                      select new AccountDto(user.UserId, user.Employee == null ? null : user.Employee.StaffId, user.Username, user.Email, user.FullName, user.Role,
                                                                          user.AccountStatus, user.IsProvisioned, user.CreatedAt, user.UpdatedAt,
                                                                          user.LastLogin, Convert.ToBase64String(user.Version));
    public Task<AccountDto[]> ListAsync(CancellationToken ct) => Details(db.Users.AsNoTracking().Where(x => x.IsProvisioned).OrderByDescending(x => x.CreatedAt)).ToArrayAsync(ct);
    public Task<AccountDto?> GetDetailAsync(Guid id, CancellationToken ct) => Details(db.Users.AsNoTracking().Where(x => x.UserId == id)).SingleOrDefaultAsync(ct);
    public Task<bool> HasActiveAdminAsync(Guid? exceptId, CancellationToken ct) => db.Users.AnyAsync(x => x.UserId != exceptId && x.Role == "admin" && x.AccountStatus == "active" && x.IsProvisioned, ct);
    public Task<bool> HasProvisionedAdminAsync(CancellationToken ct) => db.Users.AnyAsync(x => x.Role == "admin" && x.IsProvisioned, ct);
    public void Add(User user) => db.Users.Add(user);
    public void Remove(User user) => db.Users.Remove(user);
}
