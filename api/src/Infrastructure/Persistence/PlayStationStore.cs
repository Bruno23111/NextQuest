using GamesBacklog.Application;
using GamesBacklog.Domain;
using GamesBacklog.Infrastructure.PlayStation;
using Microsoft.EntityFrameworkCore;

namespace GamesBacklog.Infrastructure.Persistence;

public sealed class PlayStationTrophies
{
    public Guid GameId { get; init; }
    public int Bronze { get; set; }
    public int Silver { get; set; }
    public int Gold { get; set; }
    public int Platinum { get; set; }

    public void Update(TrophyCounts counts)
    {
        Bronze = counts.Bronze;
        Silver = counts.Silver;
        Gold = counts.Gold;
        Platinum = counts.Platinum;
    }
}

public sealed record TrophyCounts(int Bronze, int Silver, int Gold, int Platinum);
public sealed record PlayStationGame(Guid Id, string Title, string Platform, GameStatus Status,
    int? RawgId, string? CoverUrl, TrophyCounts? Trophies);
public sealed record PsnImportResult(int Added, int Updated, int Skipped);

public sealed class PlayStationStore(BacklogDbContext db, TimeProvider clock)
{
    public const int PageSize = 24;

    private static readonly string[] ShortPlatformNames =
        ["ps", "ps1", "psone", "psx", "ps2", "ps3", "ps4", "ps4pro", "ps5", "ps5pro", "psp", "psvita"];

    private IQueryable<BacklogEntry> Games(Guid owner) =>
        from game in db.Backlog
        where game.OwnerId == owner
        let platform = game.Platform.Trim().ToLower().Replace(" ", "").Replace("-", "")
        where platform.StartsWith("playstation") || platform.StartsWith("sonyplaystation")
            || ShortPlatformNames.Contains(platform)
        select game;

    public async Task<PagedResult<PlayStationGame>> List(Guid owner, string? query, int page, CancellationToken ct)
    {
        var owned = Games(owner).AsNoTracking();
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

    public async Task<PsnImportResult> ImportPsn(Guid owner, IReadOnlyList<PsnTitle> titles, CancellationToken ct)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        // Serialize imports for the same account even if two previews are confirmed together.
        await db.Database.ExecuteSqlInterpolatedAsync($"""SELECT 1 FROM "Users" WHERE "Id" = {owner} FOR UPDATE""", ct);
        var games = await Games(owner).ToListAsync(ct);
        var byPsnId = games.Where(game => game.PsnTrophyId is not null)
            .ToDictionary(game => game.PsnTrophyId!, StringComparer.Ordinal);
        var byTitle = games.ToLookup(game => TitleKey(game.Title, game.Platform));
        var reserved = new HashSet<(string Title, string Platform)>();
        var ids = games.Select(game => game.Id).ToArray();
        var trophies = await db.Set<PlayStationTrophies>().Where(row => ids.Contains(row.GameId))
            .ToDictionaryAsync(row => row.GameId, ct);

        int added = 0, updated = 0, skipped = 0;
        foreach (var title in titles)
        {
            if (!byPsnId.TryGetValue(title.Id, out var game))
            {
                var key = TitleKey(title.Title, title.Platform);
                var candidates = byTitle[key].Take(2).ToArray();
                if (candidates.Length > 1 || candidates.FirstOrDefault()?.PsnTrophyId is not null || !reserved.Add(key))
                {
                    skipped++;
                    continue;
                }
                game = candidates.SingleOrDefault();
                if (game is null)
                {
                    game = BacklogEntry.Create(owner, title.Title, title.Platform, clock.GetUtcNow());
                    db.Backlog.Add(game);
                    added++;
                }
                else
                {
                    updated++;
                }
            }
            else
            {
                updated++;
            }

            game.LinkPlayStation(title.Id, title.CoverUrl);
            if (title.Trophies is not { } counts) continue;
            if (!trophies.TryGetValue(game.Id, out var row))
            {
                row = new PlayStationTrophies { GameId = game.Id };
                db.Add(row);
            }
            row.Update(counts);
        }

        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return new(added, updated, skipped);
    }

    private static (string Title, string Platform) TitleKey(string title, string platform)
    {
        var key = platform.Trim().ToUpperInvariant().Replace(" ", "").Replace("-", "");
        key = key switch
        {
            "PLAYSTATION5" or "SONYPLAYSTATION5" or "PS5PRO" or "PLAYSTATION5PRO" => "PS5",
            "PLAYSTATION4" or "SONYPLAYSTATION4" or "PS4PRO" or "PLAYSTATION4PRO" => "PS4",
            "PLAYSTATION3" or "SONYPLAYSTATION3" => "PS3",
            "PLAYSTATIONVITA" or "SONYPLAYSTATIONVITA" => "PSVITA",
            _ => key
        };
        return (title.Trim().ToUpperInvariant(), key);
    }
}
