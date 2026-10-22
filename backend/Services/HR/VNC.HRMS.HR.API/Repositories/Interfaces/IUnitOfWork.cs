using System.Data;

namespace Vnc.HRMS.Repositories.Interfaces;

public interface IUnitOfWork
{
    Task<int> SaveChangesAsync(CancellationToken ct);
    Task<IAppTransaction> BeginTransactionAsync(CancellationToken ct, IsolationLevel isolation = IsolationLevel.ReadCommitted);
}

public interface IAppTransaction : IAsyncDisposable
{
    Task CommitAsync(CancellationToken ct);
}
