using System.Security.Claims;
using FluentValidation;
using Microsoft.AspNetCore.Mvc;
using GamesBacklog.Application;
using Microsoft.AspNetCore.Http.HttpResults;

namespace GamesBacklog.Api.Endpoints;

internal static class UserProfileEndpoints
{
    internal static void MapUserProfile(this RouteGroupBuilder api)
    {
        var profile = api.MapGroup("/profile").WithTags("Perfil").RequireAuthorization();
        profile.MapPut("/images", UpdateWithImages).WithName("UpdateUserProfileWithImages")
            .Accepts<IFormFileCollection>("multipart/form-data")
            .ProducesValidationProblem().ProducesProblem(401).ProducesProblem(404).ProducesProblem(415);
        profile.MapGet("", Find).WithName("GetUserProfile").ProducesProblem(401).ProducesProblem(404);
        profile.MapPut("", Update).WithName("UpdateUserProfile").ProducesValidationProblem()
            .ProducesProblem(401).ProducesProblem(404);
    }

    private static async Task<Ok<UserProfile>> Find(ClaimsPrincipal user, UserProfileService service,
        CancellationToken ct) => TypedResults.Ok(await service.Find(user.GetOwnerId(), ct));

    private static async Task<Ok<UserProfile>> Update(UpdateUserProfile request, ClaimsPrincipal user,
        UserProfileService service, IValidator<UpdateUserProfile> validator, CancellationToken ct)
    {
        await validator.ValidateAndThrowAsync(request, ct);
        return TypedResults.Ok(await service.Update(user.GetOwnerId(), request, ct));
    }

    [RequestSizeLimit(5 * 1024 * 1024)]
    private static async Task<Results<Ok<UserProfile>, StatusCodeHttpResult>> UpdateWithImages(
        HttpRequest request, ClaimsPrincipal user, UserProfileService service,
        IValidator<UpdateUserProfile> validator, CancellationToken ct)
    {
        if (!request.HasFormContentType)
            return TypedResults.StatusCode(StatusCodes.Status415UnsupportedMediaType);

        var form = await request.ReadFormAsync(ct);
        var update = new UpdateUserProfile(form["displayName"].ToString(), form["bio"].ToString(), null, null);
        await validator.ValidateAndThrowAsync(update, ct);

        var ownerId = user.GetOwnerId();
        var current = await service.Find(ownerId, ct);
        var avatar = await ProfileImageUpload.Read(form.Files.GetFile("avatar"), "avatar", ct);
        var header = await ProfileImageUpload.Read(form.Files.GetFile("header"), "header", ct);
        return TypedResults.Ok(await service.Update(ownerId, update with
        {
            AvatarUrl = avatar ?? current.AvatarUrl,
            HeaderUrl = header ?? current.HeaderUrl
        }, ct));
    }
}
