using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.WebUtilities;

namespace GamesBacklog.Tests;

public sealed class SteamAuthTests
{
    private const string SteamId = "76561198000000001";
    private const string Prefix = "/api/v1/auth/steam";
    private const string OpenIdNamespace = "http://specs.openid.net/auth/2.0";
    private const string Provider = "https://steamcommunity.com/openid/login";

    [Fact]
    public async Task SteamCreatesOneAccountAndUsesExistingBearerSessions()
    {
        await using var api = await TestApi.Start();
        var exchange = await CompleteBrowserFlow(api, api.Client, "/start");

        using var wrongVerifier = await api.Client.PostAsJsonAsync(Prefix + "/token",
            exchange with { CodeVerifier = NewVerifier() });
        Assert.Equal(HttpStatusCode.Unauthorized, wrongVerifier.StatusCode);

        var first = await ReceiveSession(api.Client, exchange);
        using var replay = await api.Client.PostAsJsonAsync(Prefix + "/token", exchange);
        Assert.Equal(HttpStatusCode.Unauthorized, replay.StatusCode);

        using var create = await api.Client.PostAsJsonAsync("/api/v1/backlog", new { title = "Steam game", platform = "PC" });
        Assert.Equal(HttpStatusCode.Created, create.StatusCode);
        Assert.NotNull(create.Headers.Location);

        var next = await CompleteBrowserFlow(api, api.Client, "/start");
        await ReceiveSession(api.Client, next);
        using var reload = await api.Client.GetAsync(create.Headers.Location);
        Assert.Equal(HttpStatusCode.OK, reload.StatusCode);

        using var refresh = await api.Client.PostAsJsonAsync("/api/v1/auth/refresh",
            new { refreshToken = first["refreshToken"]!.GetValue<string>() });
        Assert.Equal(HttpStatusCode.OK, refresh.StatusCode);
    }

    [Fact]
    public async Task LinkingRequiresTheOriginalAccountAndPreservesItsLibrary()
    {
        await using var api = await TestApi.Start();
        using var owner = await api.Login("owner@example.org");
        using var other = await api.Login("other@example.org");

        using var create = await owner.PostAsJsonAsync("/api/v1/backlog", new { title = "Existing game", platform = "PC" });
        Assert.Equal(HttpStatusCode.Created, create.StatusCode);
        var link = await CompleteBrowserFlow(api, owner, "/link/start");

        using var loginWithLink = await api.Client.PostAsJsonAsync(Prefix + "/token", link);
        Assert.Equal(HttpStatusCode.Unauthorized, loginWithLink.StatusCode);
        using var wrongAccount = await other.PostAsJsonAsync(Prefix + "/link", link);
        Assert.Equal(HttpStatusCode.Unauthorized, wrongAccount.StatusCode);

        using var linked = await owner.PostAsJsonAsync(Prefix + "/link", link);
        Assert.Equal(HttpStatusCode.NoContent, linked.StatusCode);
        var login = await CompleteBrowserFlow(api, api.Client, "/start");
        await ReceiveSession(api.Client, login);
        using var reload = await api.Client.GetAsync(create.Headers.Location);
        Assert.Equal(HttpStatusCode.OK, reload.StatusCode);

        var duplicate = await CompleteBrowserFlow(api, other, "/link/start");
        using var conflict = await other.PostAsJsonAsync(Prefix + "/link", duplicate);
        Assert.Equal(HttpStatusCode.Conflict, conflict.StatusCode);
    }

