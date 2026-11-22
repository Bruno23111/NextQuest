using GamesBacklog.Domain;

namespace GamesBacklog.Application;

public interface IBacklogStore
{
    Task<PagedResult<BacklogEntry>> List(Guid ownerId, BacklogQuery query, CancellationToken ct);
    Task<BacklogEntry?> Find(Guid ownerId, Guid id, CancellationToken ct);
    Task Add(BacklogEntry entry, CancellationToken ct);
    Task<bool> Save(CancellationToken ct);
    Task<bool> Delete(BacklogEntry entry, CancellationToken ct);
}
