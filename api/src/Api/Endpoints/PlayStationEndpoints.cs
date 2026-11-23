using System.Security.Claims;
using FluentValidation;
using GamesBacklog.Application;
using GamesBacklog.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;

namespace GamesBacklog.Api.Endpoints;

internal static class PlayStationEndpoints
{
    internal static void MapPlayStation(this RouteGroupBuilder api)
    {
        var games = api.MapGroup("/playstation/games").RequireAuthorization().WithTags("PlayStation");
        games.MapGet("", List).ProducesValidationProblem().ProducesProblem(401);
        games.MapPut("/{id:guid}/trophies", Save).Produces(204)
            .ProducesValidationProblem().ProducesProblem(401).ProducesProblem(404);
    }

    private static Task<PagedResult<PlayStationGame>> List(ClaimsPrincipal user, PlayStationStore store,
        CancellationToken ct, [FromQuery] string? q = null, [FromQuery] int page = 1)
    {
        if (page < 1 || page > int.MaxValue / PlayStationStore.PageSize)
            throw new ValidationException([new("page", "Informe uma página válida.")]);
        if (q?.Trim().Length > 120)
            throw new ValidationException([new("q", "Pesquise com até 120 caracteres.")]);

        return store.List(user.GetOwnerId(), q, page, ct);
    }

    private static async Task<IResult> Save(Guid id, TrophyCounts counts, ClaimsPrincipal user,
        PlayStationStore store, CancellationToken ct)
    {
        if (new[] { counts.Bronze, counts.Silver, counts.Gold, counts.Platinum }.Any(value => value is < 0 or > 9999))
            throw new ValidationException([new("counts", "Informe quantidades inteiras entre 0 e 9999.")]);
        return await store.SaveTrophies(user.GetOwnerId(), id, counts, ct)
            ? Results.NoContent()
            : Results.Problem(statusCode: 404, title: "Jogo PlayStation não encontrado na sua biblioteca.");
    }
}