    [Fact]
    public async Task CallbackRejectsTamperingCancellationAndExpiration()
    {
        await using var api = await TestApi.Start();
        var start = await Start(api.Client, "/start");

        using var tampered = await api.Client.GetAsync(AssertionUrl(api, start.ReturnTo, "https://example.org/openid"));
        Assert.Equal(HttpStatusCode.Found, tampered.StatusCode);
        Assert.Equal("invalid_steam_response", CallbackParameters(tampered)["error"].ToString());
        Assert.Equal(0, api.Steam.Calls);

        using var cancelled = await api.Client.GetAsync(QueryHelpers.AddQueryString(start.ReturnTo, "openid.mode", "cancel"));
        Assert.Equal(HttpStatusCode.Found, cancelled.StatusCode);
        Assert.Equal("cancelled", CallbackParameters(cancelled)["error"].ToString());

        api.Steam.AcceptSignature = false;
        using var invalidSignature = await api.Client.GetAsync(AssertionUrl(api, start.ReturnTo));
        Assert.Equal(HttpStatusCode.Found, invalidSignature.StatusCode);
        Assert.Equal("invalid_steam_response", CallbackParameters(invalidSignature)["error"].ToString());
        Assert.Equal(1, api.Steam.Calls);

        api.Clock.Now = api.Clock.Now.AddMinutes(6);
        using var expired = await api.Client.GetAsync(AssertionUrl(api, start.ReturnTo));
        Assert.Equal(HttpStatusCode.BadRequest, expired.StatusCode);
        Assert.Equal(1, api.Steam.Calls);
    }

    [Fact]
    public async Task WebPreflightAllowsTheConfiguredFlutterOrigin()
    {
        await using var api = await TestApi.Start();
        using var request = new HttpRequestMessage(HttpMethod.Options, Prefix + "/link");
        request.Headers.Add("Origin", "http://localhost:3000");
        request.Headers.Add("Access-Control-Request-Method", "POST");
        request.Headers.Add("Access-Control-Request-Headers", "authorization,content-type");
        using var response = await api.Client.SendAsync(request);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal("http://localhost:3000", Assert.Single(response.Headers.GetValues("Access-Control-Allow-Origin")));
    }

    [RequiresPostgres]
    public Task PostgresRedeemsEachCodeOnceAndCreatesASingleSteamAccount() =>
        PostgresTests.WithTemporarySchema(async connection =>
        {
            await using var api = await TestApi.Start(connection);
            var first = await CompleteBrowserFlow(api, api.Client, "/start");
            var second = await CompleteBrowserFlow(api, api.Client, "/start");
            var parallel = await Task.WhenAll(
                api.Client.PostAsJsonAsync(Prefix + "/token", first),
                api.Client.PostAsJsonAsync(Prefix + "/token", first),
                api.Client.PostAsJsonAsync(Prefix + "/token", second));

            try
            {
                Assert.Single(parallel, response => response.StatusCode == HttpStatusCode.Unauthorized);
                foreach (var success in parallel.Where(response => response.StatusCode != HttpStatusCode.Unauthorized))
                    Assert.True(success.IsSuccessStatusCode, await success.Content.ReadAsStringAsync());

                var tokens = await Task.WhenAll(parallel.Where(response => response.IsSuccessStatusCode)
                    .Select(async response => (await response.Content.ReadFromJsonAsync<JsonObject>())!["accessToken"]!.GetValue<string>()));
                api.Client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", tokens[0]);
                using var create = await api.Client.PostAsJsonAsync("/api/v1/backlog", new { title = "Same account", platform = "PC" });
                Assert.Equal(HttpStatusCode.Created, create.StatusCode);
                api.Client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", tokens[1]);
                using var sameAccount = await api.Client.GetAsync(create.Headers.Location);
                Assert.Equal(HttpStatusCode.OK, sameAccount.StatusCode);
            }
            finally
            {
                foreach (var response in parallel) response.Dispose();
            }
        });

    private static async Task<Exchange> CompleteBrowserFlow(TestApi api, HttpClient client, string endpoint)
    {
        var start = await Start(client, endpoint);
        var callback = AssertionUrl(api, start.ReturnTo);
        using var response = await api.Client.GetAsync(callback);
        Assert.Equal(HttpStatusCode.Found, response.StatusCode);
        Assert.Equal("no-referrer", Assert.Single(response.Headers.GetValues("Referrer-Policy")));
        var parameters = CallbackParameters(response);
        Assert.Equal(start.State, parameters["state"].ToString());
        Assert.False(parameters.ContainsKey("accessToken"));
        using var replay = await api.Client.GetAsync(callback);
        Assert.Equal(HttpStatusCode.BadRequest, replay.StatusCode);
        return new(start.State, parameters["code"].ToString(), start.Verifier);
    }

