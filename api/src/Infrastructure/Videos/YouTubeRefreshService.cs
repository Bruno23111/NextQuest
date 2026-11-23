using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace GamesBacklog.Infrastructure.Videos;

internal sealed class YouTubeRefreshService(IServiceScopeFactory scopes, ILogger<YouTubeRefreshService> logger)
    : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromHours(6));
        // Avoid competing with startup and skip work on short-lived development hosts.
        await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);
        do
        {
            try
            {
                await using var scope = scopes.CreateAsyncScope();
                var store = scope.ServiceProvider.GetRequiredService<GameVideoStore>();
                var youtube = scope.ServiceProvider.GetRequiredService<YouTubeClient>();
                await store.PurgeExpired(stoppingToken);
                if (youtube.Available) await store.Refresh(youtube, stoppingToken);
            }
            catch (Exception error) when (!stoppingToken.IsCancellationRequested)
            {
                logger.LogWarning("YouTube maintenance could not complete ({ErrorType}).", error.GetType().Name);
            }
        } while (await timer.WaitForNextTickAsync(stoppingToken));
    }
}
