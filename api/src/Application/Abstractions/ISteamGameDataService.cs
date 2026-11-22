namespace GamesBacklog.Application;

public interface ISteamGameDataService
{
    Task<SteamLibrary> GetLibrary(Guid ownerId, CancellationToken ct);
    Task<SteamGameAchievements> GetAchievements(Guid ownerId, int appId, CancellationToken ct);
}
