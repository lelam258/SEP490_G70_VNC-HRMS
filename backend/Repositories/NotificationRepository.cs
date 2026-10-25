using Microsoft.EntityFrameworkCore;
using Vnc.HRMS.Persistence;
namespace Vnc.HRMS.Repositories;
public sealed class NotificationRepository(AppDbContext db)
{
    public async Task<object> ListAsync(Guid user, int page, int pageSize, CancellationToken ct)
    {
        var query = db.Notifications.AsNoTracking().Where(x => x.RecipientId == user);
        return new { total = await query.CountAsync(ct), page, pageSize, items = await query.OrderByDescending(x => x.CreatedAt).ThenBy(x => x.NotificationId).Skip((page - 1) * pageSize).Take(pageSize).ToArrayAsync(ct) };
    }
    public async Task<bool> ReadAsync(Guid user, Guid id, CancellationToken ct) => await db.Notifications.Where(x => x.NotificationId == id && x.RecipientId == user).ExecuteUpdateAsync(set => set.SetProperty(x => x.IsRead, true).SetProperty(x => x.ReadAt, DateTime.UtcNow), ct) == 1;
}
