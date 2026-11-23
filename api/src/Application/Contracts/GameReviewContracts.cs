namespace GamesBacklog.Application;

public sealed record WriteGameReview(int Rating, string? Text);
public sealed record GameReviewView(
    string AuthorName,
    int Rating,
    string Text,
    DateTimeOffset UpdatedAt,
    string? AuthorAvatarUrl = null);
public sealed record GameReviews(PagedResult<GameReviewView> Community, GameReviewView? Mine);

public interface IGameReviewStore
{
    Task<GameReviews> List(int rawgId, Guid ownerId, int page, CancellationToken ct);
    Task Save(int rawgId, Guid ownerId, WriteGameReview review, CancellationToken ct);
    Task Delete(int rawgId, Guid ownerId, CancellationToken ct);
}
