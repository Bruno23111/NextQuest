using FluentValidation;
using GamesBacklog.Application;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;

namespace GamesBacklog.Api.Endpoints;

internal static class DealsEndpoints
{
    internal static void MapDeals(this RouteGroupBuilder api) =>
        api.MapGet("/deals", List).WithName("ListGameDeals").WithTags("Promoções")
            .RequireAuthorization().RequireRateLimiting("catalog")
            .ProducesValidationProblem().ProducesProblem(401).ProducesProblem(429);

    private static async Task<Ok<GameDealsPage>> List(IGameDeals deals, CancellationToken ct,
        [FromQuery] int offset = 0, [FromQuery] string sort = "discount", [FromQuery] string? q = null,
        [FromQuery] string? shop = null, [FromQuery] bool popular = false)
        => TypedResults.Ok(await Query(deals, offset, sort, q, shop, popular, ct));

    internal static async Task<GameDealsPage> Query(IGameDeals deals, int offset, string sort,
        string? q, string? shop, bool popular, CancellationToken ct)
    {
        if (offset is < 0 or > 100000)
            throw new ValidationException([new("offset", "Informe uma posição válida.")]);

        var order = sort switch
        {
            "discount" => DealSort.Discount,
            "price" => DealSort.Price,
            _ => throw new ValidationException([new("sort", "Informe discount ou price.")])
        };
        DealShop? selectedShop = shop switch
        {
            null => null,
            "steam" => DealShop.Steam,
            "gog" => DealShop.Gog,
            "nuuvem" => DealShop.Nuuvem,
            _ => throw new ValidationException([new("shop", "Selecione Steam, GOG ou Nuuvem.")])
        };
        var title = q?.Trim();
        if (title?.Length > 120)
            throw new ValidationException([new("q", "Pesquise com até 120 caracteres.")]);

        if (popular && !string.IsNullOrEmpty(title))
            throw new ValidationException([new("popular", "Use o filtro de popularidade na lista geral.")]);

        return string.IsNullOrEmpty(title)
            ? await deals.List(offset, order, selectedShop, popular, ct)
            : await deals.Search(title, order, selectedShop, ct);
    }
}
