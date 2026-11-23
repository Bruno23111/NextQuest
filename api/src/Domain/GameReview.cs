namespace GamesBacklog.Domain;

public sealed class GameReview
{
    public int RawgId { get; private set; }
    public Guid AuthorId { get; private set; }
    public int Rating { get; private set; }
    public string Text { get; private set; } = null!;
    public DateTimeOffset UpdatedAt { get; private set; }
}
