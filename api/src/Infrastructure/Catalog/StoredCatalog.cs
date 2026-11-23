using System.Text.Json;
using GamesBacklog.Application;
using GamesBacklog.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace GamesBacklog.Infrastructure.Catalog;

public sealed class CatalogEntry
{
    public int Id { get; init; }
    public required string Title { get; init; }
    public required string Data { get; init; }
    public bool Popular { get; init; }
    public bool NewRelease { get; init; }
}

public sealed class StoredCatalog(BacklogDbContext db) : IGameCatalog, IPopularGameCatalog
{
    public Task<PagedResult<CatalogGame>> Search(CatalogQuery query, CancellationToken ct)
        => Browse(query.Q, query.Page, null, ct);

    public Task<PagedResult<CatalogGame>> Browse(string? q, int page, string? filter, CancellationToken ct)
    {
        var entries = filter switch
        {
            "popular" => db.Set<CatalogEntry>().Where(game => game.Popular),
            "new" => db.Set<CatalogEntry>().Where(game => game.NewRelease),
            _ => db.Set<CatalogEntry>().AsQueryable()
        };
        if (!string.IsNullOrWhiteSpace(q))
        {
            var term = q.Trim().Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_");
            entries = entries.Where(game => EF.Functions.ILike(game.Title, "%" + term + "%"));
        }
        return List(entries, page, string.IsNullOrWhiteSpace(q) ? 40 : 20, ct);
    }

    public Task<PagedResult<CatalogGame>> Popular(int page, CancellationToken ct) =>
        List(db.Set<CatalogEntry>(), page, 40, ct);

    public async Task<CatalogGame?> Find(int rawgId, CancellationToken ct)
    {
        var entry = await db.Set<CatalogEntry>().FindAsync([rawgId], ct);
        return entry is null ? null : Deserialize(entry.Data);
    }

    public Task<int[]> FindPublishedIds(int[] ids, CancellationToken ct) =>
        db.Set<CatalogEntry>().Where(game => ids.Contains(game.Id)).Select(game => game.Id).ToArrayAsync(ct);

    public async Task<(int Added, int Marked)> PublishList(CatalogGame[] games, string list, CancellationToken ct)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        var added = await InsertMissing(games, ct, list);
        var ids = games.Select(game => game.RawgId).ToArray();
        var existing = db.Set<CatalogEntry>().Where(game => ids.Contains(game.Id));
        var marked = list == "popular"
            ? await existing.Where(game => !game.Popular)
                .ExecuteUpdateAsync(setters => setters.SetProperty(game => game.Popular, true), ct)
            : await existing.Where(game => !game.NewRelease)
                .ExecuteUpdateAsync(setters => setters.SetProperty(game => game.NewRelease, true), ct);
        await transaction.CommitAsync(ct);
        return (added, marked);
    }

    public Task<int> InsertMissing(IEnumerable<CatalogGame> games, CancellationToken ct, string? list = null)
    {
        var rows = JsonSerializer.Serialize(games.Select(game => new
        {
            Id = game.RawgId,
            game.Title,
            Data = JsonSerializer.Serialize(game)
        }));
        return db.Database.ExecuteSqlInterpolatedAsync($"""
            INSERT INTO "CatalogEntries" ("Id", "Title", "Data", "Popular", "NewRelease")
            SELECT "Id", "Title", "Data", {list == "popular"}, {list == "new"} FROM jsonb_to_recordset(CAST({rows} AS jsonb))
                AS games("Id" integer, "Title" text, "Data" text)
            ORDER BY "Id"
            ON CONFLICT ("Id") DO NOTHING
            """, ct);
    }

    private static async Task<PagedResult<CatalogGame>> List(IQueryable<CatalogEntry> entries,
        int page, int size, CancellationToken ct)
    {
        if (page < 1 || page > int.MaxValue / size)
            throw new FluentValidation.ValidationException([new("page", "Informe uma página válida.")]);

        var data = await entries.OrderBy(game => game.Title).ThenBy(game => game.Id)
            .Skip((page - 1) * size).Take(size + 1).Select(game => game.Data).ToListAsync(ct);
        return new(data.Take(size).Select(Deserialize).ToArray(), page, size, data.Count > size);
    }

    private static CatalogGame Deserialize(string data) => JsonSerializer.Deserialize<CatalogGame>(data)!;
}
