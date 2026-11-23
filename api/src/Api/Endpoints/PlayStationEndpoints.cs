using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using FluentValidation;
using GamesBacklog.Application;
using GamesBacklog.Infrastructure.Persistence;
using GamesBacklog.Infrastructure.PlayStation;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.Caching.Memory;

namespace GamesBacklog.Api.Endpoints;

internal static partial class PlayStationEndpoints
{
    private const string OAuthCookie = "__Host-nextquest-psn";
    private static readonly TimeSpan OAuthLifetime = TimeSpan.FromMinutes(10);

    internal static void MapPlayStation(this RouteGroupBuilder api)
    {
        var games = api.MapGroup("/playstation/games").RequireAuthorization().WithTags("PlayStation");
        games.MapGet("", List).ProducesValidationProblem().ProducesProblem(401);
        games.MapPut("/{id:guid}/trophies", Save).Produces(204)
            .ProducesValidationProblem().ProducesProblem(401).ProducesProblem(404);

        var sync = api.MapGroup("/playstation/sync").RequireAuthorization().WithTags("PlayStation");
        sync.MapPost("/preview", Preview).RequireRateLimiting("psn")
            .ProducesValidationProblem().ProducesProblem(401).ProducesProblem(422)
            .ProducesProblem(429).ProducesProblem(503);
        sync.MapPost("/{previewId:guid}/confirm", Confirm).RequireRateLimiting("psn")
            .ProducesValidationProblem().ProducesProblem(401).ProducesProblem(429);
        sync.MapGet("/oauth", (PsnOAuthClient oauth) => new OAuthStatus(oauth.Settings.Available));
        sync.MapPost("/oauth/start", StartOAuth).RequireRateLimiting("psn").Produces<OAuthStart>()
            .ProducesProblem(401).ProducesProblem(503);
        sync.MapGet("/oauth/callback", CompleteOAuth).AllowAnonymous().RequireRateLimiting("psn")
            .Produces(302).ProducesProblem(400).ProducesProblem(503);
        sync.MapGet("/{previewId:guid}/preview", GetPreview).Produces<SyncPreview>()
            .ProducesProblem(401).ProducesProblem(404);
    }

    private static Task<PagedResult<PlayStationGame>> List(ClaimsPrincipal user, PlayStationStore store,
        CancellationToken ct, [FromQuery] string? q = null, [FromQuery] int page = 1)
    {
        if (page < 1 || page > int.MaxValue / PlayStationStore.PageSize)
            throw new ValidationException([new("page", "Informe uma página válida.")]);
        if (q?.Trim().Length > 120)
            throw new ValidationException([new("q", "Pesquise com até 120 caracteres.")]);

        return store.List(user.GetOwnerId(), q, page, ct);
    }

    private static async Task<IResult> Save(Guid id, TrophyCounts counts, ClaimsPrincipal user,
        PlayStationStore store, CancellationToken ct)
    {
        if (new[] { counts.Bronze, counts.Silver, counts.Gold, counts.Platinum }.Any(value => value is < 0 or > 9999))
            throw new ValidationException([new("counts", "Informe quantidades inteiras entre 0 e 9999.")]);
        return await store.SaveTrophies(user.GetOwnerId(), id, counts, ct)
            ? Results.NoContent()
            : Results.Problem(statusCode: 404, title: "Jogo PlayStation não encontrado na sua biblioteca.");
    }

    [RequestSizeLimit(8192)]
    private static async Task<SyncPreview> Preview(SyncRequest request, ClaimsPrincipal user,
        PsnTrophyClient client, IMemoryCache cache, CancellationToken ct)
    {
        var token = request.AccessToken?.Trim();
        if (token is not { Length: > 0 and <= 4096 } || !BearerToken().IsMatch(token))
            throw new ValidationException([new("accessToken", "Informe um token de acesso PSN válido.")]);

        return StorePreview(user.GetOwnerId(), await client.ReadLibrary(token, ct), cache);
    }

    private static IResult StartOAuth(ClaimsPrincipal user, HttpContext context, PsnOAuthClient oauth, IMemoryCache cache)
    {
        if (!oauth.Settings.Available)
            return Results.Problem(statusCode: 503, title: "A conexão OAuth da PSN ainda não está configurada.");

        var state = RandomValue();
        var verifier = RandomValue();
        var browser = RandomValue();
        cache.Set(("psn-oauth", state), new OAuthFlow(user.GetOwnerId(), verifier, browser), OAuthLifetime);
        context.Response.Cookies.Append(OAuthCookie, browser, OAuthCookieOptions());
        var challenge = WebEncoders.Base64UrlEncode(SHA256.HashData(Encoding.ASCII.GetBytes(verifier)));
        return Results.Ok(new OAuthStart(oauth.AuthorizationUrl(state, challenge)));
    }

