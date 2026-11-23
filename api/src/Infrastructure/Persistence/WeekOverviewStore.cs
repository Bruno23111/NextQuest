using GamesBacklog.Domain;
using GamesBacklog.Infrastructure.Deals;
using GamesBacklog.Infrastructure.Videos;
using Microsoft.EntityFrameworkCore;

namespace GamesBacklog.Infrastructure.Persistence;

public sealed record WeekGame(Guid Id, string Title, string Platform, string? CoverUrl, string? NextObjective);
public sealed record WeekOverview(IReadOnlyList<WeekGame> Playing, IReadOnlyList<WeekGame> Queue,
    IReadOnlyList<WishlistOffer> Offers, IReadOnlyList<PublishedVideo> Videos);

public sealed class WeekOverviewStore(BacklogDbContext db, StoredDeals deals, GameVideoStore videos)
{
    public async Task<WeekOverview> Get(Guid owner, CancellationToken ct)
    {
        var library = db.Backlog.Where(game => game.OwnerId == owner);
        var playing = await library.Where(game => game.Status == GameStatus.Playing)
            .OrderByDescending(game => game.CreatedAt).ThenBy(game => game.Id).Take(6)
            .Select(game => new WeekGame(game.Id, game.Title, game.Platform, game.CoverUrl, game.NextObjective))
            .ToArrayAsync(ct);
        var ids = await db.Users.Where(user => user.Id == owner)
            .Select(user => user.PlayQueue).SingleOrDefaultAsync(ct) ?? [];
        var queued = await library.Where(game => ids.Contains(game.Id) && game.Status == GameStatus.Planned)
            .Select(game => new WeekGame(game.Id, game.Title, game.Platform, game.CoverUrl, game.NextObjective))
            .ToDictionaryAsync(game => game.Id, ct);
        var next = ids.Distinct().Where(queued.ContainsKey).Take(3).Select(id => queued[id]).ToArray();

        return new(playing, next, await deals.ForWishlist(owner, 6, ct), await videos.ForLibrary(owner, 6, ct));
    }
}
