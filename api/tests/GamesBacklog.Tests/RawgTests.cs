using System.Net;
using GamesBacklog.Application;
using GamesBacklog.Infrastructure.Catalog;
using Microsoft.Extensions.Options;

namespace GamesBacklog.Tests;

public sealed class RawgTests
{
    [Fact]
    public async Task SearchMapsPlatformsAndDoesNotFollowProviderPaginationUrls()
    {
        using var client = new HttpClient(new Stub(request =>
        {
            Assert.Equal("?search=A%26B&page=3&page_size=20&key=fake%2Bkey", request.RequestUri!.Query);
            return new(HttpStatusCode.OK)
            {
                Content = new StringContent("""
                    {"next":"https://invalid.example/?key=secret","results":[
                      {"id":12,"name":"A&B","background_image":"https://example.org/game.png",
                       "platforms":[{"platform":{"id":4,"name":"PC"}}]}
                    ]}
                    """)
            };
        })) { BaseAddress = new Uri("https://api.rawg.io/api/") };
        var catalog = new RawgCatalog(client, Options.Create(new RawgOptions { ApiKey = "fake+key" }));
        var page = await catalog.Search(new(" A&B ", 3), CancellationToken.None);
        Assert.True(page.HasMore);
        Assert.Equal(3, page.Page);
        var game = Assert.Single(page.Items);
        Assert.Equal(12, game.RawgId);
        Assert.Equal("PC", Assert.Single(game.Platforms).Name);
    }

    [Fact]
    public async Task CatalogDistinguishesMissingGamesFromProviderFailure()
    {
        using var client = new HttpClient(new Stub(request =>
            new(request.RequestUri!.AbsolutePath.EndsWith("/games/4")
                ? HttpStatusCode.NotFound : HttpStatusCode.TooManyRequests)))
        {
            BaseAddress = new Uri("https://api.rawg.io/api/")
        };
        var catalog = new RawgCatalog(client, Options.Create(new RawgOptions { ApiKey = "fake" }));
        Assert.Null(await catalog.Find(4, CancellationToken.None));
        await Assert.ThrowsAsync<CatalogUnavailableException>(() => catalog.Search(new("Game"), CancellationToken.None));
    }

    private sealed class Stub(Func<HttpRequestMessage, HttpResponseMessage> send) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) =>
            Task.FromResult(send(request));
    }
}
