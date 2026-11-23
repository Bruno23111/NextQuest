using System.Linq.Expressions;
using System.Text.Json;
using GamesBacklog.Application;
using GamesBacklog.Domain;
using GamesBacklog.Infrastructure.Catalog;
using GamesBacklog.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;

namespace GamesBacklog.Infrastructure.Persistence;

public sealed class Friendship
{
    public Guid FirstId { get; init; }
    public Guid SecondId { get; init; }
    public Guid RequestedBy { get; init; }
    public bool Accepted { get; init; }
}

public sealed class Wish
{
    public Guid OwnerId { get; init; }
    public int GameId { get; init; }
    public DateTimeOffset AddedAt { get; init; }
}

public sealed record FriendConnection(Guid Id, string DisplayName, string Status, string? AvatarUrl);
public sealed record FriendGame(Guid Id, string Title, string Platform, GameStatus Status, int? RawgId, string? CoverUrl);
public sealed record FriendProfile(string DisplayName, string? Bio, string? AvatarUrl, string? HeaderUrl,
    IReadOnlyList<FriendGame> Playing, PagedResult<FriendGame> Library, PagedResult<CatalogGame> Wishlist);

public sealed class SocialStore(BacklogDbContext db, TimeProvider clock)
{
    public const int PageSize = 24;
    private static readonly Expression<Func<BacklogEntry, FriendGame>> ProjectGame =
        game => new FriendGame(game.Id, game.Title, game.Platform, game.Status, game.RawgId, game.CoverUrl);

    public Task<FriendConnection[]> Connections(Guid owner, CancellationToken ct) =>
        (from link in db.Set<Friendship>()
         where link.FirstId == owner || link.SecondId == owner
         join user in db.Users on (link.FirstId == owner ? link.SecondId : link.FirstId) equals user.Id
         let name = user.DisplayName ?? "Jogador"
         orderby name, user.Id
         select new FriendConnection(user.Id, name, link.Accepted ? "friend" :
             link.RequestedBy == owner ? "outgoing" : "incoming", user.AvatarUrl)).ToArrayAsync(ct);

    public Task<string> FriendCode(Guid owner, CancellationToken ct) =>
        db.Users.Where(user => user.Id == owner).Select(user => user.FriendCode).SingleAsync(ct);

    public Task<Guid?> FindByCode(string code, CancellationToken ct) =>
        db.Users.Where(user => user.FriendCode == code).Select(user => (Guid?)user.Id).SingleOrDefaultAsync(ct);

    public async Task<string> RotateCode(Guid owner, CancellationToken ct)
    {
        var code = BacklogUser.GenerateFriendCode();
        await db.Users.Where(user => user.Id == owner)
            .ExecuteUpdateAsync(setters => setters.SetProperty(user => user.FriendCode, code), ct);
        return code;
    }

    public Task Request(Guid owner, Guid other, CancellationToken ct)
    {
        var (first, second) = Pair(owner, other);
        return db.Database.ExecuteSqlInterpolatedAsync($"""
            INSERT INTO "Friendships" ("FirstId", "SecondId", "RequestedBy", "Accepted")
            VALUES ({first}, {second}, {owner}, FALSE)
            ON CONFLICT ("FirstId", "SecondId") DO NOTHING
            """, ct);
    }

    public async Task<bool> Accept(Guid owner, Guid other, CancellationToken ct)
    {
        var pair = Link(owner, other).Where(link => link.RequestedBy == other);
        return await pair.ExecuteUpdateAsync(setters => setters.SetProperty(link => link.Accepted, true), ct) > 0;
    }

    public Task Remove(Guid owner, Guid other, CancellationToken ct) => Link(owner, other).ExecuteDeleteAsync(ct);

    public async Task<FriendProfile?> Profile(Guid owner, Guid other, int page, int wishlistPage, CancellationToken ct)
    {
        // Every query is scoped to the accepted friendship, including each page.
        var access = Link(owner, other).Where(link => link.Accepted);
        var profile = await db.Users.Where(user => user.Id == other && access.Any())
            .Select(user => new { user.DisplayName, user.Bio, user.AvatarUrl, user.HeaderUrl })
            .SingleOrDefaultAsync(ct);
        if (profile is null) return null;

        var games = db.Backlog.Where(game => game.OwnerId == other && access.Any())
            .OrderByDescending(game => game.CreatedAt).ThenBy(game => game.Id);
        var playing = await games.Where(game => game.Status == GameStatus.Playing)
            .Take(PageSize).Select(ProjectGame).ToArrayAsync(ct);
        var library = await games.Skip((page - 1) * PageSize).Take(PageSize + 1).Select(ProjectGame).ToArrayAsync(ct);
        var wishes = await ReadWishes(db.Set<Wish>().Where(wish => wish.OwnerId == other && access.Any()), wishlistPage, ct);
        return new(profile.DisplayName ?? "Jogador", profile.Bio, profile.AvatarUrl, profile.HeaderUrl,
            playing, Page(library, page), wishes);
    }

    public Task<int[]> WishIds(Guid owner, CancellationToken ct) =>
        db.Set<Wish>().Where(wish => wish.OwnerId == owner).Select(wish => wish.GameId).ToArrayAsync(ct);

    public Task<PagedResult<CatalogGame>> Wishlist(Guid owner, int page, CancellationToken ct) =>
        ReadWishes(db.Set<Wish>().Where(wish => wish.OwnerId == owner), page, ct);

    public async Task<bool> AddWish(Guid owner, int gameId, CancellationToken ct)
    {
        var now = clock.GetUtcNow();
        var added = await db.Database.ExecuteSqlInterpolatedAsync($"""
            INSERT INTO "Wishes" ("OwnerId", "GameId", "AddedAt")
            SELECT {owner}, "Id", {now} FROM "CatalogEntries" WHERE "Id" = {gameId}
            ON CONFLICT ("OwnerId", "GameId") DO NOTHING
            """, ct);
        return added > 0 || await db.Set<Wish>().AnyAsync(wish => wish.OwnerId == owner && wish.GameId == gameId, ct);
    }

    public Task RemoveWish(Guid owner, int gameId, CancellationToken ct) =>
        db.Set<Wish>().Where(wish => wish.OwnerId == owner && wish.GameId == gameId).ExecuteDeleteAsync(ct);

    private async Task<PagedResult<CatalogGame>> ReadWishes(IQueryable<Wish> wishes, int page, CancellationToken ct)
    {
        var rows = await (from wish in wishes
                          join game in db.Set<CatalogEntry>() on wish.GameId equals game.Id
                          orderby wish.AddedAt descending, wish.GameId
                          select game.Data).Skip((page - 1) * PageSize).Take(PageSize + 1).ToArrayAsync(ct);
        return Page(rows.Select(data => JsonSerializer.Deserialize<CatalogGame>(data)!).ToArray(), page);
    }

    private static PagedResult<T> Page<T>(T[] items, int page) =>
        new(items.Take(PageSize).ToArray(), page, PageSize, items.Length > PageSize);

    private IQueryable<Friendship> Link(Guid owner, Guid other)
    {
        var (first, second) = Pair(owner, other);
        return db.Set<Friendship>().Where(link => link.FirstId == first && link.SecondId == second);
    }

    private static (Guid First, Guid Second) Pair(Guid first, Guid second) =>
        first.CompareTo(second) < 0 ? (first, second) : (second, first);
}
