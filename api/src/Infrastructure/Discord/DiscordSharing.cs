using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text.RegularExpressions;
using System.Text.Json;
using System.Text.Json.Serialization;
using FluentValidation;
using GamesBacklog.Application;
using GamesBacklog.Infrastructure.Persistence;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;

namespace GamesBacklog.Infrastructure.Discord;

public sealed partial class DiscordSharing(
    HttpClient client, BacklogDbContext db, IDataProtectionProvider protection) : IDiscordSharing
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    private readonly IDataProtector protector = protection.CreateProtector("NextQuest.DiscordWebhook.v1");

    [GeneratedRegex(@"\Ahttps://discord\.com/api/webhooks/([0-9]{15,22})/([A-Za-z0-9_-]{20,200})\z",
        RegexOptions.CultureInvariant)]
    private static partial Regex WebhookPattern();

    public Task<bool> IsConfigured(Guid ownerId, CancellationToken ct) =>
        db.Users.AnyAsync(x => x.Id == ownerId && x.DiscordWebhookSecret != null, ct);

    public async Task SetWebhook(Guid ownerId, string? webhookUrl, CancellationToken ct)
    {
        string? secret = null;
        if (webhookUrl is not null)
        {
            secret = ProtectWebhook(webhookUrl, protector);
        }

        var changed = await db.Users.Where(x => x.Id == ownerId)
            .ExecuteUpdateAsync(update => update.SetProperty(x => x.DiscordWebhookSecret, secret), ct);
        if (changed == 0) throw new ProfileNotFoundException();
    }

    internal static string ProtectWebhook(string webhookUrl, IDataProtector protector)
    {
        var match = WebhookPattern().Match(webhookUrl.Trim());
        if (!match.Success)
            throw new ValidationException([new("webhookUrl", "Informe uma URL de webhook do Discord válida.")]);

        return protector.Protect($"{match.Groups[1].Value}/{match.Groups[2].Value}");
    }

    public async Task<bool> Send(Guid ownerId, DiscordPost post, CancellationToken ct)
    {
        var secret = await db.Users.Where(x => x.Id == ownerId)
            .Select(x => x.DiscordWebhookSecret).SingleOrDefaultAsync(ct);
        if (secret is null) return false;

        try
        {
            var path = protector.Unprotect(secret);
            var thumbnail = Uri.TryCreate(post.ImageUrl, UriKind.Absolute, out var image) &&
                image.Scheme == Uri.UriSchemeHttps && image.UserInfo.Length == 0
                    ? new { url = image.AbsoluteUri }
                    : null;
            using var response = await client.PostAsJsonAsync($"webhooks/{path}", new
            {
                allowed_mentions = new { parse = Array.Empty<string>() },
                embeds = new[] { new { title = post.Title, description = post.Description, thumbnail } }
            }, JsonOptions, ct);
            if (!response.IsSuccessStatusCode) throw new DiscordUnavailableException();
            return true;
        }
        catch (Exception error) when (error is HttpRequestException or CryptographicException ||
            error is OperationCanceledException && !ct.IsCancellationRequested)
        {
            throw new DiscordUnavailableException();
        }
    }
}
