using FluentValidation;
using GamesBacklog.Domain;

namespace GamesBacklog.Application;

public sealed class BacklogService(IBacklogStore store, IGameCatalog catalog, TimeProvider clock)
{
    public Task<PagedResult<BacklogEntry>> List(Guid ownerId, BacklogQuery query, CancellationToken ct) =>
        store.List(ownerId, query, ct);

    public async Task<BacklogEntry> Find(Guid ownerId, Guid id, CancellationToken ct) =>
        await store.Find(ownerId, id, ct) ?? throw new GameNotFoundException();

    public async Task<BacklogEntry> Create(Guid ownerId, CreateGame request, CancellationToken ct)
    {
        var entry = BacklogEntry.Create(ownerId, request.Title, request.Platform, clock.GetUtcNow());
        await store.Add(entry, ct);
        return entry;
    }

    public async Task<BacklogEntry> Update(Guid ownerId, Guid id, UpdateGame request, CancellationToken ct)
    {
        var entry = await Find(ownerId, id, ct);
        if (!entry.TryUpdate(request.Title, request.Platform, request.Status))
            throw new ValidationException([new("body", "Jogos importados permitem editar apenas o status.")]);

        if (!await store.Save(ct)) throw new GameNotFoundException();
        return entry;
    }

    public async Task Delete(Guid ownerId, Guid id, CancellationToken ct)
    {
        var entry = await Find(ownerId, id, ct);
        if (!await store.Delete(entry, ct)) throw new GameNotFoundException();
    }

    public async Task<BacklogEntry> Import(Guid ownerId, ImportGame request, CancellationToken ct)
    {
        var game = await catalog.Find(request.RawgId, ct) ?? throw new GameNotFoundException();
        var platform = game.Platforms.FirstOrDefault(candidate => candidate.Id == request.PlatformId);
        if (platform is null)
            throw new ValidationException([new("platformId", "Selecione uma plataforma disponível para este jogo.")]);

        var entry = BacklogEntry.Import(ownerId, game.Title, platform.Name, game.RawgId, platform.Id,
            game.CoverUrl, clock.GetUtcNow());

        await store.Add(entry, ct);
        return entry;
    }
}
