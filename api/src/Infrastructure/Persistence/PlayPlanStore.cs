using GamesBacklog.Application;
using Microsoft.EntityFrameworkCore;

namespace GamesBacklog.Infrastructure.Persistence;

public sealed class PlayPlanStore(BacklogDbContext db) : IPlayPlanStore
{
    public async Task<IReadOnlyList<QueuedGame>> GetQueue(Guid ownerId, CancellationToken ct)
    {
        var ids = await db.Users.Where(x => x.Id == ownerId)
            .Select(x => x.PlayQueue).SingleOrDefaultAsync(ct) ?? [];
        var games = await db.Backlog.Where(x => x.OwnerId == ownerId && ids.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, x => new QueuedGame(x.Id, x.Title), ct);
        return ids.Where(games.ContainsKey).Select(id => games[id]).ToArray();
    }

    public async Task<bool> SaveQueue(Guid ownerId, IReadOnlyList<Guid> ids, CancellationToken ct)
    {
        var gameIds = ids.ToArray();
        if (await db.Backlog.CountAsync(x => x.OwnerId == ownerId && gameIds.Contains(x.Id), ct) != gameIds.Length)
            return false;

        return await db.Users.Where(x => x.Id == ownerId)
            .ExecuteUpdateAsync(update => update.SetProperty(x => x.PlayQueue, gameIds), ct) == 1;
    }

    public Task<GameJournal?> GetJournal(Guid ownerId, Guid gameId, CancellationToken ct) =>
        db.Backlog.Where(x => x.OwnerId == ownerId && x.Id == gameId)
            .Select(x => new GameJournal(x.LastCheckpoint, x.NextObjective, x.Notes)).SingleOrDefaultAsync(ct);

    public async Task<bool> SaveJournal(Guid ownerId, Guid gameId, GameJournal journal, CancellationToken ct) =>
        await db.Backlog.Where(x => x.OwnerId == ownerId && x.Id == gameId)
            .ExecuteUpdateAsync(update => update
                .SetProperty(x => x.LastCheckpoint, journal.LastCheckpoint)
                .SetProperty(x => x.NextObjective, journal.NextObjective)
                .SetProperty(x => x.Notes, journal.Notes), ct) == 1;
}
