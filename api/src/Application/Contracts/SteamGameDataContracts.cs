namespace GamesBacklog.Application;

public sealed record SteamLibrary(int GameCount, IReadOnlyList<SteamLibraryGame> Games);

public sealed record SteamLibraryGame(
    int AppId,
    string Name,
    int PlaytimeForeverMinutes,
    int? PlaytimeTwoWeeksMinutes,
    string? IconUrl);

public sealed record SteamGameAchievements(
    int AppId,
    string GameName,
    int UnlockedCount,
    int TotalCount,
    IReadOnlyList<SteamAchievement> Achievements);

public sealed record SteamAchievement(
    string ApiName,
    string Name,
    string? Description,
    bool Achieved,
    DateTimeOffset? UnlockedAt,
    string? IconUrl,
    string? GrayIconUrl);
