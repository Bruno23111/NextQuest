namespace GamesBacklog.Application;

public sealed record DiscordPost(string Title, string Description, string? ImageUrl);

public interface IDiscordSharing
{
    Task<bool> IsConfigured(Guid ownerId, CancellationToken ct);
    Task SetWebhook(Guid ownerId, string? webhookUrl, CancellationToken ct);
    Task<bool> Send(Guid ownerId, DiscordPost post, CancellationToken ct);
}
