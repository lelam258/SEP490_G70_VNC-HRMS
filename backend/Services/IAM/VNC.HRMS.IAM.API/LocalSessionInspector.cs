using Vnc.HRMS.Contracts;
using Vnc.HRMS.DTOs.Auth;
using Vnc.HRMS.Repositories.Interfaces;
namespace Vnc.HRMS;
public sealed class LocalSessionInspector(IAuthRepository auth) : ISessionInspector
{
    public Task<SessionIdentityDto?> InspectAsync(Guid id, CancellationToken ct) => auth.InspectSessionAsync(id, ct);
}
