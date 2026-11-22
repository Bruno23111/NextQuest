using GamesBacklog.Domain;

namespace GamesBacklog.Api.Contracts;

internal sealed record BacklogGame(
    Guid Id,
    string Title,
    string Platform,
    GameStatus Status,
    int? RawgId,
    int? PlatformId,
    string? CoverUrl,
    DateTimeOffset CreatedAt);
