using Vnc.HRMS.DTOs.Auth;

namespace Vnc.HRMS.Contracts;

public interface ISessionInspector
{
    Task<SessionIdentityDto?> InspectAsync(Guid id, CancellationToken ct);
}
