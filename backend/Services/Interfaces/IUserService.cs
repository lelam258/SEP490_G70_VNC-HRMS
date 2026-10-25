using Vnc.HRMS.DTOs.Users;

namespace Vnc.HRMS.Services.Interfaces;

public interface IUserService
{
    Task<AccountDto[]> ListAsync(CancellationToken ct);
}
