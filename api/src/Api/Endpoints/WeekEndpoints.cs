using System.Security.Claims;
using GamesBacklog.Infrastructure.Persistence;

namespace GamesBacklog.Api.Endpoints;

internal static class WeekEndpoints
{
    internal static void MapWeek(this RouteGroupBuilder api) =>
        api.MapGet("/week", (ClaimsPrincipal user, WeekOverviewStore store, CancellationToken ct) =>
            store.Get(user.GetOwnerId(), ct)).WithName("GetMyWeek").WithTags("Minha semana")
            .RequireAuthorization().ProducesProblem(401);
}
