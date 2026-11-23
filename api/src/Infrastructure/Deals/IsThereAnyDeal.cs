using System.Globalization;
using System.Net.Http.Json;
using System.Text.Json;
using GamesBacklog.Application;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;

namespace GamesBacklog.Infrastructure.Deals;

public sealed class IsThereAnyDealOptions
{
    public string? ApiKey { get; set; }
}

public sealed class IsThereAnyDeal(HttpClient http, IOptions<IsThereAnyDealOptions> options, IMemoryCache cache) : IGameDeals
{
    private const int PopularReviewMinimum = 1000;

    public bool IsConfigured => !string.IsNullOrWhiteSpace(options.Value.ApiKey);

    public async Task<GameDealsPage> List(int offset, DealSort sort, DealShop? shop, bool popular, CancellationToken ct)
    {
        if (!IsConfigured) throw new DealsNotConfiguredException();

        var cacheKey = (typeof(IsThereAnyDeal), offset, sort, shop, popular);
        if (cache.TryGetValue<GameDealsPage>(cacheKey, out var cached) && cached is not null) return cached;

        var sortValue = sort == DealSort.Price ? "price" : "-cut";
        var path = $"deals/v2?country=BR&limit=20&offset={offset.ToString(CultureInfo.InvariantCulture)}&sort={sortValue}{ShopQuery(shop)}";
        if (popular)
        {
            var filter = JsonSerializer.Serialize(new { steamCount = new { min = PopularReviewMinimum, max = (int?)null } });
            path += "&filter=" + Uri.EscapeDataString(filter);
        }

        using var request = new HttpRequestMessage(HttpMethod.Get, path);
        var page = await Read<ProviderPage>(request, ct);
        if (page.List is null) throw new DealsUnavailableException();

        var items = page.List.Select(MapDeal).OfType<GameDeal>().ToArray();
        var nextOffset = page.HasMore && page.NextOffset > offset ? page.NextOffset : null;
        return cache.Set(cacheKey, new GameDealsPage(items, nextOffset), TimeSpan.FromMinutes(5));
    }

    public async Task<GameDealsPage> Search(string title, DealSort sort, DealShop? shop, CancellationToken ct)
    {
        var query = Uri.EscapeDataString(title);
        using var search = new HttpRequestMessage(HttpMethod.Get, $"games/search/v1?title={query}&results=20");
        var games = (await Read<ProviderGame[]>(search, ct))
            .Where(game => game.Id != Guid.Empty && !game.Mature)
            .DistinctBy(game => game.Id).ToDictionary(game => game.Id);
        if (games.Count == 0) return new([], null);

        using var prices = new HttpRequestMessage(HttpMethod.Post, "games/prices/v3?country=BR&deals=true" + ShopQuery(shop))
        {
            Content = JsonContent.Create(games.Keys.ToArray())
        };
        var result = await Read<ProviderPrices[]>(prices, ct);
        var offers = new List<GameDeal>();
        foreach (var entry in result)
        {
            if (!games.TryGetValue(entry.Id, out var game)) continue;

            var discounts = (entry.Deals ?? []).Where(deal => deal.Cut > 0)
                .Select(deal => MapDeal(game with { Deal = deal })).OfType<GameDeal>();
            var best = Order(discounts, sort).FirstOrDefault();
            if (best is not null) offers.Add(best);
        }

        return new(Order(offers, sort).ToArray(), null);
    }

    private static string ShopQuery(DealShop? shop) => shop switch
    {
        DealShop.Steam => "&shops=61",
        DealShop.Gog => "&shops=35",
        DealShop.Nuuvem => "&shops=50",
        _ => ""
    };

    private static IOrderedEnumerable<GameDeal> Order(IEnumerable<GameDeal> offers, DealSort sort) =>
        sort == DealSort.Price
            ? offers.OrderBy(deal => deal.Currency).ThenBy(deal => deal.Price)
            : offers.OrderByDescending(deal => deal.Discount).ThenBy(deal => deal.Title);

    private async Task<T> Read<T>(HttpRequestMessage request, CancellationToken ct) where T : class
    {
        if (!IsConfigured) throw new DealsNotConfiguredException();
        request.Headers.Add("ITAD-API-Key", options.Value.ApiKey!.Trim());

        try
        {
            using var response = await http.SendAsync(request, ct);
            if (!response.IsSuccessStatusCode) throw new DealsUnavailableException();

            return await response.Content.ReadFromJsonAsync<T>(cancellationToken: ct)
                ?? throw new DealsUnavailableException();
        }
        catch (Exception error) when (error is HttpRequestException or JsonException or IOException ||
            error is OperationCanceledException && !ct.IsCancellationRequested)
        {
            throw new DealsUnavailableException();
        }
    }

    private static GameDeal? MapDeal(ProviderGame game)
    {
        var deal = game.Deal;
        if (game.Id == Guid.Empty || string.IsNullOrWhiteSpace(game.Title) ||
            string.IsNullOrWhiteSpace(deal?.Shop?.Name) || deal.Price is null ||
            deal.Price.Currency is not { Length: 3 } currency || !IsHttps(deal.Url)) return null;

        var image = game.Assets?.Boxart;
        return new(game.Id, game.Title, deal.Shop.Name, deal.Price.Amount,
            deal.Regular?.Currency == currency ? deal.Regular.Amount : null,
            currency, deal.Cut, deal.Url!, IsHttps(image) ? image : null);
    }

    private static bool IsHttps(string? value) => Uri.TryCreate(value, UriKind.Absolute, out var url) &&
        url.Scheme == Uri.UriSchemeHttps && url.UserInfo.Length == 0;

    private sealed record ProviderPage(ProviderGame[]? List, bool HasMore, int? NextOffset);
    private sealed record ProviderGame(Guid Id, string? Title, ProviderAssets? Assets, ProviderDeal? Deal, bool Mature);
    private sealed record ProviderPrices(Guid Id, ProviderDeal[]? Deals);
    private sealed record ProviderAssets(string? Boxart);
    private sealed record ProviderDeal(ProviderShop? Shop, Money? Price, Money? Regular, int Cut, string? Url);
    private sealed record ProviderShop(string? Name);
    private sealed record Money(decimal Amount, string? Currency);
}
