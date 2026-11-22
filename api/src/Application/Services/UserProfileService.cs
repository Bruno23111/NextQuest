namespace GamesBacklog.Application;

public sealed class UserProfileService(IUserProfileStore store)
{
    public async Task<UserProfile> Find(Guid ownerId, CancellationToken ct) =>
        await store.Find(ownerId, ct) ?? throw new ProfileNotFoundException();

    public async Task<UserProfile> Update(Guid ownerId, UpdateUserProfile request, CancellationToken ct) =>
        await store.Update(ownerId, request, ct) ?? throw new ProfileNotFoundException();
}
