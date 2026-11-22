using System.Security.Cryptography;
using System.Text;
using GamesBacklog.Application;
using GamesBacklog.Infrastructure.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.Options;

namespace GamesBacklog.Infrastructure.Steam;

public sealed class SteamAuthService(
    SteamOpenId steam,
    SteamLoginStore flows,
    UserManager<BacklogUser> users,
    SignInManager<BacklogUser> signIn,
    IOptions<AuthLinks> auth,
    IOptions<SteamSettings> settings,
    TimeProvider clock) : ISteamAuthService
{
    public async Task<SteamStartResult> StartAsync(string codeChallenge, Guid? ownerId, CancellationToken ct)
    {
        RequireEnabled();
        const int lifetime = 300;
        var now = clock.GetUtcNow().ToUnixTimeSeconds();
        var state = RandomToken();
        await flows.Start(new SteamLoginFlow
        {
            State = state,
            Challenge = codeChallenge,
            LinkOwnerId = ownerId,
            ExpiresAt = now + lifetime
        }, now - 360, ct);

        return new SteamStartResult(state, steam.AuthorizationUrl(auth.Value.PublicOrigin, ReturnTo(state)), lifetime);
    }

    public async Task<SteamCallbackResult> HandleCallbackAsync(
        string state,
        int stateQueryCount,
        string absoluteRequestUrl,
        IReadOnlyDictionary<string, string> openIdFields,
        bool hasInvalidOpenIdField,
        CancellationToken ct)
    {
        RequireEnabled();

        var callback = new Uri(auth.Value.PublicOrigin, "/api/v1/auth/steam/callback");
        if (state.Length != 43 || stateQueryCount != 1 ||
            !string.Equals(absoluteRequestUrl, callback.AbsoluteUri, StringComparison.OrdinalIgnoreCase) ||
            !await flows.IsPending(state, clock.GetUtcNow().ToUnixTimeSeconds(), ct))
            return new SteamCallbackResult(true, "Solicitação Steam inválida ou expirada.");

        if (hasInvalidOpenIdField)
            return new SteamCallbackResult(true, "Resposta Steam inválida.");

        if (openIdFields.GetValueOrDefault("openid.mode") == "cancel")
            return new SteamCallbackResult(false, RedirectParamName: "error", RedirectParamValue: "cancelled");

        var assertion = await steam.Verify(openIdFields, ReturnTo(state), ct);
        if (assertion is null)
            return new SteamCallbackResult(false, RedirectParamName: "error", RedirectParamValue: "invalid_steam_response");

        var code = RandomToken();
        if (!await flows.Complete(state, assertion, Hash(code), clock.GetUtcNow().ToUnixTimeSeconds(), ct))
            return new SteamCallbackResult(true, "Solicitação Steam inválida ou expirada.");

        return new SteamCallbackResult(false, RedirectParamName: "code", RedirectParamValue: code);
    }

    public async Task<AuthSignInResult> LoginAsync(string state, string code, string codeVerifier, CancellationToken ct)
    {
        var steamId = await Redeem(state, code, codeVerifier, null, ct);
        if (steamId is null)
            return AuthSignInResult.Failure(401, "Código Steam inválido, expirado ou já utilizado.");

        var user = await flows.FindUser(steamId, ct);
        if (user is null)
        {
            var newUser = new BacklogUser { UserName = "steam-" + steamId, SteamId = steamId };
            var created = await users.CreateAsync(newUser);
            // If a parallel login just created the Steam account, use that same account.
            user = created.Succeeded ? newUser : await flows.FindUser(steamId, ct);
            if (user is null)
                return AuthSignInResult.Failure(409, "Não foi possível vincular esta conta Steam.");
        }

        if (!await CanSignIn(user))
            return AuthSignInResult.Failure(401, "Conta indisponível.");

        return AuthSignInResult.Success(await signIn.CreateUserPrincipalAsync(user));
    }

    public async Task<AuthOperationResult> LinkAsync(
        Guid ownerId,
        string state,
        string code,
        string codeVerifier,
        CancellationToken ct)
    {
        var user = await users.FindByIdAsync(ownerId.ToString());
        if (user is null || !await CanSignIn(user))
            return AuthOperationResult.Failure(401, "Conta indisponível.");

        var steamId = await Redeem(state, code, codeVerifier, ownerId, ct);
        if (steamId is null)
            return AuthOperationResult.Failure(401, "Código Steam inválido, expirado ou já utilizado.");

        if (user.SteamId == steamId) return AuthOperationResult.Success();
        if (user.SteamId is not null || await flows.FindUser(steamId, ct) is not null)
            return AuthOperationResult.Failure(409, "Não foi possível vincular esta conta Steam.");

        user.SteamId = steamId;
        var linked = await users.UpdateAsync(user);
        return linked.Succeeded
            ? AuthOperationResult.Success()
            : AuthOperationResult.Failure(409, "Não foi possível vincular esta conta Steam.");
    }

    private Task<string?> Redeem(string state, string code, string codeVerifier, Guid? ownerId, CancellationToken ct)
    {
        RequireEnabled();
        return flows.Redeem(state, Hash(code), Hash(codeVerifier), ownerId, clock.GetUtcNow().ToUnixTimeSeconds(), ct);
    }

    private async Task<bool> CanSignIn(BacklogUser user) =>
        await signIn.CanSignInAsync(user) && (!users.SupportsUserLockout || !await users.IsLockedOutAsync(user));

    private string ReturnTo(string state) => QueryHelpers.AddQueryString(
        new Uri(auth.Value.PublicOrigin, "/api/v1/auth/steam/callback").AbsoluteUri, "state", state);

    private void RequireEnabled()
    {
        if (settings.Value.WebReturnUrl is null) throw new SteamUnavailableException();
    }

    private static string RandomToken() => WebEncoders.Base64UrlEncode(RandomNumberGenerator.GetBytes(32));
    private static string Hash(string value) => WebEncoders.Base64UrlEncode(SHA256.HashData(Encoding.ASCII.GetBytes(value)));
}
