using Microsoft.AspNetCore.Identity;

namespace GamesBacklog.Infrastructure.Identity;

public sealed class BacklogUserConfirmation : IUserConfirmation<BacklogUser>
{
    public Task<bool> IsConfirmedAsync(UserManager<BacklogUser> manager, BacklogUser user) =>
        Task.FromResult(user.EmailConfirmed || user.Email is null && user.SteamId is not null);
}
