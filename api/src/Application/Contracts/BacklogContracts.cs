using GamesBacklog.Domain;

namespace GamesBacklog.Application;

public sealed record CreateGame(string Title, string Platform);

public sealed record UpdateGame(string? Title, string? Platform, GameStatus? Status);

public sealed record ImportGame(int RawgId, int PlatformId);

public sealed record BacklogQuery(string? Q, GameStatus? Status, int Page = 1);

public sealed record CatalogQuery(string Q, int Page = 1);

public sealed record PagedResult<T>(IReadOnlyList<T> Items, int Page, int PageSize, bool HasMore);

public sealed record CatalogPlatform(int Id, string Name);

public sealed record CatalogGame(
    int RawgId,
    string Title,
    string? CoverUrl,
    IReadOnlyList<CatalogPlatform> Platforms,
    int? MetacriticScore = null,
    string? MetacriticUrl = null);
