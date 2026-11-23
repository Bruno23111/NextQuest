using GamesBacklog.Application;
using GamesBacklog.Infrastructure.Catalog;
using GamesBacklog.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace GamesBacklog.Infrastructure.Videos;

public sealed class GameVideo
{
    public required string Id { get; init; }
    public required string Title { get; set; }
    public required string Channel { get; set; }
    public string? ThumbnailUrl { get; set; }
    public bool CanPlayHere { get; set; }
    public required string Category { get; set; }
    public int? RawgId { get; set; }
    public DateTimeOffset PublishedAt { get; init; }
    public DateTimeOffset CheckedAt { get; set; }
}

public sealed record PublishedVideo(string Id, string Title, string Channel, string? ThumbnailUrl,
    string Category, int? RawgId, string? GameTitle, bool CanPlayHere);

public sealed class GameVideoStore(BacklogDbContext db, TimeProvider clock)
{
    public const int PageSize = 24;
    private static readonly TimeSpan MaxAge = TimeSpan.FromDays(29);

    public async Task<PagedResult<PublishedVideo>> List(string? query, string? category, int page, CancellationToken ct)
    {
        var limit = clock.GetUtcNow() - MaxAge;
        var videos = db.Set<GameVideo>().AsNoTracking().Where(video => video.CheckedAt > limit);
        if (category is not null) videos = videos.Where(video => video.Category == category);
        var joined = from video in videos
                     join game in db.Set<CatalogEntry>() on video.RawgId equals (int?)game.Id into games
                     from game in games.DefaultIfEmpty()
                     select new { Video = video, GameTitle = game == null ? null : game.Title };
        if (!string.IsNullOrWhiteSpace(query))
        {
            var term = "%" + query.Trim().Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_") + "%";
            joined = joined.Where(row => EF.Functions.ILike(row.Video.Title, term) ||
                EF.Functions.ILike(row.GameTitle ?? "", term));
        }
        var rows = await joined.OrderByDescending(row => row.Video.PublishedAt).ThenBy(row => row.Video.Id)
            .Skip((page - 1) * PageSize).Take(PageSize + 1)
            .Select(row => new PublishedVideo(row.Video.Id, row.Video.Title, row.Video.Channel,
                row.Video.ThumbnailUrl, row.Video.Category, row.Video.RawgId, row.GameTitle, row.Video.CanPlayHere)).ToArrayAsync(ct);
        return new(rows.Take(PageSize).ToArray(), page, PageSize, rows.Length > PageSize);
    }

    public Task<string[]> PublishedIds(string[] ids, CancellationToken ct) =>
        db.Set<GameVideo>().Where(video => ids.Contains(video.Id)).Select(video => video.Id).ToArrayAsync(ct);

    public Task Publish(YouTubeVideo video, string category, int? rawgId, CancellationToken ct)
    {
        var now = clock.GetUtcNow();
        return db.Database.ExecuteSqlInterpolatedAsync($"""
            INSERT INTO "GameVideos" ("Id", "Title", "Channel", "ThumbnailUrl", "Category", "RawgId", "PublishedAt", "CheckedAt", "CanPlayHere")
            VALUES ({video.Id}, {video.Title}, {video.Channel}, {video.ThumbnailUrl}, {category}, {rawgId}, {now}, {now}, {video.CanPlayHere})
            ON CONFLICT ("Id") DO NOTHING
            """, ct);
    }

    public Task Remove(string id, CancellationToken ct) =>
        db.Set<GameVideo>().Where(video => video.Id == id).ExecuteDeleteAsync(ct);

    public Task PurgeExpired(CancellationToken ct)
    {
        var limit = clock.GetUtcNow() - MaxAge;
        return db.Set<GameVideo>().Where(video => video.CheckedAt <= limit).ExecuteDeleteAsync(ct);
    }

    public async Task Refresh(YouTubeClient youtube, CancellationToken ct)
    {
        var now = clock.GetUtcNow();
        var limit = now.AddDays(-25);
        var rows = await db.Set<GameVideo>().Where(video => video.CheckedAt <= limit)
            .OrderBy(video => video.CheckedAt).Take(50).ToArrayAsync(ct);
        if (rows.Length == 0) return;
        var fresh = (await youtube.Details(rows.Select(video => video.Id), ct)).ToDictionary(video => video.Id);
        foreach (var row in rows)
        {
            if (!fresh.TryGetValue(row.Id, out var video))
            {
                db.Remove(row);
                continue;
            }
            row.Title = video.Title;
            row.Channel = video.Channel;
            row.ThumbnailUrl = video.ThumbnailUrl;
            row.CanPlayHere = video.CanPlayHere;
            row.CheckedAt = now;
        }
        await db.SaveChangesAsync(ct);
    }
}
