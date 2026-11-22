namespace GamesBacklog.Infrastructure.Steam;

public sealed class SteamLoginFlow
{
    public required string State { get; init; }
    public required string Challenge { get; init; }
    public required long ExpiresAt { get; init; }
    public Guid? LinkOwnerId { get; init; }
    public string? Nonce { get; private set; }
    public string? SteamId { get; private set; }
    public string? CodeHash { get; private set; }
}
