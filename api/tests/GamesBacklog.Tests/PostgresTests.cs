using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using Npgsql;

namespace GamesBacklog.Tests;

public sealed class RequiresPostgresAttribute : FactAttribute
{
    public RequiresPostgresAttribute()
    {
        if (string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("GAMESBACKLOG_TEST_POSTGRES")))
            Skip = "Configure GAMESBACKLOG_TEST_POSTGRES para executar os testes com PostgreSQL.";
    }
}

public sealed class PostgresTests
{
    [RequiresPostgres]
    public async Task PostgresAppliesMigrationsAndIsolatesListsAndConcurrentImports()
    {
        var settings = new NpgsqlConnectionStringBuilder(Environment.GetEnvironmentVariable("GAMESBACKLOG_TEST_POSTGRES"));
        var schema = "gamesbacklog_test_" + Guid.NewGuid().ToString("N");
        await using var connection = new NpgsqlConnection(settings.ConnectionString);
        await connection.OpenAsync();
        await using (var createSchema = new NpgsqlCommand($"CREATE SCHEMA {schema}", connection))
            await createSchema.ExecuteNonQueryAsync();

        settings.SearchPath = schema;
        try
        {
            await using var api = await TestApi.Start(settings.ConnectionString);
            using var owner = await api.Login("first@example.org");
            using var other = await api.Login("second@example.org");

            for (var i = 0; i < 21; i++)
            {
                using var create = await owner.PostAsJsonAsync("/api/v1/backlog", new { title = $"Game {i:00}", platform = "PC" });
                Assert.Equal(HttpStatusCode.Created, create.StatusCode);
            }

            var firstPage = await owner.GetFromJsonAsync<JsonObject>("/api/v1/backlog");
            Assert.Equal(20, firstPage!["items"]!.AsArray().Count);
            Assert.Equal("Game 20", firstPage["items"]![0]!["title"]!.GetValue<string>());
            Assert.True(firstPage["hasMore"]!.GetValue<bool>());
            using var filtered = await owner.GetAsync("/api/v1/backlog?page=2&q=GAME&status=planned");
            Assert.True(filtered.IsSuccessStatusCode, await filtered.Content.ReadAsStringAsync());
            var secondPage = await filtered.Content.ReadFromJsonAsync<JsonObject>();
            Assert.Single(secondPage!["items"]!.AsArray());
            Assert.False(secondPage["hasMore"]!.GetValue<bool>());
            using var invalidStatus = await owner.GetAsync("/api/v1/backlog?status=unknown");
            Assert.Equal(HttpStatusCode.BadRequest, invalidStatus.StatusCode);
            var invalidStatusProblem = await invalidStatus.Content.ReadFromJsonAsync<JsonObject>();
            Assert.NotNull(invalidStatusProblem?["errors"]?["status"]);
            var literal = await owner.GetFromJsonAsync<JsonObject>("/api/v1/backlog?q=%25");
            Assert.Empty(literal!["items"]!.AsArray());
            var empty = await other.GetFromJsonAsync<JsonObject>("/api/v1/backlog");
            Assert.Empty(empty!["items"]!.AsArray());

            var catalog = await owner.GetFromJsonAsync<JsonObject>("/api/v1/catalog/games?q=Catalog");
            Assert.Single(catalog!["items"]!.AsArray());

            using var invalid = await owner.PostAsJsonAsync("/api/v1/backlog/import", new { rawgId = 9, platformId = 12345 });
            Assert.Equal(HttpStatusCode.BadRequest, invalid.StatusCode);

            var request = new { rawgId = 9, platformId = 42 };
            var pending = await Task.WhenAll(Enumerable.Range(0, 4)
                .Select(_ => owner.PostAsJsonAsync("/api/v1/backlog/import", request)));
            try
            {
                Assert.Single(pending, response => response.StatusCode == HttpStatusCode.Created);
                Assert.Equal(3, pending.Count(response => response.StatusCode == HttpStatusCode.Conflict));
                var imported = pending.Single(response => response.StatusCode == HttpStatusCode.Created);
                using var invalidPatch = await owner.PatchAsJsonAsync(imported.Headers.Location, new { platform = "Other" });
                Assert.Equal(HttpStatusCode.BadRequest, invalidPatch.StatusCode);
                using var update = await owner.PatchAsJsonAsync(imported.Headers.Location, new { status = "completed" });
                Assert.Equal(HttpStatusCode.OK, update.StatusCode);
                var completed = await owner.GetFromJsonAsync<JsonObject>("/api/v1/backlog?status=completed");
                Assert.Single(completed!["items"]!.AsArray());
            }
            finally
            {
                foreach (var response in pending) response.Dispose();
            }

            using var sameGameOtherOwner = await other.PostAsJsonAsync("/api/v1/backlog/import", request);
            Assert.Equal(HttpStatusCode.Created, sameGameOtherOwner.StatusCode);
        }
        finally
        {
            await using var dropSchema = new NpgsqlCommand($"DROP SCHEMA {schema} CASCADE", connection);
            await dropSchema.ExecuteNonQueryAsync();
        }
    }
}
