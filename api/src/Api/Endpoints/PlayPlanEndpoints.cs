using System.Security.Claims;
using FluentValidation;
using GamesBacklog.Application;

namespace GamesBacklog.Api.Endpoints;

internal static class PlayPlanEndpoints
{
    internal static void MapPlayPlan(this RouteGroupBuilder backlog)
    {
        backlog.MapGet("/queue", GetQueue).WithName("GetPlayQueue");
        backlog.MapPut("/queue", SaveQueue).WithName("SavePlayQueue").ProducesValidationProblem().ProducesProblem(404);
        backlog.MapGet("/{id:guid}/journal", GetJournal).WithName("GetGameJournal").ProducesProblem(404);
        backlog.MapPut("/{id:guid}/journal", SaveJournal).WithName("SaveGameJournal")
            .ProducesValidationProblem().ProducesProblem(404);
    }

    private static async Task<Microsoft.AspNetCore.Http.HttpResults.Ok<IReadOnlyList<QueuedGame>>> GetQueue(
        ClaimsPrincipal user, IPlayPlanStore store, CancellationToken ct) =>
        TypedResults.Ok(await store.GetQueue(user.GetOwnerId(), ct));

    private static async Task<Microsoft.AspNetCore.Http.HttpResults.NoContent> SaveQueue(
        PlayQueue request, ClaimsPrincipal user, IPlayPlanStore store, CancellationToken ct)
    {
        await new PlayQueueValidator().ValidateAndThrowAsync(request, ct);
        if (!await store.SaveQueue(user.GetOwnerId(), request.GameIds, ct))
            throw new GameNotFoundException();
        return TypedResults.NoContent();
    }

    private static async Task<Microsoft.AspNetCore.Http.HttpResults.Ok<GameJournal>> GetJournal(
        Guid id, ClaimsPrincipal user, IPlayPlanStore store, CancellationToken ct) =>
        TypedResults.Ok(await store.GetJournal(user.GetOwnerId(), id, ct) ?? throw new GameNotFoundException());

    private static async Task<Microsoft.AspNetCore.Http.HttpResults.NoContent> SaveJournal(
        Guid id, GameJournal request, ClaimsPrincipal user, IPlayPlanStore store, CancellationToken ct)
    {
        await new GameJournalValidator().ValidateAndThrowAsync(request, ct);
        if (!await store.SaveJournal(user.GetOwnerId(), id, request, ct))
            throw new GameNotFoundException();
        return TypedResults.NoContent();
    }

    private sealed class PlayQueueValidator : AbstractValidator<PlayQueue>
    {
        public PlayQueueValidator() => RuleFor(x => x.GameIds)
            .Cascade(CascadeMode.Stop).NotNull()
            .Must(ids => ids.Count <= 5 && ids.Distinct().Count() == ids.Count)
            .WithMessage("Selecione até cinco jogos diferentes.")
            .OverridePropertyName("gameIds");
    }

    private sealed class GameJournalValidator : AbstractValidator<GameJournal>
    {
        public GameJournalValidator()
        {
            RuleFor(x => x.LastCheckpoint).MaximumLength(500).Must(NoNullCharacter);
            RuleFor(x => x.NextObjective).MaximumLength(500).Must(NoNullCharacter);
            RuleFor(x => x.Notes).MaximumLength(2000).Must(NoNullCharacter);
        }

        private static bool NoNullCharacter(string? text) => text?.Contains('\0') != true;
    }
}
