using FluentValidation;
using GamesBacklog.Application;
using GamesBacklog.Infrastructure.Catalog;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;
using System.Security.Claims;

namespace GamesBacklog.Api.Endpoints;

internal static class CatalogAdminEndpoints
{
    internal const string Policy = "CatalogAdmin";

    internal static void MapCatalogAdmin(this RouteGroupBuilder api)
    {
        var admin = api.MapGroup("/admin/catalog").RequireAuthorization(Policy).WithTags("Administração");
        admin.MapGet("/access", () => TypedResults.NoContent()).Produces(204).ProducesProblem(401).ProducesProblem(403);
        admin.MapGet("/search", Search).RequireRateLimiting("catalog")
            .ProducesValidationProblem().ProducesProblem(401).ProducesProblem(403).ProducesProblem(429).ProducesProblem(503);
        admin.MapPut("/games/{rawgId:int:min(1)}", Import).RequireRateLimiting("catalog")
            .ProducesProblem(401).ProducesProblem(403).ProducesProblem(404).ProducesProblem(429).ProducesProblem(503);
        admin.MapPost("/batch/preview", PreviewBatch).RequireRateLimiting("catalog")
            .ProducesValidationProblem().ProducesProblem(401).ProducesProblem(403).ProducesProblem(429).ProducesProblem(503);
        admin.MapPost("/batch/{previewId:guid}/publish", PublishBatch).RequireRateLimiting("catalog")
            .ProducesValidationProblem().ProducesProblem(401).ProducesProblem(403).ProducesProblem(429);
    }

    private static async Task<SearchResult> Search(RawgCatalog rawg, StoredCatalog catalog,
        IValidator<CatalogQuery> rules, [FromQuery] string q, CancellationToken ct, [FromQuery] int page = 1)
    {
        var query = new CatalogQuery(q, page);
        await rules.ValidateAndThrowAsync(query, ct);
        var result = await rawg.Search(query, ct);
        var ids = await catalog.FindPublishedIds(result.Items.Select(game => game.RawgId).ToArray(), ct);
        return new(result.Items, result.Page, result.PageSize, result.HasMore, ids);
    }

    private static async Task<CatalogGame> Import(int rawgId, RawgCatalog rawg, StoredCatalog catalog,
        CancellationToken ct)
    {
        var existing = await catalog.Find(rawgId, ct);
        if (existing is not null) return existing;

        var game = await rawg.Find(rawgId, ct) ?? throw new GameNotFoundException();
        await catalog.InsertMissing([game], ct);
        return (await catalog.Find(rawgId, ct))!;
    }

    private static async Task<BatchPreviewResult> PreviewBatch(CatalogBatchRequest request, RawgCatalog rawg,
        StoredCatalog catalog, ClaimsPrincipal user, IMemoryCache cache, TimeProvider clock, CancellationToken ct)
    {
        new PopularBatch(request.Count).Validate();
        if (request.List is not ("popular" or "new"))
            throw new ValidationException([new("list", "Escolha Populares ou Novidades.")]);

        var today = DateOnly.FromDateTime(clock.GetUtcNow().UtcDateTime);
        var games = new Dictionary<int, CatalogGame>();
        for (var page = 1; page <= RawgCatalog.MaxPopularPages && games.Count < request.Count; page++)
        {
            var result = request.List == "popular"
                ? await rawg.Popular(page, ct)
                : await rawg.NewReleases(page, today, ct);
            foreach (var game in result.Items)
            {
                games.TryAdd(game.RawgId, game);
                if (games.Count == request.Count) break;
            }
            if (!result.HasMore) break;
        }

        var previewId = Guid.NewGuid();
        var ids = await catalog.FindPublishedIds(games.Keys.ToArray(), ct);
        cache.Set((user.GetOwnerId(), previewId), new BatchPreview(request.List, games), TimeSpan.FromMinutes(30));
        return new(previewId, games.Values.ToArray(), ids);
    }

    private static async Task<BatchPublishResult> PublishBatch(Guid previewId, CatalogBatchSelection request,
        ClaimsPrincipal user, StoredCatalog catalog, IMemoryCache cache, CancellationToken ct)
    {
        var key = (user.GetOwnerId(), previewId);
        if (!cache.TryGetValue<BatchPreview>(key, out var preview) || preview is null)
            throw new ValidationException([new("preview", "A prévia expirou. Consulte os jogos novamente.")]);

        if (request.Ids is not { Length: > 0 and <= 500 } || request.Ids.Any(id => !preview.Games.ContainsKey(id)))
            throw new ValidationException([new("ids", "Selecione jogos que aparecem na prévia.")]);

        var ids = request.Ids.Distinct().ToArray();
        var (added, marked) = await catalog.PublishList(ids.Select(id => preview.Games[id]).ToArray(), preview.List, ct);
        return new(added, marked, ids);
    }

    private sealed record CatalogBatchRequest(int Count, string List);
    private sealed record CatalogBatchSelection(int[] Ids);
    private sealed record BatchPreview(string List, IReadOnlyDictionary<int, CatalogGame> Games);
    private sealed record BatchPreviewResult(Guid PreviewId, IReadOnlyList<CatalogGame> Items,
        IReadOnlyList<int> PublishedIds);
    private sealed record BatchPublishResult(int Added, int Marked, IReadOnlyList<int> CatalogIds);

    private sealed record SearchResult(IReadOnlyList<CatalogGame> Items, int Page, int PageSize,
        bool HasMore, IReadOnlyList<int> PublishedIds);
}
