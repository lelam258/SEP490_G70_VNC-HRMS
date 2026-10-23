using Vnc.HRMS.Repositories;
namespace Vnc.HRMS.Services;
public sealed class NotificationService(NotificationRepository repository)
{
    public Task<object> ListAsync(Guid user, int page, int size, CancellationToken ct) => repository.ListAsync(user, Math.Clamp(page, 1, 100000), Math.Clamp(size, 1, 100), ct);
    public Task<bool> ReadAsync(Guid user, Guid id, CancellationToken ct) => repository.ReadAsync(user, id, ct);
}
