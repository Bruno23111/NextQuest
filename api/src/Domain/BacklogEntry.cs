namespace GamesBacklog.Domain;

public enum GameStatus { Planned, Playing, Completed, Dropped }

public sealed class BacklogEntry
{
    private BacklogEntry() { }

    public Guid Id { get; private set; }
    public Guid OwnerId { get; private set; }
    public string Title { get; private set; } = null!;
    public string Platform { get; private set; } = null!;
    public GameStatus Status { get; private set; }
    public int? RawgId { get; private set; }
    public int? PlatformId { get; private set; }
    public string? CoverUrl { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public string? LastCheckpoint { get; private set; }
    public string? NextObjective { get; private set; }
    public string? Notes { get; private set; }

    public static BacklogEntry Create(Guid ownerId, string title, string platform, DateTimeOffset now) =>
        new()
        {
            Id = Guid.NewGuid(), OwnerId = ownerId, Title = title.Trim(), Platform = platform.Trim(),
            Status = GameStatus.Planned, CreatedAt = now
        };

    public static BacklogEntry Import(Guid ownerId, string title, string platform, int rawgId, int platformId,
        string? coverUrl, DateTimeOffset now)
    {
        var entry = Create(ownerId, title, platform, now);
        entry.RawgId = rawgId;
        entry.PlatformId = platformId;
        entry.CoverUrl = coverUrl;
        return entry;
    }

    public bool TryUpdate(string? title, string? platform, GameStatus? status)
    {
        if (RawgId.HasValue && (title is not null || platform is not null))
            return false;

        if (title is not null) Title = title.Trim();
        if (platform is not null) Platform = platform.Trim();
        if (status.HasValue) Status = status.Value;
        return true;
    }
}
