using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using GamesBacklog.Application;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace GamesBacklog.Infrastructure.Catalog;

public sealed class RawgOptions
{
    public string? ApiKey { get; set; }
}

public sealed class RawgCatalog(HttpClient client, IOptions<RawgOptions> options, ILogger<RawgCatalog>? logger = null)
    : IGameCatalog, IPopularGameCatalog
{
    public const int PageSize = 20;
    public const int PopularPageSize = 40;
    public const int MaxPopularGames = 500;
    public const int MaxPopularPages = (MaxPopularGames + PopularPageSize - 1) / PopularPageSize;

    public Task<PagedResult<CatalogGame>> Popular(int pageNumber, CancellationToken ct) =>
        Discover(pageNumber, "ordering=-added", ct);

    public Task<PagedResult<CatalogGame>> NewReleases(int pageNumber, DateOnly today, CancellationToken ct) =>
        Discover(pageNumber, FormattableString.Invariant(
            $"ordering=-released&dates={today.AddMonths(-12):yyyy-MM-dd},{today:yyyy-MM-dd}"), ct);

    private async Task<PagedResult<CatalogGame>> Discover(int pageNumber, string filters, CancellationToken ct)
    {
        if (pageNumber is < 1 or > MaxPopularPages)
            throw new FluentValidation.ValidationException([
                new FluentValidation.Results.ValidationFailure("page", $"Informe uma página entre 1 e {MaxPopularPages}.")]);

        var remaining = MaxPopularGames - ((pageNumber - 1) * PopularPageSize);
        var pageSize = Math.Min(PopularPageSize, remaining);
        var page = await Read<RawgPage>(
            $"games?{filters}&page={pageNumber.ToString(CultureInfo.InvariantCulture)}&page_size={PopularPageSize}", ct)
            ?? throw new CatalogUnavailableException();

        return new(MapGames(page).Take(pageSize).ToArray(), pageNumber, pageSize,
            pageNumber < MaxPopularPages && !string.IsNullOrEmpty(page.Next));
    }

    public async Task<PagedResult<CatalogGame>> Search(CatalogQuery query, CancellationToken ct)
    {
        var search = Uri.EscapeDataString(query.Q.Trim());
        var pageNumber = query.Page.ToString(CultureInfo.InvariantCulture);
        var page = await Read<RawgPage>(
            $"games?search={search}&page={pageNumber}&page_size={PageSize}", ct)
            ?? throw new CatalogUnavailableException();

        return new(MapGames(page), query.Page, PageSize, !string.IsNullOrEmpty(page.Next));
    }

    public async Task<CatalogGame?> Find(int rawgId, CancellationToken ct)
    {
        var game = await Read<RawgGame>($"games/{rawgId.ToString(CultureInfo.InvariantCulture)}?", ct,
            allowNotFound: true);
        return game is null ? null : ToGame(game) ?? throw new CatalogUnavailableException();
    }

    private async Task<T?> Read<T>(string path, CancellationToken ct, bool allowNotFound = false)
        where T : class
    {
        if (string.IsNullOrWhiteSpace(options.Value.ApiKey))
            throw new CatalogUnavailableException(CatalogFailure.MissingKey);

        var separator = path.EndsWith('?') ? "" : "&";
        var url = path + separator + "key=" + Uri.EscapeDataString(options.Value.ApiKey.Trim());
        for (var attempt = 1; ; attempt++)
        {
            try
            {
                using var response = await client.GetAsync(url, ct);
                if (allowNotFound && response.StatusCode == HttpStatusCode.NotFound) return null;
                if (response.IsSuccessStatusCode)
                    return await response.Content.ReadFromJsonAsync<T>(cancellationToken: ct)
                        ?? throw new CatalogUnavailableException();

                logger?.LogWarning("RAWG returned HTTP {StatusCode} on attempt {Attempt}.",
                    (int)response.StatusCode, attempt);
                var failure = response.StatusCode switch
                {
                    HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden => CatalogFailure.RejectedKey,
                    HttpStatusCode.TooManyRequests => CatalogFailure.RateLimited,
                    _ => CatalogFailure.Unavailable
                };
                if (attempt == 2 || (int)response.StatusCode < 500)
                    throw new CatalogUnavailableException(failure);
            }
            catch (JsonException)
            {
                logger?.LogWarning("RAWG returned an unreadable JSON response.");
                throw new CatalogUnavailableException();
            }
            catch (Exception ex) when (ex is HttpRequestException or IOException ||
                ex is OperationCanceledException && !ct.IsCancellationRequested)
            {
                logger?.LogWarning("RAWG request failed ({FailureType}) on attempt {Attempt}.",
                    ex.GetType().Name, attempt);
                if (attempt == 2) throw new CatalogUnavailableException();
            }

            await Task.Delay(TimeSpan.FromMilliseconds(400), ct);
        }
    }

    private static CatalogGame[] MapGames(RawgPage page) =>
        (page.Results ?? throw new CatalogUnavailableException())
            .OfType<RawgGame>()
            .Select(ToGame)
            .OfType<CatalogGame>()
            .ToArray();

    private static CatalogGame? ToGame(RawgGame game)
    {
        if (game.Id <= 0 || string.IsNullOrWhiteSpace(game.Name) || game.Name.Contains('\0')) return null;

        var platforms = (game.Platforms ?? []).Select(x => x?.Platform)
            .Where(x => x is { Id: > 0 } && !string.IsNullOrWhiteSpace(x.Name) && !x.Name.Contains('\0'))
            .Select(x => new CatalogPlatform(x!.Id, Limit(x.Name!, 100))).DistinctBy(x => x.Id).ToArray();
        var cover = Uri.TryCreate(game.BackgroundImage, UriKind.Absolute, out var image) && image.Scheme == Uri.UriSchemeHttps
            ? image.AbsoluteUri : null;

        var score = game.Metacritic is >= 0 and <= 100 ? game.Metacritic : null;
        var reviews = Uri.TryCreate(game.MetacriticUrl, UriKind.Absolute, out var url) &&
            url.Scheme == Uri.UriSchemeHttps && url.UserInfo.Length == 0 &&
            (url.Host is "www.metacritic.com" or "metacritic.com") ? url.AbsoluteUri : null;

        return new(game.Id, Limit(game.Name, 250), cover, platforms, score, reviews);
    }

    private static string Limit(string value, int maxLength)
    {
        var trimmed = value.Trim();
        if (trimmed.Length <= maxLength) return trimmed;
        // Preserve a complete Unicode character when the limit splits a surrogate pair.
        return trimmed[..(char.IsHighSurrogate(trimmed[maxLength - 1]) ? maxLength - 1 : maxLength)];
    }
}
