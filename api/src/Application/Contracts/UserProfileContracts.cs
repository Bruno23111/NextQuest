namespace GamesBacklog.Application;

public sealed record UserProfile(
    string DisplayName,
    string? Bio,
    string? AvatarUrl,
    string? HeaderUrl);

public sealed record UpdateUserProfile(
    string DisplayName,
    string? Bio,
    string? AvatarUrl,
    string? HeaderUrl);
