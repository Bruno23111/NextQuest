using GamesBacklog.Application;
using Microsoft.EntityFrameworkCore;

namespace GamesBacklog.Infrastructure.Persistence;

public sealed class GameReviewStore(BacklogDbContext db, TimeProvider clock) : IGameReviewStore
{
    public async Task<GameReviews> List(int rawgId, Guid ownerId, int page, CancellationToken ct)
    {
        const int pageSize = 10;
        var reviews = from review in db.GameReviews.AsNoTracking()
                      join user in db.Users.AsNoTracking() on review.AuthorId equals user.Id
                      where review.RawgId == rawgId
                      select new
                      {
                          review.AuthorId,
                          review.UpdatedAt,
                          View = new GameReviewView(user.DisplayName ?? "Jogador NextQuest",
                              review.Rating, review.Text, review.UpdatedAt, user.AvatarUrl)
                      };

        var mine = await reviews.Where(x => x.AuthorId == ownerId).Select(x => x.View).SingleOrDefaultAsync(ct);
        var items = await reviews.OrderByDescending(x => x.UpdatedAt).ThenBy(x => x.AuthorId)
            .Skip((page - 1) * pageSize).Take(pageSize + 1).Select(x => x.View).ToListAsync(ct);
        var hasMore = items.Count > pageSize;
        if (hasMore) items.RemoveAt(pageSize);

        return new(new(items, page, pageSize, hasMore), mine);
    }

    public Task Save(int rawgId, Guid ownerId, WriteGameReview review, CancellationToken ct) =>
        db.Database.ExecuteSqlInterpolatedAsync($"""
            INSERT INTO "GameReviews" ("RawgId", "AuthorId", "Rating", "Text", "UpdatedAt")
            VALUES ({rawgId}, {ownerId}, {review.Rating}, {review.Text!.Trim()}, {clock.GetUtcNow()})
            ON CONFLICT ("RawgId", "AuthorId") DO UPDATE
            SET "Rating" = EXCLUDED."Rating", "Text" = EXCLUDED."Text", "UpdatedAt" = EXCLUDED."UpdatedAt"
            """, ct);

    public Task Delete(int rawgId, Guid ownerId, CancellationToken ct) =>
        db.GameReviews.Where(x => x.RawgId == rawgId && x.AuthorId == ownerId).ExecuteDeleteAsync(ct);
}
