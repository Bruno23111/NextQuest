using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.Options;

namespace GamesBacklog.Infrastructure.PlayStation;

public sealed class PsnOAuthOptions
{
    public Uri? AuthorizationUrl { get; init; }
    public Uri? TokenUrl { get; init; }
    public Uri? RedirectUri { get; init; }
    public Uri? WebReturnUrl { get; init; }
    public string? ClientId { get; init; }
    public string? ClientSecret { get; init; }
    public string? Scope { get; init; }

    public bool Available => IsSonyEndpoint(AuthorizationUrl) && IsSonyEndpoint(TokenUrl) &&
        IsCleanUrl(RedirectUri) && RedirectUri!.Scheme == "https" &&
        RedirectUri.AbsolutePath == "/api/v1/playstation/sync/oauth/callback" &&
        IsCleanUrl(WebReturnUrl) && WebReturnUrl!.AbsolutePath == "/playstation" &&
        WebReturnUrl.GetLeftPart(UriPartial.Authority) == RedirectUri.GetLeftPart(UriPartial.Authority) &&
        !string.IsNullOrWhiteSpace(ClientId) && !string.IsNullOrWhiteSpace(Scope);

    private static bool IsCleanUrl(Uri? uri) =>
        uri is { IsAbsoluteUri: true, Host.Length: > 0, UserInfo.Length: 0, Query.Length: 0, Fragment.Length: 0 };

    private static bool IsSonyEndpoint(Uri? uri) =>
        IsCleanUrl(uri) && uri is { Scheme: "https", IsDefaultPort: true } &&
        (uri.Host is "account.sony.com" or "auth.api.sonyentertainmentnetwork.com" ||
         uri.Host.EndsWith(".account.sony.com", StringComparison.OrdinalIgnoreCase));
}

public sealed class PsnOAuthClient(HttpClient http, IOptions<PsnOAuthOptions> options)
{
    public PsnOAuthOptions Settings => options.Value;

    public string AuthorizationUrl(string state, string challenge) =>
        QueryHelpers.AddQueryString(Settings.AuthorizationUrl!.AbsoluteUri, new Dictionary<string, string?>
        {
            ["response_type"] = "code",
            ["client_id"] = Settings.ClientId,
            ["redirect_uri"] = Settings.RedirectUri!.AbsoluteUri,
            ["scope"] = Settings.Scope,
            ["state"] = state,
            ["code_challenge"] = challenge,
            ["code_challenge_method"] = "S256"
        });

    public async Task<string> Exchange(string code, string verifier, CancellationToken ct)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, Settings.TokenUrl);
        var parameters = new Dictionary<string, string>
        {
            ["grant_type"] = "authorization_code",
            ["redirect_uri"] = Settings.RedirectUri!.AbsoluteUri,
            ["code"] = code,
            ["code_verifier"] = verifier
        };
        if (string.IsNullOrEmpty(Settings.ClientSecret))
            parameters["client_id"] = Settings.ClientId!;
        else
        {
            var credential = Uri.EscapeDataString(Settings.ClientId!) + ":" + Uri.EscapeDataString(Settings.ClientSecret);
            request.Headers.Authorization = new AuthenticationHeaderValue("Basic",
                Convert.ToBase64String(Encoding.ASCII.GetBytes(credential)));
        }
        request.Content = new FormUrlEncodedContent(parameters);

        try
        {
            using var response = await http.SendAsync(request, ct);
            if (!response.IsSuccessStatusCode) throw new PsnSyncException(PsnFailure.AccessDenied);
            var token = await response.Content.ReadFromJsonAsync<TokenResponse>(cancellationToken: ct);
            return token?.AccessToken is { Length: > 0 and <= 4096 } accessToken &&
                string.Equals(token.TokenType, "Bearer", StringComparison.OrdinalIgnoreCase)
                ? accessToken : throw new PsnSyncException(PsnFailure.AccessDenied);
        }
        catch (Exception error) when (error is HttpRequestException or JsonException or IOException ||
            error is OperationCanceledException && !ct.IsCancellationRequested)
        {
            throw new PsnSyncException(PsnFailure.Unavailable);
        }
    }

    private sealed record TokenResponse([property: JsonPropertyName("access_token")] string? AccessToken,
        [property: JsonPropertyName("token_type")] string? TokenType);
}
