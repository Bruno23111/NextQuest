using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using GamesBacklog.Infrastructure.Identity;
using GamesBacklog.Infrastructure.Steam;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Http.Extensions;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.Options;

namespace GamesBacklog.Api.Endpoints;

internal sealed class SteamSettings
{
    public Uri? WebReturnUrl { get; set; }

    public static bool IsValid(Uri? url, bool development) => url is null ||
        url is { IsAbsoluteUri: true, UserInfo.Length: 0, Query.Length: 0 } &&
        !url.Fragment.Contains('?') &&
        (url.Scheme == "https" || development && url.Scheme == "http" && url.IsLoopback);
}

internal sealed record StartSteamRequest([property: Required, RegularExpression("[A-Za-z0-9_-]{43}")] string CodeChallenge)
    : IAuthRequest;

internal sealed record RedeemSteamRequest(
    [property: Required, RegularExpression("[A-Za-z0-9_-]{43}")] string State,
    [property: Required, RegularExpression("[A-Za-z0-9_-]{43}")] string Code,
    [property: Required, RegularExpression("[A-Za-z0-9._~-]{43,128}")] string CodeVerifier) : IAuthRequest;

internal sealed record StartSteamResponse(string State, string AuthorizationUrl, int ExpiresIn);

internal sealed class SteamAuthEndpoints(
    SteamOpenId steam, SteamLoginStore flows, UserManager<BacklogUser> users,
    SignInManager<BacklogUser> signIn, IOptions<AuthLinks> auth, IOptions<SteamSettings> settings, TimeProvider clock)
{
    internal static void MapSteam(RouteGroupBuilder auth)
    {
        var group = auth.MapGroup("/steam").ProducesProblem(429);
        group.MapPost("/start", (StartSteamRequest request, SteamAuthEndpoints endpoints, CancellationToken ct) =>
            endpoints.Start(request, null, ct)).WithName("StartSteamLogin")
            .ProducesValidationProblem().ProducesProblem(503);
        group.MapPost("/link/start", (StartSteamRequest request, ClaimsPrincipal user, SteamAuthEndpoints endpoints,
            CancellationToken ct) => endpoints.Start(request, Owner(user), ct))
            .WithName("StartSteamLink").RequireAuthorization()
            .ProducesValidationProblem().ProducesProblem(401).ProducesProblem(503);
        group.MapGet("/callback", (string state, HttpContext context, SteamAuthEndpoints endpoints, CancellationToken ct) =>
            endpoints.Callback(state, context, ct)).WithName("SteamCallback").Produces(302)
            .ProducesProblem(400).ProducesProblem(503);
        group.MapPost("/token", (RedeemSteamRequest request, SteamAuthEndpoints endpoints, CancellationToken ct) =>
            endpoints.Login(request, ct)).WithName("RedeemSteamLogin").Produces<SessionResponse>()
            .ProducesValidationProblem().ProducesProblem(401).ProducesProblem(409).ProducesProblem(503);
        group.MapPost("/link", (RedeemSteamRequest request, ClaimsPrincipal user, SteamAuthEndpoints endpoints,
            CancellationToken ct) => endpoints.Link(request, Owner(user), ct))
            .WithName("LinkSteamAccount").RequireAuthorization()
            .ProducesValidationProblem().ProducesProblem(401).ProducesProblem(409).ProducesProblem(503);
    }

    private async Task<Ok<StartSteamResponse>> Start(StartSteamRequest request, Guid? ownerId, CancellationToken ct)
    {
        RequireEnabled();
        const int lifetime = 300;
        var now = clock.GetUtcNow().ToUnixTimeSeconds();
        var state = RandomToken();
        await flows.Start(new SteamLoginFlow
        {
            State = state, Challenge = request.CodeChallenge, LinkOwnerId = ownerId, ExpiresAt = now + lifetime
        }, now - 360, ct);

        return TypedResults.Ok(new StartSteamResponse(state, steam.AuthorizationUrl(auth.Value.PublicOrigin, ReturnTo(state)), lifetime));
    }

    private async Task<Results<RedirectHttpResult, ProblemHttpResult>> Callback(string state, HttpContext context,
        CancellationToken ct)
    {
        RequireEnabled();
        context.Response.Headers["Referrer-Policy"] = "no-referrer";

        var request = context.Request;
        var callback = new Uri(auth.Value.PublicOrigin, "/api/v1/auth/steam/callback");
        if (state.Length != 43 || request.Query["state"].Count != 1 ||
            !string.Equals(UriHelper.BuildAbsolute(request.Scheme, request.Host, request.PathBase, request.Path),
                callback.AbsoluteUri, StringComparison.OrdinalIgnoreCase) ||
            !await flows.IsPending(state, clock.GetUtcNow().ToUnixTimeSeconds(), ct))
            return TypedResults.Problem(statusCode: 400, title: "Solicitação Steam inválida ou expirada.");

        var fields = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (var (key, values) in request.Query.Where(pair => pair.Key.StartsWith("openid.", StringComparison.Ordinal)))
        {
            if (values.Count != 1 || values[0] is not { } value)
                return TypedResults.Problem(statusCode: 400, title: "Resposta Steam inválida.");
            fields.Add(key, value);
        }

        if (fields.GetValueOrDefault("openid.mode") == "cancel")
            return RedirectToApp(state, "error", "cancelled");

        var assertion = await steam.Verify(fields, ReturnTo(state), ct);
        if (assertion is null) return RedirectToApp(state, "error", "invalid_steam_response");

        var code = RandomToken();
        if (!await flows.Complete(state, assertion, Hash(code), clock.GetUtcNow().ToUnixTimeSeconds(), ct))
            return TypedResults.Problem(statusCode: 400, title: "Solicitação Steam inválida ou expirada.");

        return RedirectToApp(state, "code", code);
    }

    private async Task<Results<SignInHttpResult, ProblemHttpResult>> Login(RedeemSteamRequest request, CancellationToken ct)
    {
        var steamId = await Redeem(request, null, ct);
        if (steamId is null) return InvalidExchange();

        var user = await flows.FindUser(steamId, ct);
        if (user is null)
        {
            var newUser = new BacklogUser { UserName = "steam-" + steamId, SteamId = steamId };
            var created = await users.CreateAsync(newUser);
            // If a parallel login just created the Steam account, use that same account.
            user = created.Succeeded ? newUser : await flows.FindUser(steamId, ct);
            if (user is null) return Conflict();
        }

        if (!await CanSignIn(user))
            return TypedResults.Problem(statusCode: 401, title: "Conta indisponível.");
        return TypedResults.SignIn(await signIn.CreateUserPrincipalAsync(user), authenticationScheme: IdentityConstants.BearerScheme);
    }

    private async Task<Results<NoContent, ProblemHttpResult>> Link(RedeemSteamRequest request, Guid ownerId, CancellationToken ct)
    {
        var user = await users.FindByIdAsync(ownerId.ToString());
        if (user is null || !await CanSignIn(user))
            return TypedResults.Problem(statusCode: 401, title: "Conta indisponível.");

        var steamId = await Redeem(request, ownerId, ct);
        if (steamId is null) return InvalidExchange();

        if (user.SteamId == steamId) return TypedResults.NoContent();
        if (user.SteamId is not null || await flows.FindUser(steamId, ct) is not null) return Conflict();

        user.SteamId = steamId;
        var linked = await users.UpdateAsync(user);
        return linked.Succeeded ? TypedResults.NoContent() : Conflict();
    }

    private Task<string?> Redeem(RedeemSteamRequest request, Guid? ownerId, CancellationToken ct)
    {
        RequireEnabled();
        return flows.Redeem(request.State, Hash(request.Code), Hash(request.CodeVerifier), ownerId,
            clock.GetUtcNow().ToUnixTimeSeconds(), ct);
    }

    private async Task<bool> CanSignIn(BacklogUser user) =>
        await signIn.CanSignInAsync(user) && (!users.SupportsUserLockout || !await users.IsLockedOutAsync(user));

    private string ReturnTo(string state) => QueryHelpers.AddQueryString(
        new Uri(auth.Value.PublicOrigin, "/api/v1/auth/steam/callback").AbsoluteUri, "state", state);

    private RedirectHttpResult RedirectToApp(string state, string name, string value)
    {
        var returnUrl = settings.Value.WebReturnUrl!;
        var parameters = new Dictionary<string, string?> { ["state"] = state, [name] = value };
        if (returnUrl.Fragment.Length == 0)
            return TypedResults.Redirect(QueryHelpers.AddQueryString(returnUrl.AbsoluteUri, parameters));

        var uri = new UriBuilder(returnUrl)
        {
            Fragment = QueryHelpers.AddQueryString(returnUrl.Fragment[1..], parameters)
        };
        return TypedResults.Redirect(uri.Uri.AbsoluteUri);
    }

    private void RequireEnabled()
    {
        if (settings.Value.WebReturnUrl is null) throw new SteamUnavailableException();
    }

    private static Guid Owner(ClaimsPrincipal user) => Guid.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)!);
    private static string RandomToken() => WebEncoders.Base64UrlEncode(RandomNumberGenerator.GetBytes(32));
    private static string Hash(string value) => WebEncoders.Base64UrlEncode(SHA256.HashData(Encoding.ASCII.GetBytes(value)));
    private static ProblemHttpResult InvalidExchange() =>
        TypedResults.Problem(statusCode: 401, title: "Código Steam inválido, expirado ou já utilizado.");
    private static ProblemHttpResult Conflict() =>
        TypedResults.Problem(statusCode: 409, title: "Não foi possível vincular esta conta Steam.");
}
