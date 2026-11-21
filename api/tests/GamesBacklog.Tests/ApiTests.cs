using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Nodes;

namespace GamesBacklog.Tests;

public sealed class ApiTests
{
    [Fact]
    public async Task AuthRequiresConfirmationAndPasswordResetInvalidatesRefresh()
    {
        await using var api = await TestApi.Start();
        const string email = "player@example.org";
        var credentials = new { email, password = "test-password" };

        using var invalid = await api.Client.PostAsJsonAsync("/api/v1/auth/register", new { email = "invalid", password = "test-password" });
        Assert.Equal(HttpStatusCode.BadRequest, invalid.StatusCode);
        using var displayName = await api.Client.PostAsJsonAsync("/api/v1/auth/register",
            new { email = "Player <player@example.org>", password = "test-password" });
        Assert.Equal(HttpStatusCode.BadRequest, displayName.StatusCode);
        using var register = await api.Client.PostAsJsonAsync("/api/v1/auth/register", credentials);
        Assert.Equal(HttpStatusCode.NoContent, register.StatusCode);
        using var blocked = await api.Client.PostAsJsonAsync("/api/v1/auth/login", credentials);
        Assert.Equal(HttpStatusCode.Unauthorized, blocked.StatusCode);
        using var resend = await api.Client.PostAsJsonAsync("/api/v1/auth/resendConfirmationEmail", new { email });
        Assert.Equal(HttpStatusCode.NoContent, resend.StatusCode);
        using var confirm = await api.Client.GetAsync(api.Email.ConfirmationLinks[email]);
        Assert.Equal(HttpStatusCode.OK, confirm.StatusCode);
        using var login = await api.Client.PostAsJsonAsync("/api/v1/auth/login", credentials);
        Assert.True(login.IsSuccessStatusCode, await login.Content.ReadAsStringAsync());
        var session = await login.Content.ReadFromJsonAsync<JsonObject>();
        Assert.Equal("Bearer", session!["tokenType"]!.GetValue<string>());

        var renewal = new { refreshToken = session["refreshToken"]!.GetValue<string>() };
        using var refresh = await api.Client.PostAsJsonAsync("/api/v1/auth/refresh", renewal);
        Assert.Equal(HttpStatusCode.OK, refresh.StatusCode);

        using var forgot = await api.Client.PostAsJsonAsync("/api/v1/auth/forgotPassword", new { email });
        Assert.Equal(HttpStatusCode.NoContent, forgot.StatusCode);
        using var reset = await api.Client.PostAsJsonAsync("/api/v1/auth/resetPassword",
            new { email, resetCode = api.Email.ResetCodes[email], newPassword = "another-password" });
        Assert.Equal(HttpStatusCode.NoContent, reset.StatusCode);
        using var expired = await api.Client.PostAsJsonAsync("/api/v1/auth/refresh", renewal);
        Assert.Equal(HttpStatusCode.Unauthorized, expired.StatusCode);
        using var newLogin = await api.Client.PostAsJsonAsync("/api/v1/auth/login",
            new { email, password = "another-password" });
        Assert.Equal(HttpStatusCode.OK, newLogin.StatusCode);
    }

    [Fact]
    public async Task BacklogIsPrivateAndCatalogFailureDoesNotBlockManualUpdates()
    {
        await using var api = await TestApi.Start();
        using var anonymous = await api.Client.GetAsync("/api/v1/backlog");
        Assert.Equal(HttpStatusCode.Unauthorized, anonymous.StatusCode);
        Assert.Equal("application/problem+json", anonymous.Content.Headers.ContentType?.MediaType);

        using var owner = await api.Login("one@example.org");
        using var other = await api.Login("two@example.org");
        using var invalid = await owner.PostAsJsonAsync("/api/v1/backlog", new { title = " ", platform = "PC" });
        Assert.Equal(HttpStatusCode.BadRequest, invalid.StatusCode);
        var validation = await invalid.Content.ReadFromJsonAsync<JsonObject>();
        Assert.NotNull(validation!["errors"]?["title"]);
        Assert.NotNull(validation["traceId"]);

        using var create = await owner.PostAsJsonAsync("/api/v1/backlog", new { title = "  Manual Game ", platform = "PC" });
        Assert.True(create.IsSuccessStatusCode, await create.Content.ReadAsStringAsync());
        var entry = await create.Content.ReadFromJsonAsync<JsonObject>();
        Assert.Equal("Manual Game", entry!["title"]!.GetValue<string>());
        Assert.Equal("planned", entry["status"]!.GetValue<string>());
        Assert.False(entry.ContainsKey("ownerId"));
        var location = create.Headers.Location!;
        using var forbiddenRead = await other.GetAsync(location);
        using var forbiddenUpdate = await other.PatchAsJsonAsync(location, new { status = "playing" });
        using var forbiddenDelete = await other.DeleteAsync(location);
        Assert.Equal(HttpStatusCode.NotFound, forbiddenRead.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, forbiddenUpdate.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, forbiddenDelete.StatusCode);

        using var outage = await owner.GetAsync("/api/v1/catalog/games?q=offline");
        Assert.Equal(HttpStatusCode.ServiceUnavailable, outage.StatusCode);
        using var update = await owner.PatchAsJsonAsync(location, new { status = "playing" });
        Assert.Equal("playing", (await update.Content.ReadFromJsonAsync<JsonObject>())!["status"]!.GetValue<string>());
        using var delete = await owner.DeleteAsync(location);
        Assert.Equal(HttpStatusCode.NoContent, delete.StatusCode);
        using var gone = await owner.GetAsync(location);
        Assert.Equal(HttpStatusCode.NotFound, gone.StatusCode);
    }

    [Fact]
    public async Task OpenApiSnapshotMatchesEndpointMetadata()
    {
        await using var api = await TestApi.Start();
        var json = await api.Client.GetStringAsync("/openapi/v1.json");
        var current = JsonNode.Parse(json)!;
        var output = Environment.GetEnvironmentVariable("GAMESBACKLOG_EXPORT_OPENAPI");
        if (!string.IsNullOrEmpty(output))
            await File.WriteAllTextAsync(output, json.TrimEnd() + "\n");
        else
        {
            var snapshot = await File.ReadAllTextAsync(Path.Combine(AppContext.BaseDirectory, "openapi-v1.json"));
            Assert.True(JsonNode.DeepEquals(JsonNode.Parse(snapshot), current),
                "OpenAPI mudou. Gere novamente o contrato conforme o README.");
        }

        Assert.NotNull(current["paths"]?["/api/v1/backlog"]?["post"]?["security"]?[0]?["bearer"]);
        Assert.NotNull(current["paths"]?["/api/v1/backlog/{id}"]?["patch"]?["security"]?[0]?["bearer"]);
        Assert.Null(current["paths"]?["/api/v1/auth/login"]?["post"]?["security"]);
    }
}
