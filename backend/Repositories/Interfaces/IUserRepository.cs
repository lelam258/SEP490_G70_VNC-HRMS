using Vnc.HRMS.Models.Users;

namespace Vnc.HRMS.Repositories.Interfaces;

public interface IUserRepository
{
    Task<User?> FindByLoginAsync(string login, CancellationToken ct);
    Task<User?> FindAsync(Guid id, CancellationToken ct);
    Task<bool> HasProvisionedAdminAsync(CancellationToken ct);
    void Add(User user);
}
