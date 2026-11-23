using Microsoft.AspNetCore.Identity;

namespace GamesBacklog.Infrastructure.Identity;

public sealed class BacklogUser : IdentityUser<Guid>
{
    public BacklogUser() => Id = Guid.NewGuid();

    public string? SteamId { get; set; }
    public string? DiscordWebhookSecret { get; set; }
    public string? DiscordUserId { get; set; }
    public string? DiscordName { get; set; }
    public string? DiscordAvatar { get; set; }
    public Guid[] PlayQueue { get; set; } = [];
    public string? DisplayName { get; set; }
    public string? Bio { get; set; }
    public string? AvatarUrl { get; set; }
    public string? HeaderUrl { get; set; }
}
