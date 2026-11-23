using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.RegularExpressions;
using GamesBacklog.Infrastructure.Persistence;

namespace GamesBacklog.Infrastructure.PlayStation;

public sealed record PsnTitle(string Id, string Title, string Platform, string? CoverUrl, TrophyCounts? Trophies);
public sealed record PsnLibrary(IReadOnlyList<PsnTitle> Titles, bool Truncated);
public enum PsnFailure { AccessDenied, RateLimited, Unavailable }
public sealed class PsnSyncException(PsnFailure failure) : Exception("PlayStation Network query failed.")
{
    public PsnFailure Failure { get; } = failure;
}

public sealed partial class PsnTrophyClient(HttpClient http)
{
    private const int PageSize = 100;
    public const int PreviewLimit = 500;

    public async Task<PsnLibrary> ReadLibrary(string accessToken, CancellationToken ct)
    {
        var titles = new Dictionary<string, PsnTitle>(StringComparer.Ordinal);
        var offset = 0;
        var hasMore = true;
        while (offset < PreviewLimit && hasMore)
        {
            var page = await ReadPage(accessToken, offset, ct);
            foreach (var title in page.TrophyTitles!)
            {
                var mapped = Map(title);
                if (mapped is not null) titles.TryAdd(mapped.Id, mapped);
            }
            var nextOffset = page.NextOffset ?? (offset + page.TrophyTitles!.Length);
            hasMore = page.TrophyTitles!.Length > 0 && nextOffset > offset &&
                (page.NextOffset.HasValue || nextOffset < page.TotalItemCount);
            offset = nextOffset;
        }

        return new(titles.Values.Take(PreviewLimit).ToArray(), hasMore || titles.Count > PreviewLimit);
    }

    private async Task<ProviderPage> ReadPage(string accessToken, int offset, CancellationToken ct)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get,
            FormattableString.Invariant($"v1/users/me/trophyTitles?limit={Math.Min(PageSize, PreviewLimit - offset)}&offset={offset}"));
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        try
        {
            using var response = await http.SendAsync(request, ct);
            if (response.StatusCode is HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden)
                throw new PsnSyncException(PsnFailure.AccessDenied);
            if (response.StatusCode == HttpStatusCode.TooManyRequests)
                throw new PsnSyncException(PsnFailure.RateLimited);
            if (!response.IsSuccessStatusCode)
                throw new PsnSyncException(PsnFailure.Unavailable);

            var page = await response.Content.ReadFromJsonAsync<ProviderPage>(cancellationToken: ct);
            return page is { TrophyTitles: not null } ? page : throw new PsnSyncException(PsnFailure.Unavailable);
        }
        catch (Exception error) when (error is HttpRequestException or JsonException or IOException ||
            error is OperationCanceledException && !ct.IsCancellationRequested)
        {
            throw new PsnSyncException(PsnFailure.Unavailable);
        }
    }

    private static PsnTitle? Map(ProviderTitle? title)
    {
        if (title?.NpCommunicationId is not { } id || !TrophyId().IsMatch(id) ||
            string.IsNullOrWhiteSpace(title.TrophyTitleName) || title.TrophyTitleName.Contains('\0'))
            return null;

        var systems = title.TrophyTitlePlatform?.Split(',', StringSplitOptions.TrimEntries) ?? [];
        var platform = systems.Contains("PS5") ? "PlayStation 5" : systems.Contains("PS4") ? "PlayStation 4" :
            systems.Contains("PS3") ? "PlayStation 3" : systems.Contains("PSVITA") ? "PS Vita" : null;
        if (platform is null) return null;

        var name = title.TrophyTitleName.Trim();
        if (name.Length > 250) name = name[..(char.IsHighSurrogate(name[249]) ? 249 : 250)];
        var counts = title.EarnedTrophies;
        if (counts is not null && !ValidCounts(counts)) counts = null;
        return new(id, name, platform, TrustedCover(title.TrophyTitleIconUrl), counts);
    }

    private static bool ValidCounts(TrophyCounts counts) =>
        new[] { counts.Bronze, counts.Silver, counts.Gold, counts.Platinum }.All(value => value is >= 0 and <= 9999);

    private static string? TrustedCover(string? value)
    {
        if (!Uri.TryCreate(value, UriKind.Absolute, out var uri) || uri.Scheme != "https" ||
            uri.UserInfo.Length > 0 || !uri.IsDefaultPort) return null;
        return uri.Host.EndsWith(".playstation.com", StringComparison.OrdinalIgnoreCase) ||
            uri.Host.EndsWith(".playstation.net", StringComparison.OrdinalIgnoreCase) ? uri.AbsoluteUri : null;
    }

    [GeneratedRegex("^[A-Z0-9_-]{1,32}$", RegexOptions.CultureInvariant)]
    private static partial Regex TrophyId();

    private sealed record ProviderPage(ProviderTitle?[]? TrophyTitles, int TotalItemCount, int? NextOffset);
    private sealed record ProviderTitle(string? NpCommunicationId, string? TrophyTitleName,
        string? TrophyTitlePlatform, string? TrophyTitleIconUrl, TrophyCounts? EarnedTrophies);
}
