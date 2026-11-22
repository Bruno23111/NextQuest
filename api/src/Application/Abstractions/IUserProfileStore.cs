namespace GamesBacklog.Application;

public interface IUserProfileStore
{
    Task<UserProfile?> Find(Guid ownerId, CancellationToken ct);
    Task<UserProfile?> Update(Guid ownerId, UpdateUserProfile request, CancellationToken ct);
}
