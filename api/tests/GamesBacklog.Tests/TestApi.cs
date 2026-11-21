using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using GamesBacklog.Api;
using GamesBacklog.Application;
using GamesBacklog.Infrastructure.Identity;
using GamesBacklog.Infrastructure.Persistence;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace GamesBacklog.Tests;

internal sealed class TestApi : IAsyncDisposable
{
    private readonly WebApplication app;
    private readonly SqliteConnection? sqlite;
    public TestEmail Email { get; } = new();
    public HttpClient Client { get; private set; } = null!;

    private TestApi(string? postgres)
    {
        if (postgres is null)
        {
            sqlite = new SqliteConnection("Data Source=:memory:");
            sqlite.Open();
        }

        app = ApiHost.Build(new WebApplicationOptions
        {
            EnvironmentName = "Development", ApplicationName = typeof(ApiHost).Assembly.GetName().Name
        }, builder =>
        {
            builder.Configuration.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:Backlog"] = postgres ?? "Host=localhost;Database=unused",
                ["Auth:PublicOrigin"] = "http://localhost",
                ["Logging:LogLevel:Default"] = "Warning"
            });
            builder.WebHost.UseTestServer();
            var services = builder.Services;
            if (sqlite is not null)
            {
                services.RemoveAll<IDbContextOptionsConfiguration<BacklogDbContext>>();
                services.AddDbContext<BacklogDbContext>(options => options.UseSqlite(sqlite));
            }
            services.AddDataProtection().UseEphemeralDataProtectionProvider();
            services.AddSingleton<IEmailSender<BacklogUser>>(Email);
            services.AddSingleton<IGameCatalog>(new TestCatalog());
        });
    }

    public static async Task<TestApi> Start(string? postgres = null)
    {
        var api = new TestApi(postgres);
        await using var scope = api.app.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<BacklogDbContext>();
        if (postgres is null) await db.Database.EnsureCreatedAsync();
        else await db.Database.MigrateAsync();
        await api.app.StartAsync();
        api.Client = api.app.GetTestClient();
        return api;
    }

    public async Task<HttpClient> Login(string email)
    {
        var client = app.GetTestClient();
        using var register = await client.PostAsJsonAsync("/api/v1/auth/register", new { email, password = "test-password" });
        Assert.True(register.IsSuccessStatusCode, await register.Content.ReadAsStringAsync());
        using var confirm = await client.GetAsync(Email.ConfirmationLinks[email]);
        Assert.True(confirm.IsSuccessStatusCode, await confirm.Content.ReadAsStringAsync());
        using var login = await client.PostAsJsonAsync("/api/v1/auth/login", new { email, password = "test-password" });
        Assert.True(login.IsSuccessStatusCode, await login.Content.ReadAsStringAsync());
        var payload = await login.Content.ReadFromJsonAsync<JsonObject>();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", payload!["accessToken"]!.GetValue<string>());
        return client;
    }

    public async ValueTask DisposeAsync()
    {
        Client?.Dispose();
        await app.DisposeAsync();
        if (sqlite is not null) await sqlite.DisposeAsync();
    }
}

internal sealed class TestEmail : IEmailSender<BacklogUser>
{
    public Dictionary<string, string> ConfirmationLinks { get; } = [];
    public Dictionary<string, string> ResetCodes { get; } = [];

    public Task SendConfirmationLinkAsync(BacklogUser user, string email, string link)
    {
        ConfirmationLinks[email] = link;
        return Task.CompletedTask;
    }

    public Task SendPasswordResetCodeAsync(BacklogUser user, string email, string code)
    {
        ResetCodes[email] = code;
        return Task.CompletedTask;
    }

    public Task SendPasswordResetLinkAsync(BacklogUser user, string email, string link) =>
        throw new NotSupportedException();
}

internal sealed class TestCatalog : IGameCatalog
{
    private static readonly CatalogGame Game = new(9, "Catalog Game", "https://example.org/cover.png",
        [new(42, "PC"), new(43, "PlayStation")]);

    public Task<CatalogGame?> Find(int rawgId, CancellationToken ct) =>
        Task.FromResult(rawgId == Game.RawgId ? Game : null);

    public Task<PagedResult<CatalogGame>> Search(CatalogQuery query, CancellationToken ct) =>
        query.Q == "offline" ? throw new CatalogUnavailableException()
            : Task.FromResult(new PagedResult<CatalogGame>([Game], query.Page, 20, false));
}
