using Vnc.HRMS.DTOs.Users;

namespace Vnc.HRMS.Services.Interfaces;

public interface IUserService
{
    Task<AccountDto[]> ListAsync(CancellationToken ct);
    Task<AccountDto> GetAsync(Guid id, CancellationToken ct);
    Task<AccountDto> CreateAsync(SaveAccountRequest request, bool bootstrap, CancellationToken ct);
}