    private static async Task<IResult> CompleteOAuth(HttpContext context, PsnOAuthClient oauth,
        PsnTrophyClient client, IMemoryCache cache, CancellationToken ct)
    {
        context.Response.Headers["Referrer-Policy"] = "no-referrer";
        if (!oauth.Settings.Available)
            return Results.Problem(statusCode: 503, title: "A conexão OAuth da PSN ainda não está configurada.");

        var query = context.Request.Query;
        var state = query["state"];
        var browser = context.Request.Cookies[OAuthCookie];
        if (state.Count != 1 || state[0] is not { Length: 43 } stateValue || browser is not { Length: 43 } ||
            !cache.TryGetValue<OAuthFlow>(("psn-oauth", stateValue), out var flow) || flow is null ||
            !CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(browser), Encoding.UTF8.GetBytes(flow.Browser)) ||
            !flow.Consume())
            return Results.Problem(statusCode: 400, title: "Conexão expirada ou aberta em outro navegador. Inicie novamente no NextQuest.");

        cache.Remove(("psn-oauth", stateValue));
        context.Response.Cookies.Delete(OAuthCookie, OAuthCookieOptions());
        var target = oauth.Settings.WebReturnUrl!.AbsoluteUri;
        if (query.ContainsKey("error"))
            return Results.Redirect(QueryHelpers.AddQueryString(target, "psnError", "denied"));

        var code = query["code"];
        if (code.Count != 1 || code[0] is not { Length: > 0 and <= 4096 } authorizationCode)
            return Results.Redirect(QueryHelpers.AddQueryString(target, "psnError", "denied"));

        try
        {
            var token = await oauth.Exchange(authorizationCode, flow.Verifier, ct);
            if (!BearerToken().IsMatch(token))
                throw new PsnSyncException(PsnFailure.AccessDenied);
            var preview = StorePreview(flow.Owner, await client.ReadLibrary(token, ct), cache);
            return Results.Redirect(QueryHelpers.AddQueryString(target, "psnPreview", preview.PreviewId.ToString()));
        }
        catch (PsnSyncException error)
        {
            var reason = error.Failure switch
            {
                PsnFailure.AccessDenied => "denied",
                PsnFailure.RateLimited => "limited",
                _ => "unavailable"
            };
            return Results.Redirect(QueryHelpers.AddQueryString(target, "psnError", reason));
        }
    }

    private static IResult GetPreview(Guid previewId, ClaimsPrincipal user, IMemoryCache cache) =>
        cache.TryGetValue<SyncPreview>(CacheKey(user.GetOwnerId(), previewId), out var preview) && preview is not null
            ? Results.Ok(preview)
            : Results.Problem(statusCode: 404, title: "A prévia expirou. Consulte a PSN novamente.");

    private static SyncPreview StorePreview(Guid owner, PsnLibrary library, IMemoryCache cache)
    {
        var preview = new SyncPreview(Guid.NewGuid(), library.Titles, library.Truncated);
        cache.Set(CacheKey(owner, preview.PreviewId), preview, OAuthLifetime);
        return preview;
    }

    private static async Task<PsnImportResult> Confirm(Guid previewId, SyncSelection request, ClaimsPrincipal user,
        PlayStationStore store, IMemoryCache cache, CancellationToken ct)
    {
        if (!cache.TryGetValue<SyncPreview>(CacheKey(user.GetOwnerId(), previewId), out var preview) || preview is null)
            throw new ValidationException([new("preview", "A prévia expirou. Consulte a PSN novamente.")]);
        var titles = preview.Titles.ToDictionary(title => title.Id, StringComparer.Ordinal);
        if (request.Ids is not { Length: > 0 and <= PsnTrophyClient.PreviewLimit } ||
            request.Ids.Any(id => id is null || !titles.ContainsKey(id)))
            throw new ValidationException([new("ids", "Selecione jogos da prévia.")]);

        return await store.ImportPsn(user.GetOwnerId(), request.Ids.Distinct(StringComparer.Ordinal)
            .Select(id => titles[id]).ToArray(), ct);
    }

    private static (string, Guid, Guid) CacheKey(Guid owner, Guid previewId) => ("psn-library", owner, previewId);

    private static string RandomValue() => WebEncoders.Base64UrlEncode(RandomNumberGenerator.GetBytes(32));

    private static CookieOptions OAuthCookieOptions() => new()
    {
        HttpOnly = true, Secure = true, SameSite = SameSiteMode.Lax, Path = "/"
    };

    [GeneratedRegex(@"\A[A-Za-z0-9._~+/\-]+=*\z", RegexOptions.CultureInvariant)]
    private static partial Regex BearerToken();

    private sealed record SyncRequest(string? AccessToken);
    private sealed record SyncSelection(string[] Ids);
    private sealed record SyncPreview(Guid PreviewId, IReadOnlyList<PsnTitle> Titles, bool Truncated);
    private sealed record OAuthStart(string AuthorizationUrl);
    private sealed record OAuthStatus(bool Available);

    private sealed class OAuthFlow(Guid owner, string verifier, string browser)
    {
        private int consumed;
        public Guid Owner { get; } = owner;
        public string Verifier { get; } = verifier;
        public string Browser { get; } = browser;
        public bool Consume() => Interlocked.Exchange(ref consumed, 1) == 0;
    }
}
