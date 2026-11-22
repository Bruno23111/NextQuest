namespace GamesBacklog.Application;

public sealed record PlayQueue(IReadOnlyList<Guid> GameIds);
public sealed record QueuedGame(Guid Id, string Title);
public sealed record GameJournal(string? LastCheckpoint, string? NextObjective, string? Notes);

public interface IPlayPlanStore
{
    Task<IReadOnlyList<QueuedGame>> GetQueue(Guid ownerId, CancellationToken ct);
    Task<bool> SaveQueue(Guid ownerId, IReadOnlyList<Guid> ids, CancellationToken ct);
    Task<GameJournal?> GetJournal(Guid ownerId, Guid gameId, CancellationToken ct);
    Task<bool> SaveJournal(Guid ownerId, Guid gameId, GameJournal journal, CancellationToken ct);
}
