using System.Security.Claims;
using FluentValidation;
using GamesBacklog.Api.Contracts;
using GamesBacklog.Application;
using GamesBacklog.Domain;
using Mapster;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.OpenApi;

namespace GamesBacklog.Api.Endpoints;

internal static class BacklogEndpoints
{
    internal static void MapBacklog(this RouteGroupBuilder api)
    {
        var backlog = api.MapGroup("/backlog").WithTags("Backlog").RequireAuthorization();
        backlog.MapPlayPlan();
        backlog.MapGet("", List).WithName("ListBacklog").ProducesValidationProblem().ProducesProblem(401)
            .AddOpenApiOperationTransformer((operation, context, _) =>
            {
                var status = operation.Parameters!.OfType<OpenApiParameter>().Single(x => x.Name == "status");
                status.Schema = new OpenApiSchemaReference(nameof(GameStatus), context.Document);
                return Task.CompletedTask;
            });
        backlog.MapPost("", Create).WithName("CreateBacklog").ProducesValidationProblem().ProducesProblem(401);
        backlog.MapGet("/{id:guid}", Find).WithName("FindBacklog").ProducesProblem(404).ProducesProblem(401);
        backlog.MapPatch("/{id:guid}", Update).WithName("UpdateBacklog")
            .ProducesValidationProblem().ProducesProblem(404).ProducesProblem(401);
        backlog.MapDelete("/{id:guid}", Delete).WithName("DeleteBacklog").ProducesProblem(404).ProducesProblem(401);
        backlog.MapPost("/import", Import).WithName("ImportBacklog").RequireRateLimiting("catalog")
            .ProducesValidationProblem().ProducesProblem(404).ProducesProblem(409)
            .ProducesProblem(429).ProducesProblem(401);

        api.MapGet("/catalog/games", Search).WithName("SearchCatalog").WithTags("Catálogo")
            .RequireAuthorization().RequireRateLimiting("catalog").ProducesValidationProblem()
            .ProducesProblem(429).ProducesProblem(401);
        api.MapGet("/catalog/games/{rawgId:int:min(1)}", FindCatalogGame)
            .WithName("FindCatalogGame").WithTags("Catálogo")
            .RequireAuthorization().RequireRateLimiting("catalog")
            .ProducesProblem(401).ProducesProblem(404).ProducesProblem(429);
        api.MapGet("/catalog/popular", Popular).WithName("PopularCatalog").WithTags("Catálogo")
            .RequireAuthorization().RequireRateLimiting("catalog").ProducesValidationProblem()
            .ProducesProblem(429).ProducesProblem(401);
        api.MapGet("/catalog/browse", Browse).WithName("BrowsePublishedCatalog").WithTags("Catálogo")
            .RequireAuthorization().ProducesValidationProblem().ProducesProblem(401);
    }

    private static async Task<PagedResult<CatalogGame>> Browse(
        GamesBacklog.Infrastructure.Catalog.StoredCatalog catalog, IValidator<CatalogQuery> rules,
        CancellationToken ct, [FromQuery] string filter, [FromQuery] int page = 1, [FromQuery] string? q = null)
    {
        if (filter is not ("popular" or "new"))
            throw new ValidationException([new("filter", "Escolha Populares ou Novidades.")]);
        if (!string.IsNullOrWhiteSpace(q))
            await rules.ValidateAndThrowAsync(new CatalogQuery(q, page), ct);
        return await catalog.Browse(q, page, filter, ct);
    }

    private static async Task<Ok<CatalogGame>> FindCatalogGame(int rawgId, IGameCatalog catalog, CancellationToken ct) =>
        TypedResults.Ok(await catalog.Find(rawgId, ct) ?? throw new GameNotFoundException());

    private static async Task<Ok<PagedResult<CatalogGame>>> Popular(IPopularGameCatalog catalog,
        CancellationToken ct, [FromQuery] int page = 1) => TypedResults.Ok(await catalog.Popular(page, ct));

    private static async Task<Ok<PagedResult<CatalogGame>>> Search(IGameCatalog catalog, IValidator<CatalogQuery> rules,
        CancellationToken ct, [FromQuery] string q, [FromQuery] int page = 1)
    {
        var query = new CatalogQuery(q, page);
        await rules.ValidateAndThrowAsync(query, ct);
        return TypedResults.Ok(await catalog.Search(query, ct));
    }

    private static async Task<Ok<PagedResult<BacklogGame>>> List(ClaimsPrincipal user, BacklogService service,
        TypeAdapterConfig mapping, IValidator<BacklogQuery> rules, CancellationToken ct,
        [FromQuery] string? q = null, [FromQuery] string? status = null, [FromQuery] int page = 1)
    {
        GameStatus? filter = null;
        if (status is not null)
        {
            if (!Enum.TryParse<GameStatus>(status, ignoreCase: true, out var parsed) ||
                !string.Equals(Enum.GetName(parsed), status, StringComparison.OrdinalIgnoreCase))
                throw new ValidationException([new("status", "Informe um status válido.")]);

            filter = parsed;
        }

        var query = new BacklogQuery(q, filter, page);
        await rules.ValidateAndThrowAsync(query, ct);
        var result = await service.List(user.GetOwnerId(), query, ct);
        return TypedResults.Ok(new PagedResult<BacklogGame>(result.Items.Select(x => Map(x, mapping)).ToArray(),
            result.Page, result.PageSize, result.HasMore));
    }

    private static async Task<Ok<BacklogGame>> Find(Guid id, ClaimsPrincipal user, BacklogService service,
        TypeAdapterConfig mapping, CancellationToken ct) =>
        TypedResults.Ok(Map(await service.Find(user.GetOwnerId(), id, ct), mapping));

    private static async Task<CreatedAtRoute<BacklogGame>> Create(CreateGame request, ClaimsPrincipal user,
        BacklogService service, TypeAdapterConfig mapping, IValidator<CreateGame> rules, CancellationToken ct)
    {
        await rules.ValidateAndThrowAsync(request, ct);
        var game = Map(await service.Create(user.GetOwnerId(), request, ct), mapping);
        return TypedResults.CreatedAtRoute(game, "FindBacklog", new { game.Id });
    }

    private static async Task<Ok<BacklogGame>> Update(Guid id, UpdateGame request, ClaimsPrincipal user,
        BacklogService service, TypeAdapterConfig mapping, IValidator<UpdateGame> rules, CancellationToken ct)
    {
        await rules.ValidateAndThrowAsync(request, ct);
        return TypedResults.Ok(Map(await service.Update(user.GetOwnerId(), id, request, ct), mapping));
    }

    private static async Task<NoContent> Delete(Guid id, ClaimsPrincipal user, BacklogService service,
        CancellationToken ct)
    {
        await service.Delete(user.GetOwnerId(), id, ct);
        return TypedResults.NoContent();
    }

    private static async Task<CreatedAtRoute<BacklogGame>> Import(ImportGame request, ClaimsPrincipal user,
        BacklogService service, TypeAdapterConfig mapping, IValidator<ImportGame> rules, CancellationToken ct)
    {
        await rules.ValidateAndThrowAsync(request, ct);
        var game = Map(await service.Import(user.GetOwnerId(), request, ct), mapping);
        return TypedResults.CreatedAtRoute(game, "FindBacklog", new { game.Id });
    }

    private static BacklogGame Map(BacklogEntry game, TypeAdapterConfig mapping) => game.Adapt<BacklogGame>(mapping);
}
