using GamesBacklog.Application;
using GamesBacklog.Domain;
using Microsoft.EntityFrameworkCore;

namespace GamesBacklog.Infrastructure.Persistence;

public sealed class PlayStationTrophies
{
    public Guid GameId { get; init; }
    public int Bronze { get; init; }
    public int Silver { get; init; }
    public int Gold { get; init; }
    public int Platinum { get; init; }
}

public sealed record TrophyCounts(int Bronze, int Silver, int Gold, int Platinum);
public sealed record PlayStationGame(Guid Id, string Title, string Platform, GameStatus Status,
    int? RawgId, string? CoverUrl, TrophyCounts? Trophies);

public sealed class PlayStationStore(BacklogDbContext db)
{
    public const int PageSize = 24;

    private static readonly string[] ShortPlatformNames =
        ["ps", "ps1", "psone", "psx", "ps2", "ps3", "ps4", "ps4pro", "ps5", "ps5pro", "psp", "psvita"];

    private IQueryable<BacklogEntry> Games(Guid owner) =>
        from game in db.Backlog.AsNoTracking()
        where game.OwnerId == owner
        let platform = game.Platform.Trim().ToLower().Replace(" ", "").Replace("-", "")
        where platform.StartsWith("playstation") || platform.StartsWith("sonyplaystation")
            || ShortPlatformNames.Contains(platform)
        select game;

    public async Task<PagedResult<PlayStationGame>> List(Guid owner, string? query, int page, CancellationToken ct)
    {
        var owned = Games(owner);
        if (!string.IsNullOrWhiteSpace(query))
        {
            var term = query.Trim().Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_");
            owned = owned.Where(game => EF.Functions.ILike(game.Title, "%" + term + "%", "\\"));
        }

        var games = owned.OrderByDescending(game => game.CreatedAt).ThenBy(game => game.Id)
            .Skip((page - 1) * PageSize).Take(PageSize + 1);
        var rows = await (from game in games
                          join counts in db.Set<PlayStationTrophies>() on game.Id equals counts.GameId into progress
                          from counts in progress.DefaultIfEmpty()
                          orderby game.CreatedAt descending, game.Id
                          select new PlayStationGame(game.Id, game.Title, game.Platform, game.Status,
                              game.RawgId, game.CoverUrl, counts == null ? null :
                                  new TrophyCounts(counts.Bronze, counts.Silver, counts.Gold, counts.Platinum)))
            .ToArrayAsync(ct);
        return new(rows.Take(PageSize).ToArray(), page, PageSize, rows.Length > PageSize);
    }

    public async Task<bool> SaveTrophies(Guid owner, Guid gameId, TrophyCounts counts, CancellationToken ct)
    {
        if (!await Games(owner).AnyAsync(game => game.Id == gameId, ct)) return false;

        return await db.Database.ExecuteSqlInterpolatedAsync($"""
            INSERT INTO "PlayStationTrophies" ("GameId", "Bronze", "Silver", "Gold", "Platinum")
            SELECT "Id", {counts.Bronze}, {counts.Silver}, {counts.Gold}, {counts.Platinum}
            FROM "Backlog" WHERE "Id" = {gameId} AND "OwnerId" = {owner}
            ON CONFLICT ("GameId") DO UPDATE SET
                "Bronze" = EXCLUDED."Bronze", "Silver" = EXCLUDED."Silver",
                "Gold" = EXCLUDED."Gold", "Platinum" = EXCLUDED."Platinum"
            """, ct) > 0;
    }
}
