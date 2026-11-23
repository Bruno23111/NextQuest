using System.Security.Claims;
using GamesBacklog.Application;
using GamesBacklog.Infrastructure.Deals;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;

namespace GamesBacklog.Api.Endpoints;

internal static class DealsAdminEndpoints
{
    internal static void MapDealsAdmin(this RouteGroupBuilder api)
    {
        var admin = api.MapGroup("/admin/deals").RequireAuthorization(CatalogAdminEndpoints.Policy)
            .WithTags("Administração").RequireRateLimiting("catalog");
        admin.MapGet("/preview", Preview).ProducesValidationProblem().ProducesProblem(401)
            .ProducesProblem(403).ProducesProblem(429).ProducesProblem(503);
        admin.MapPut("/preview/{previewId:guid}/{index:int:min(0)}", Publish)
            .ProducesProblem(401).ProducesProblem(403).ProducesProblem(404).ProducesProblem(429);
        admin.MapPost("/popular/import", ImportPopular).ProducesValidationProblem().ProducesProblem(401)
            .ProducesProblem(403).ProducesProblem(429).ProducesProblem(503);
    }

    private static async Task<PopularBatchResult> ImportPopular(PopularBatch request, IsThereAnyDeal source,
        StoredDeals store, TimeProvider clock, CancellationToken ct)
    {
        request.Validate();
        var offers = (await source.PopularOffers(request.Count, ct)).DistinctBy(deal => deal.Id).ToArray();
        var added = await store.InsertMissing(offers, clock.GetUtcNow().AddHours(24), ct);
        return new(request.Count, offers.Length, added);
    }

    private static async Task<DealPreview> Preview(IsThereAnyDeal source, IMemoryCache cache, ClaimsPrincipal user,
        TimeProvider clock, CancellationToken ct, [FromQuery] int offset = 0, [FromQuery] string? q = null,
        [FromQuery] bool popular = false)
    {
        var page = await DealsEndpoints.Query(source, offset, "discount", q, null, popular, ct);
        var previewId = Guid.NewGuid();
        cache.Set((user.GetOwnerId(), previewId),
            new PreviewOfferPage(page.Items, popular, clock.GetUtcNow().AddHours(24)), TimeSpan.FromMinutes(10));
        return new(previewId, page.Items, page.NextOffset);
    }

    private static async Task<Results<NoContent, ProblemHttpResult>> Publish(Guid previewId, int index,
        ClaimsPrincipal user, IMemoryCache cache, StoredDeals store, CancellationToken ct)
    {
        if (!cache.TryGetValue<PreviewOfferPage>((user.GetOwnerId(), previewId), out var preview) ||
            preview is null || index >= preview.Items.Count)
            return TypedResults.Problem(statusCode: 404, title: "Oferta indisponível. Consulte as promoções novamente.");

        await store.Publish(preview.Items[index], preview.Popular, preview.ExpiresAt, ct);
        return TypedResults.NoContent();
    }

    private sealed record DealPreview(Guid PreviewId, IReadOnlyList<GameDeal> Items, int? NextOffset);
    private sealed record PreviewOfferPage(IReadOnlyList<GameDeal> Items, bool Popular, DateTimeOffset ExpiresAt);
}
