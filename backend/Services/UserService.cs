using Vnc.HRMS.DTOs.Users;
using Vnc.HRMS.Repositories.Interfaces;
using Vnc.HRMS.Services.Interfaces;

namespace Vnc.HRMS.Services;

public sealed class UserService(IUserRepository users) : IUserService
{
    public Task<AccountDto[]> ListAsync(CancellationToken ct) => users.ListAsync(ct);
}