    private static async Task<BrowserStart> Start(HttpClient client, string endpoint)
    {
        var verifier = NewVerifier();
        var codeChallenge = WebEncoders.Base64UrlEncode(SHA256.HashData(Encoding.ASCII.GetBytes(verifier)));
        using var response = await client.PostAsJsonAsync(Prefix + endpoint, new { codeChallenge });
        Assert.True(response.IsSuccessStatusCode, await response.Content.ReadAsStringAsync());
        var started = await response.Content.ReadFromJsonAsync<JsonObject>();
        var url = new Uri(started!["authorizationUrl"]!.GetValue<string>());
        Assert.Equal(Provider, url.GetLeftPart(UriPartial.Path));
        Assert.Equal("checkid_setup", QueryHelpers.ParseQuery(url.Query)["openid.mode"].ToString());
        return new(started["state"]!.GetValue<string>(), verifier,
            QueryHelpers.ParseQuery(url.Query)["openid.return_to"].ToString());
    }

    private static async Task<JsonObject> ReceiveSession(HttpClient client, Exchange exchange)
    {
        using var response = await client.PostAsJsonAsync(Prefix + "/token", exchange);
        Assert.True(response.IsSuccessStatusCode, await response.Content.ReadAsStringAsync());
        var session = (await response.Content.ReadFromJsonAsync<JsonObject>())!;
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer",
            session["accessToken"]!.GetValue<string>());
        return session;
    }

    private static string AssertionUrl(TestApi api, string returnTo, string provider = Provider) =>
        QueryHelpers.AddQueryString(returnTo, new Dictionary<string, string?>
        {
            ["openid.ns"] = OpenIdNamespace,
            ["openid.mode"] = "id_res",
            ["openid.op_endpoint"] = provider,
            ["openid.claimed_id"] = "https://steamcommunity.com/openid/id/" + SteamId,
            ["openid.identity"] = "https://steamcommunity.com/openid/id/" + SteamId,
            ["openid.return_to"] = returnTo,
            ["openid.response_nonce"] = api.Clock.Now.ToString("yyyy-MM-dd'T'HH:mm:ss'Z'") + Guid.NewGuid().ToString("N"),
            ["openid.assoc_handle"] = "test-handle",
            ["openid.signed"] = "op_endpoint,claimed_id,identity,return_to,response_nonce,assoc_handle",
            ["openid.sig"] = "test-signature"
        });

    private static Dictionary<string, Microsoft.Extensions.Primitives.StringValues> CallbackParameters(HttpResponseMessage response)
    {
        var url = response.Headers.Location!;
        Assert.Equal("http://localhost:3000/", url.GetLeftPart(UriPartial.Path));
        return QueryHelpers.ParseQuery(url.Fragment[(url.Fragment.IndexOf('?') + 1)..]);
    }

    private static string NewVerifier() => WebEncoders.Base64UrlEncode(RandomNumberGenerator.GetBytes(32));
    private sealed record BrowserStart(string State, string Verifier, string ReturnTo);
    private sealed record Exchange(string State, string Code, string CodeVerifier);
}

internal sealed class TestSteam : HttpMessageHandler
{
    public int Calls { get; private set; }
    public bool AcceptSignature { get; set; } = true;

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        Calls++;
        Assert.Equal("https://steamcommunity.com/openid/login", request.RequestUri!.AbsoluteUri);
        Assert.Equal(HttpMethod.Post, request.Method);
        var fields = QueryHelpers.ParseQuery(await request.Content!.ReadAsStringAsync(cancellationToken));
        Assert.Equal("check_authentication", fields["openid.mode"].ToString());
        return new(HttpStatusCode.OK)
        {
            Content = new StringContent("ns:http://specs.openid.net/auth/2.0\nis_valid:" +
                (AcceptSignature ? "true" : "false") + "\n")
        };
    }
}

internal sealed class TestClock : TimeProvider
{
    public DateTimeOffset Now { get; set; } = DateTimeOffset.UtcNow;
    public override DateTimeOffset GetUtcNow() => Now;
}
