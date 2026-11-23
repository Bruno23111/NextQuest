namespace GamesBacklog.Application;

public sealed record DiscordConnection(bool Configured, bool OauthEnabled, string? Name, string? AvatarUrl);

public interface IDiscordAccountLink
{
    Task<DiscordConnection> Get(Guid ownerId, CancellationToken ct);
    string Start(Guid ownerId, bool chooseChannel);
    Task Complete(Guid ownerId, string code, string state, CancellationToken ct);
    Task Disconnect(Guid ownerId, CancellationToken ct);
}
