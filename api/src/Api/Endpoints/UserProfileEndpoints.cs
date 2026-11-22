using System.Security.Claims;
using FluentValidation;
using GamesBacklog.Application;
using Microsoft.AspNetCore.Http.HttpResults;

namespace GamesBacklog.Api.Endpoints;

internal static class UserProfileEndpoints
{
    internal static void MapUserProfile(this RouteGroupBuilder api)
    {
        var profile = api.MapGroup("/profile").WithTags("Perfil").RequireAuthorization();
        profile.MapGet("", Find).WithName("GetUserProfile").ProducesProblem(401).ProducesProblem(404);
        profile.MapPut("", Update).WithName("UpdateUserProfile").ProducesValidationProblem()
            .ProducesProblem(401).ProducesProblem(404);
    }

    private static async Task<Ok<UserProfile>> Find(ClaimsPrincipal user, UserProfileService service,
        CancellationToken ct) => TypedResults.Ok(await service.Find(Owner(user), ct));

    private static async Task<Ok<UserProfile>> Update(UpdateUserProfile request, ClaimsPrincipal user,
        UserProfileService service, IValidator<UpdateUserProfile> validator, CancellationToken ct)
    {
        await validator.ValidateAndThrowAsync(request, ct);
        return TypedResults.Ok(await service.Update(Owner(user), request, ct));
    }

    private static Guid Owner(ClaimsPrincipal user) => Guid.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)!);
}
