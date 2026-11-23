using FluentValidation;
using GamesBacklog.Application;
using GamesBacklog.Infrastructure.Catalog;
using GamesBacklog.Infrastructure.Videos;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;

namespace GamesBacklog.Api.Endpoints;

internal static class GameVideoEndpoints
{
    internal static void MapGameVideos(this RouteGroupBuilder api)
    {
        api.MapGet("/videos", List).RequireAuthorization().WithTags("Vídeos")
            .ProducesValidationProblem().ProducesProblem(401);

        var admin = api.MapGroup("/admin/videos").RequireAuthorization(CatalogAdminEndpoints.Policy)
            .WithTags("Administração");
        admin.MapGet("/search", Search).RequireRateLimiting("youtube").ProducesValidationProblem()
            .ProducesProblem(401).ProducesProblem(403).ProducesProblem(429).ProducesProblem(503);
        admin.MapPut("/{id}", Publish).RequireRateLimiting("youtube").Produces(204).ProducesValidationProblem()
            .ProducesProblem(401).ProducesProblem(403).ProducesProblem(404).ProducesProblem(429).ProducesProblem(503);
        admin.MapDelete("/{id}", Remove).Produces(204).ProducesValidationProblem()
            .ProducesProblem(401).ProducesProblem(403);
    }

    private static Task<PagedResult<PublishedVideo>> List(GameVideoStore store, CancellationToken ct,
        [FromQuery] string? q = null, [FromQuery] string? category = null, [FromQuery] int page = 1)
    {
        if (page < 1 || page > int.MaxValue / GameVideoStore.PageSize)
            throw new ValidationException([new("page", "Informe uma página válida.")]);
        ValidateCategory(category);
        if (q?.Trim().Length > 120)
            throw new ValidationException([new("q", "Pesquise com até 120 caracteres.")]);
        return store.List(q, category, page, ct);
    }

    private static async Task<VideoSearchResult> Search(YouTubeClient youtube, GameVideoStore store,
        IMemoryCache cache, [FromQuery] string q, CancellationToken ct)
    {
        var query = q.Trim();
        if (query.Length is < 2 or > 120)
            throw new ValidationException([new("q", "Informe entre 2 e 120 caracteres para buscar.")]);

        var key = ("youtube-search", query.ToUpperInvariant());
        if (!cache.TryGetValue<YouTubeVideo[]>(key, out var videos) || videos is null)
        {
            videos = await youtube.Search(query, ct);
            cache.Set(key, videos, TimeSpan.FromMinutes(10));
        }
        return new(videos, await store.PublishedIds(videos.Select(video => video.Id).ToArray(), ct));
    }

    private static async Task<IResult> Publish(string id, PublishRequest request, YouTubeClient youtube,
        GameVideoStore store, StoredCatalog catalog, CancellationToken ct)
    {
        ValidateId(id);
        if (request.Category is null)
            throw new ValidationException([new("category", "Selecione uma categoria.")]);
        ValidateCategory(request.Category);
        if ((await store.PublishedIds([id], ct)).Length > 0)
            return Results.NoContent();
        if (request.RawgId is { } rawgId && (await catalog.FindPublishedIds([rawgId], ct)).Length == 0)
            return Results.Problem(statusCode: 404, title: "O jogo selecionado não está no catálogo.");

        var video = (await youtube.Details([id], ct)).FirstOrDefault(video => video.Id == id);
        if (video is null)
            return Results.Problem(statusCode: 404, title: "O vídeo não está disponível para publicação.");
        await store.Publish(video, request.Category, request.RawgId, ct);
        return Results.NoContent();
    }

    private static async Task<IResult> Remove(string id, GameVideoStore store, CancellationToken ct)
    {
        ValidateId(id);
        await store.Remove(id, ct);
        return Results.NoContent();
    }

    private static void ValidateId(string id)
    {
        if (!YouTubeClient.ValidId(id))
            throw new ValidationException([new("id", "Informe um ID de vídeo válido do YouTube.")]);
    }

    private static void ValidateCategory(string? category)
    {
        if (category is not (null or "gameplay" or "review" or "trailer" or "other"))
            throw new ValidationException([new("category", "Selecione uma categoria válida.")]);
    }

    private sealed record PublishRequest(string? Category, int? RawgId);
    private sealed record VideoSearchResult(IReadOnlyList<YouTubeVideo> Items, IReadOnlyList<string> PublishedIds);
}
