using System.Globalization;
using Microsoft.AspNetCore.WebUtilities;

namespace GamesBacklog.Infrastructure.Steam;

public sealed record SteamAssertion(string SteamId, string Nonce);

public sealed class SteamUnavailableException : Exception;

public sealed class SteamOpenId(HttpClient client, TimeProvider clock)
{
    private const string Provider = "https://steamcommunity.com/openid/login";
    private const string Namespace = "http://specs.openid.net/auth/2.0";
    private const string IdentifierSelect = Namespace + "/identifier_select";
    private static readonly string[] RequiredSignedFields =
        ["op_endpoint", "claimed_id", "identity", "return_to", "response_nonce", "assoc_handle"];

    public string AuthorizationUrl(Uri realm, string returnTo) =>
        QueryHelpers.AddQueryString(Provider, new Dictionary<string, string?>
        {
            ["openid.ns"] = Namespace,
            ["openid.mode"] = "checkid_setup",
            ["openid.claimed_id"] = IdentifierSelect,
            ["openid.identity"] = IdentifierSelect,
            ["openid.realm"] = realm.AbsoluteUri,
            ["openid.return_to"] = returnTo
        });

    public async Task<SteamAssertion?> Verify(IReadOnlyDictionary<string, string> fields, string returnTo, CancellationToken ct)
    {
        if (!fields.TryGetValue("openid.ns", out var ns) || ns != Namespace ||
            !fields.TryGetValue("openid.mode", out var mode) || mode != "id_res" ||
            !fields.TryGetValue("openid.op_endpoint", out var provider) || provider != Provider ||
            !fields.TryGetValue("openid.return_to", out var target) || target != returnTo ||
            !fields.TryGetValue("openid.claimed_id", out var claimedId) ||
            !fields.TryGetValue("openid.identity", out var identity) || claimedId != identity ||
            !fields.TryGetValue("openid.response_nonce", out var nonce) || !IsFresh(nonce) ||
            !fields.TryGetValue("openid.signed", out var signed) ||
            !fields.TryGetValue("openid.sig", out var signature) || signature.Length == 0)
            return null;

        // Trust only Steam's fixed identity namespace and its discovered HTTPS provider.
        var steamId = GetSteamId(claimedId);
        var signedNames = signed.Split(',').ToHashSet(StringComparer.Ordinal);
        if (steamId is null || !RequiredSignedFields.All(name =>
            signedNames.Contains(name) && fields.TryGetValue("openid." + name, out var value) && value.Length > 0))
            return null;

        var parameters = new Dictionary<string, string>(fields, StringComparer.Ordinal)
        {
            ["openid.mode"] = "check_authentication"
        };

        try
        {
            using var body = new FormUrlEncodedContent(parameters);
            using var response = await client.PostAsync(Provider, body, ct);
            if (!response.IsSuccessStatusCode) throw new SteamUnavailableException();

            var lines = (await response.Content.ReadAsStringAsync(ct)).Split('\n', StringSplitOptions.TrimEntries);
            return lines.Contains("ns:" + Namespace, StringComparer.Ordinal) &&
                   lines.Where(line => line.StartsWith("is_valid:", StringComparison.Ordinal)).SequenceEqual(["is_valid:true"])
                ? new SteamAssertion(steamId, nonce) : null;
        }
        catch (Exception error) when (error is HttpRequestException or IOException ||
            error is OperationCanceledException && !ct.IsCancellationRequested)
        {
            throw new SteamUnavailableException();
        }
    }

    private bool IsFresh(string nonce)
    {
        if (nonce.Length is < 20 or > 255 || nonce.Skip(20).Any(character => character is < '!' or > '~') ||
            !DateTimeOffset.TryParseExact(nonce[..20], "yyyy-MM-dd'T'HH:mm:ss'Z'", CultureInfo.InvariantCulture,
                DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal, out var timestamp))
            return false;

        var now = clock.GetUtcNow();
        return timestamp >= now.AddMinutes(-5) && timestamp <= now.AddMinutes(1);
    }

    private static string? GetSteamId(string identifier)
    {
        const string https = "https://steamcommunity.com/openid/id/";
        const string http = "http://steamcommunity.com/openid/id/";
        var prefix = identifier.StartsWith(https, StringComparison.Ordinal) ? https : http;
        if (!identifier.StartsWith(prefix, StringComparison.Ordinal)) return null;

        var id = identifier[prefix.Length..];
        return id.Length == 17 && id[0] != '0' && id.All(char.IsAsciiDigit) ? id : null;
    }
}
