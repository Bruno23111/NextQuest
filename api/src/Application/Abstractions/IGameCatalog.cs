namespace GamesBacklog.Application;

public interface IGameCatalog
{
    Task<PagedResult<CatalogGame>> Search(CatalogQuery query, CancellationToken ct);
    Task<CatalogGame?> Find(int rawgId, CancellationToken ct);
}

public interface IPopularGameCatalog
{
    Task<PagedResult<CatalogGame>> Popular(int page, CancellationToken ct);
}
