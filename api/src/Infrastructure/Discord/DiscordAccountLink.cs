using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text.Json;
using System.Text.Json.Serialization;
using FluentValidation;
using GamesBacklog.Application;
using GamesBacklog.Infrastructure.Persistence;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Npgsql;

namespace GamesBacklog.Infrastructure.Discord;

public sealed class DiscordOAuthOptions
{
    public string? ClientId { get; set; }
    public string? ClientSecret { get; set; }
    public string? RedirectUri { get; set; }

    public bool Enabled => !string.IsNullOrWhiteSpace(ClientId) && !string.IsNullOrWhiteSpace(ClientSecret) &&
        Uri.TryCreate(RedirectUri, UriKind.Absolute, out var uri) &&
        (uri.Scheme == "https" || uri.Scheme == "http" && uri.IsLoopback);
}

public sealed class DiscordAccountLink(HttpClient http, BacklogDbContext db,
    IOptions<DiscordOAuthOptions> options, IDataProtectionProvider protection) : IDiscordAccountLink
{
    private readonly ITimeLimitedDataProtector stateProtector =
        protection.CreateProtector("NextQuest.DiscordOAuth.v1").ToTimeLimitedDataProtector();
    private readonly IDataProtector webhookProtector = protection.CreateProtector("NextQuest.DiscordWebhook.v1");

    public async Task<DiscordConnection> Get(Guid ownerId, CancellationToken ct)
    {
        var user = await db.Users.AsNoTracking().Where(x => x.Id == ownerId)
            .Select(x => new { x.DiscordUserId, x.DiscordName, x.DiscordAvatar, Configured = x.DiscordWebhookSecret != null })
            .SingleOrDefaultAsync(ct) ?? throw new ProfileNotFoundException();

        var avatarUrl = user.DiscordUserId is not null && IsAvatarHash(user.DiscordAvatar)
            ? $"https://cdn.discordapp.com/avatars/{user.DiscordUserId}/{user.DiscordAvatar}.png"
            : null;
        return new(user.Configured, options.Value.Enabled, user.DiscordName, avatarUrl);
    }

    public string Start(Guid ownerId, bool chooseChannel)
    {
        var settings = RequireSettings();
        var state = stateProtector.Protect($"{ownerId:D}:{(chooseChannel ? '1' : '0')}", TimeSpan.FromMinutes(10));
        return QueryHelpers.AddQueryString("https://discord.com/oauth2/authorize", new Dictionary<string, string?>
        {
            ["client_id"] = settings.ClientId,
            ["redirect_uri"] = settings.RedirectUri,
            ["response_type"] = "code",
            ["scope"] = chooseChannel ? "identify webhook.incoming" : "identify",
            ["prompt"] = "consent",
            ["state"] = state
        });
    }

    public async Task Complete(Guid ownerId, string code, string state, CancellationToken ct)
    {
        var settings = RequireSettings();
        var selectChannel = ValidateState(ownerId, state);
        var token = await ExchangeCode(settings, code, ct);
        using var request = new HttpRequestMessage(HttpMethod.Get, "users/@me");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token.AccessToken);
        using var response = await Send(request, ct);
        var identity = await Read<DiscordIdentity>(response, ct);
        if (!ulong.TryParse(identity.Id, out _) || string.IsNullOrWhiteSpace(identity.Username))
            throw new DiscordUnavailableException();

        var secret = selectChannel
            ? DiscordSharing.ProtectWebhook(token.Webhook?.Url ?? throw new DiscordUnavailableException(), webhookProtector)
            : null;
        var name = string.IsNullOrWhiteSpace(identity.GlobalName) ? identity.Username : identity.GlobalName;

        try
        {
            var user = db.Users.Where(x => x.Id == ownerId &&
                (x.DiscordUserId == null || x.DiscordUserId == identity.Id));
            var updated = await user.ExecuteUpdateAsync(update => update
                .SetProperty(x => x.DiscordUserId, identity.Id)
                .SetProperty(x => x.DiscordName, name)
                .SetProperty(x => x.DiscordAvatar, identity.Avatar)
                .SetProperty(x => x.DiscordWebhookSecret, x => selectChannel ? secret : x.DiscordWebhookSecret), ct);
            if (updated == 0) throw new DiscordLinkConflictException();
        }
        catch (PostgresException error) when (error.SqlState == PostgresErrorCodes.UniqueViolation &&
            error.ConstraintName == "IX_Users_DiscordUserId")
        {
            throw new DiscordLinkConflictException();
        }
    }

    public async Task Disconnect(Guid ownerId, CancellationToken ct)
    {
        var updated = await db.Users.Where(x => x.Id == ownerId).ExecuteUpdateAsync(update => update
            .SetProperty(x => x.DiscordUserId, (string?)null)
            .SetProperty(x => x.DiscordName, (string?)null)
            .SetProperty(x => x.DiscordAvatar, (string?)null)
            .SetProperty(x => x.DiscordWebhookSecret, (string?)null), ct);
        if (updated == 0) throw new ProfileNotFoundException();
    }

    private DiscordOAuthOptions RequireSettings() =>
        options.Value.Enabled ? options.Value : throw new DiscordOAuthNotConfiguredException();

    private bool ValidateState(Guid ownerId, string state)
    {
        string? value = null;
        try { value = stateProtector.Unprotect(state); }
        catch (CryptographicException) { }

        if (value == $"{ownerId:D}:1") return true;
        if (value == $"{ownerId:D}:0") return false;
        throw new ValidationException([new("state", "Autorização Discord inválida ou expirada.")]);
    }

    private async Task<DiscordToken> ExchangeCode(DiscordOAuthOptions settings, string code, CancellationToken ct)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, "oauth2/token");
        request.Content = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["client_id"] = settings.ClientId!,
            ["client_secret"] = settings.ClientSecret!,
            ["redirect_uri"] = settings.RedirectUri!,
            ["grant_type"] = "authorization_code",
            ["code"] = code
        });
        using var response = await Send(request, ct);
        if (response.StatusCode == HttpStatusCode.BadRequest)
            throw new ValidationException([new("code", "Autorização Discord expirada ou já utilizada.")]);
        var token = await Read<DiscordToken>(response, ct);
        if (string.IsNullOrWhiteSpace(token.AccessToken)) throw new DiscordUnavailableException();
        return token;
    }

    private async Task<HttpResponseMessage> Send(HttpRequestMessage request, CancellationToken ct)
    {
        try { return await http.SendAsync(request, ct); }
        catch (Exception error) when (error is HttpRequestException ||
            error is OperationCanceledException && !ct.IsCancellationRequested)
        {
            throw new DiscordUnavailableException();
        }
    }

    private static async Task<T> Read<T>(HttpResponseMessage response, CancellationToken ct)
    {
        if (!response.IsSuccessStatusCode) throw new DiscordUnavailableException();
        try
        {
            return await response.Content.ReadFromJsonAsync<T>(cancellationToken: ct)
                ?? throw new DiscordUnavailableException();
        }
        catch (JsonException) { throw new DiscordUnavailableException(); }
    }

    private static bool IsAvatarHash(string? avatar) => avatar is not null &&
        (avatar.StartsWith("a_", StringComparison.Ordinal) ? avatar[2..] : avatar) is { Length: 32 } hash &&
        hash.All(Uri.IsHexDigit);

    private sealed record DiscordToken([property: JsonPropertyName("access_token")] string? AccessToken, Webhook? Webhook);
    private sealed record Webhook(string? Url);
    private sealed record DiscordIdentity(string Id, string Username,
        [property: JsonPropertyName("global_name")] string? GlobalName, string? Avatar);
}
