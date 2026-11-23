using GamesBacklog.Application;
using GamesBacklog.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace GamesBacklog.Infrastructure.Identity;

public sealed class UserProfileStore(BacklogDbContext db) : IUserProfileStore
{
    public async Task<UserProfile?> Find(Guid ownerId, CancellationToken ct)
    {
        var user = await db.Users.AsNoTracking().SingleOrDefaultAsync(user => user.Id == ownerId, ct);
        if (user is null) return null;

        var fallbackName = user.Email is { } email ? email.Split('@', 2)[0] : "Jogador";
        return new UserProfile(user.DisplayName ?? fallbackName, user.Bio, user.AvatarUrl, user.HeaderUrl, user.SteamId is not null);
    }

    public async Task<UserProfile?> Update(Guid ownerId, UpdateUserProfile request, CancellationToken ct)
    {
        var user = await db.Users.SingleOrDefaultAsync(user => user.Id == ownerId, ct);
        if (user is null) return null;

        user.DisplayName = request.DisplayName.Trim();
        user.Bio = Normalize(request.Bio);
        user.AvatarUrl = Normalize(request.AvatarUrl);
        user.HeaderUrl = Normalize(request.HeaderUrl);
        await db.SaveChangesAsync(ct);

        return new UserProfile(user.DisplayName, user.Bio, user.AvatarUrl, user.HeaderUrl, user.SteamId is not null);
    }

    private static string? Normalize(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
