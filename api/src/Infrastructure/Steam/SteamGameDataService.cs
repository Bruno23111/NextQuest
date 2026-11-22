using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using GamesBacklog.Application;
using GamesBacklog.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace GamesBacklog.Infrastructure.Steam;

public sealed class SteamApiOptions
{
    public string? ApiKey { get; set; }
}

public sealed class SteamGameDataService(
    HttpClient client,
    BacklogDbContext db,
    IOptions<SteamApiOptions> options) : ISteamGameDataService
{
    public async Task<SteamLibrary> GetLibrary(Guid ownerId, CancellationToken ct)
    {
        var steamId = await GetSteamId(ownerId, ct);
        var result = await Read<OwnedGamesEnvelope>(
            "IPlayerService/GetOwnedGames/v1/",
            $"steamid={Uri.EscapeDataString(steamId)}&include_appinfo=true&include_played_free_games=true",
            ct);

        var response = result.Response ?? throw new SteamUnavailableException();
        var games = (response.Games ?? []).Where(game => game.AppId > 0 && !string.IsNullOrWhiteSpace(game.Name))
            .Select(game => new SteamLibraryGame(
                game.AppId,
                Limit(game.Name!, 250),
                Math.Max(0, game.PlaytimeForever),
                game.PlaytimeTwoWeeks is >= 0 ? game.PlaytimeTwoWeeks : null,
                BuildGameIcon(game.AppId, game.IconHash)))
            .OrderByDescending(game => game.PlaytimeForeverMinutes)
            .ToArray();

        return new(response.GameCount ?? games.Length, games);
    }

    public async Task<SteamGameAchievements> GetAchievements(Guid ownerId, int appId, CancellationToken ct)
    {
        if (appId <= 0)
            throw new FluentValidation.ValidationException([
                new FluentValidation.Results.ValidationFailure("appId", "Informe um appId válido.")]);

        var steamId = await GetSteamId(ownerId, ct);
        var result = await Read<PlayerAchievementsEnvelope>(
            "ISteamUserStats/GetPlayerAchievements/v1/",
            $"steamid={Uri.EscapeDataString(steamId)}&appid={appId.ToString(CultureInfo.InvariantCulture)}",
            ct);

        var stats = result.PlayerStats ?? throw new SteamGameDataPrivateException();
        if (!stats.Success) throw new SteamGameDataPrivateException();

        var achievements = (stats.Achievements ?? []).Where(item => !string.IsNullOrWhiteSpace(item.ApiName))
            .Select(item => new SteamAchievement(
                Limit(item.ApiName!, 200),
                Limit(string.IsNullOrWhiteSpace(item.Name) ? item.ApiName! : item.Name!, 200),
                string.IsNullOrWhiteSpace(item.Description) ? null : Limit(item.Description!, 1000),
                item.Achieved == 1,
                item.UnlockTime is > 0
                    ? DateTimeOffset.FromUnixTimeSeconds(item.UnlockTime.Value)
                    : null,
                HttpsUrl(item.Icon),
                HttpsUrl(item.IconGray)))
            .ToArray();

        return new(appId, Limit(stats.GameName ?? "Jogo Steam", 250),
            achievements.Count(item => item.Achieved), achievements.Length, achievements);
    }

    private async Task<string> GetSteamId(Guid ownerId, CancellationToken ct)
    {
        var steamId = await db.Users.Where(user => user.Id == ownerId).Select(user => user.SteamId)
            .SingleOrDefaultAsync(ct);
        return !string.IsNullOrWhiteSpace(steamId) ? steamId : throw new SteamAccountNotLinkedException();
    }

    private async Task<T> Read<T>(string endpoint, string parameters, CancellationToken ct) where T : class
    {
        if (string.IsNullOrWhiteSpace(options.Value.ApiKey)) throw new SteamGameDataUnavailableException();

        var url = $"{endpoint}?{parameters}&key={Uri.EscapeDataString(options.Value.ApiKey)}";
        try
        {
            using var response = await client.GetAsync(url, ct);
            if (response.StatusCode is HttpStatusCode.Forbidden or HttpStatusCode.NotFound)
                throw new SteamGameDataPrivateException();
            if (!response.IsSuccessStatusCode) throw new SteamGameDataUnavailableException();

            return await response.Content.ReadFromJsonAsync<T>(cancellationToken: ct)
                ?? throw new SteamGameDataUnavailableException();
        }
        catch (Exception error) when (error is HttpRequestException or JsonException or IOException ||
            error is OperationCanceledException && !ct.IsCancellationRequested)
        {
            throw new SteamGameDataUnavailableException();
        }
    }

    private static string? BuildGameIcon(int appId, string? hash) =>
        appId > 0 && !string.IsNullOrWhiteSpace(hash) && hash.All(Uri.IsHexDigit)
            ? $"https://media.steampowered.com/steamcommunity/public/images/apps/{appId.ToString(CultureInfo.InvariantCulture)}/{hash}.jpg"
            : null;

    private static string? HttpsUrl(string? value) =>
        Uri.TryCreate(value, UriKind.Absolute, out var uri) && uri.Scheme == Uri.UriSchemeHttps
            ? uri.AbsoluteUri
            : null;

    private static string Limit(string value, int maxLength) =>
        value.Length <= maxLength ? value : value[..maxLength];

    private sealed record OwnedGamesEnvelope([property: JsonPropertyName("response")] OwnedGamesResponse? Response);
    private sealed record OwnedGamesResponse(
        [property: JsonPropertyName("game_count")] int? GameCount,
        [property: JsonPropertyName("games")] OwnedGame[]? Games);
    private sealed record OwnedGame(
        [property: JsonPropertyName("appid")] int AppId,
        [property: JsonPropertyName("name")] string? Name,
        [property: JsonPropertyName("playtime_forever")] int PlaytimeForever,
        [property: JsonPropertyName("playtime_2weeks")] int? PlaytimeTwoWeeks,
        [property: JsonPropertyName("img_icon_url")] string? IconHash);

    private sealed record PlayerAchievementsEnvelope(
        [property: JsonPropertyName("playerstats")] PlayerAchievements? PlayerStats);
    private sealed record PlayerAchievements(
        [property: JsonPropertyName("success")] bool Success,
        [property: JsonPropertyName("gameName")] string? GameName,
        [property: JsonPropertyName("achievements")] Achievement[]? Achievements);
    private sealed record Achievement(
        [property: JsonPropertyName("apiname")] string? ApiName,
        [property: JsonPropertyName("name")] string? Name,
        [property: JsonPropertyName("description")] string? Description,
        [property: JsonPropertyName("achieved")] int Achieved,
        [property: JsonPropertyName("unlocktime")] long? UnlockTime,
        [property: JsonPropertyName("icon")] string? Icon,
        [property: JsonPropertyName("icongray")] string? IconGray);
}
