using System.Security.Claims;
using GamesBacklog.Application;
using Microsoft.AspNetCore.Http.HttpResults;

namespace GamesBacklog.Api.Endpoints;

internal static class SteamGameDataEndpoints
{
    internal static void MapSteamGameData(this RouteGroupBuilder api)
    {
        var steam = api.MapGroup("/steam").WithTags("Steam")
            .RequireAuthorization().RequireRateLimiting("catalog");
        steam.MapGet("/library", Library).WithName("SteamLibrary")
            .ProducesProblem(401).ProducesProblem(403).ProducesProblem(409).ProducesProblem(503).ProducesProblem(429);
        steam.MapGet("/games/{appId:int}/achievements", Achievements).WithName("SteamGameAchievements")
            .ProducesValidationProblem().ProducesProblem(401).ProducesProblem(403).ProducesProblem(409)
            .ProducesProblem(503).ProducesProblem(429);
    }

    private static async Task<Ok<SteamLibrary>> Library(ClaimsPrincipal user, ISteamGameDataService steam,
        CancellationToken ct) => TypedResults.Ok(await steam.GetLibrary(user.GetOwnerId(), ct));

    private static async Task<Ok<SteamGameAchievements>> Achievements(int appId, ClaimsPrincipal user,
        ISteamGameDataService steam, CancellationToken ct) =>
        TypedResults.Ok(await steam.GetAchievements(user.GetOwnerId(), appId, ct));
}
