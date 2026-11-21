using GamesBacklog.Application;
using GamesBacklog.Domain;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace GamesBacklog.Infrastructure.Persistence;

public sealed class BacklogStore(BacklogDbContext db) : IBacklogStore
{
    private const int PageSize = 20;

    public async Task<PagedResult<BacklogEntry>> List(Guid ownerId, BacklogQuery query, CancellationToken ct)
    {
        var rows = db.Backlog.AsNoTracking().Where(x => x.OwnerId == ownerId);
        if (!string.IsNullOrWhiteSpace(query.Q))
        {
            var search = query.Q.Trim().Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_");
            rows = rows.Where(x => EF.Functions.ILike(x.Title, "%" + search + "%", "\\"));
        }

        if (query.Status is { } status)
            rows = rows.Where(x => x.Status == status);

        var items = await rows.OrderByDescending(x => x.CreatedAt).ThenByDescending(x => x.Id)
            .Skip((query.Page - 1) * PageSize).Take(PageSize + 1).ToListAsync(ct);
        var hasMore = items.Count > PageSize;
        if (hasMore) items.RemoveAt(PageSize);
        return new(items, query.Page, PageSize, hasMore);
    }

    public Task<BacklogEntry?> Find(Guid ownerId, Guid id, CancellationToken ct) =>
        db.Backlog.SingleOrDefaultAsync(x => x.Id == id && x.OwnerId == ownerId, ct);

    public async Task Add(BacklogEntry entry, CancellationToken ct)
    {
        db.Backlog.Add(entry);
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException
            { SqlState: PostgresErrorCodes.UniqueViolation, ConstraintName: BacklogDbContext.ImportIndex })
        {
            db.Entry(entry).State = EntityState.Detached;
            throw new DuplicateImportException();
        }
    }

    public async Task<bool> Save(CancellationToken ct)
    {
        try
        {
            await db.SaveChangesAsync(ct);
            return true;
        }
        catch (DbUpdateConcurrencyException)
        {
            return false;
        }
    }

    public Task<bool> Delete(BacklogEntry entry, CancellationToken ct)
    {
        db.Backlog.Remove(entry);
        return Save(ct);
    }
}
