using System.Net.Http.Json;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.Options;

namespace GamesBacklog.Infrastructure.Videos;

public sealed class YouTubeOptions
{
    public string? ApiKey { get; init; }
}

public sealed record YouTubeVideo(string Id, string Title, string Channel, string? ThumbnailUrl, bool CanPlayHere = false);
public sealed class YouTubeUnavailableException(string message) : Exception(message);

public sealed partial class YouTubeClient(HttpClient http, IOptions<YouTubeOptions> options)
{
    public bool Available => !string.IsNullOrWhiteSpace(options.Value.ApiKey);
    public static bool ValidId(string? value) => value is not null && VideoId().IsMatch(value);

    public async Task<YouTubeVideo[]> Search(string query, CancellationToken ct)
    {
        var response = await Read<SearchItem>("search", new Dictionary<string, string?>
        {
            ["part"] = "snippet", ["type"] = "video", ["videoCategoryId"] = "20",
            ["videoEmbeddable"] = "true", ["safeSearch"] = "moderate", ["maxResults"] = "20",
            ["q"] = query
        }, ct);
        return response.Select(item => Map(item.Id?.VideoId, item.Snippet)).OfType<YouTubeVideo>()
            .DistinctBy(item => item.Id).ToArray();
    }

    public async Task<YouTubeVideo[]> Details(IEnumerable<string> ids, CancellationToken ct)
    {
        var response = await Read<VideoItem>("videos", new Dictionary<string, string?>
        {
            ["part"] = "snippet,status", ["id"] = string.Join(',', ids)
        }, ct);
        return response.Where(item => item.Status is { Embeddable: true, PrivacyStatus: "public" or "unlisted" })
            .Select(item => Map(item.Id, item.Snippet, item.Status!.MadeForKids == false)).OfType<YouTubeVideo>().ToArray();
    }

    private async Task<T[]> Read<T>(string resource, Dictionary<string, string?> query, CancellationToken ct)
    {
        if (!Available) throw new YouTubeUnavailableException("Configure a chave da API do YouTube no servidor.");
        using var request = new HttpRequestMessage(HttpMethod.Get, QueryHelpers.AddQueryString(resource, query));
        request.Headers.Add("x-goog-api-key", options.Value.ApiKey!.Trim());
        try
        {
            using var response = await http.SendAsync(request, ct);
            if (!response.IsSuccessStatusCode)
                throw new YouTubeUnavailableException((int)response.StatusCode is 403 or 429
                    ? "O YouTube recusou a consulta. Confira a chave e a cota da API."
                    : "O YouTube está indisponível no momento. Tente novamente.");
            var result = await response.Content.ReadFromJsonAsync<Response<T>>(cancellationToken: ct);
            return result?.Items ?? throw new YouTubeUnavailableException("O YouTube retornou uma resposta inesperada.");
        }
        catch (Exception error) when (error is HttpRequestException or JsonException or IOException ||
            error is OperationCanceledException && !ct.IsCancellationRequested)
        {
            throw new YouTubeUnavailableException("Não foi possível consultar o YouTube. Tente novamente.");
        }
    }

    private static YouTubeVideo? Map(string? id, Snippet? snippet, bool canPlayHere = false)
    {
        if (!ValidId(id) || snippet is null || string.IsNullOrWhiteSpace(snippet.Title)) return null;
        var image = snippet.Thumbnails?.High?.Url ?? snippet.Thumbnails?.Medium?.Url;
        return new(id!, Normalize(snippet.Title), Normalize(snippet.ChannelTitle ?? ""),
            Uri.TryCreate(image, UriKind.Absolute, out var uri) && uri is { Scheme: "https", UserInfo.Length: 0 } &&
            uri.Host is "i.ytimg.com" or "img.youtube.com" ? uri.AbsoluteUri : null, canPlayHere);
    }

    private static string Normalize(string value) => System.Net.WebUtility.HtmlDecode(value).Replace("\0", "").Trim();

    [GeneratedRegex(@"\A[A-Za-z0-9_-]{11}\z", RegexOptions.CultureInvariant)]
    private static partial Regex VideoId();
    private sealed record Response<T>(T[]? Items);
    private sealed record SearchItem(SearchId? Id, Snippet? Snippet);
    private sealed record SearchId(string? VideoId);
    private sealed record VideoItem(string? Id, Snippet? Snippet, VideoStatus? Status);
    private sealed record VideoStatus(bool Embeddable, string? PrivacyStatus, bool? MadeForKids);
    private sealed record Snippet(string? Title, string? ChannelTitle, Images? Thumbnails);
    private sealed record Images(Image? High, Image? Medium);
    private sealed record Image(string? Url);
}
