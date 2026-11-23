using System.Security.Claims;
using FluentValidation;
using GamesBacklog.Application;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;

namespace GamesBacklog.Api.Endpoints;

internal static class GameReviewEndpoints
{
    private static readonly ReviewValidator Validator = new();

    internal static void MapGameReviews(this RouteGroupBuilder api)
    {
        var reviews = api.MapGroup("/catalog/games/{rawgId:int:min(1)}/reviews")
            .WithTags("Críticas").RequireAuthorization().RequireRateLimiting("catalog")
            .ProducesProblem(401).ProducesProblem(429);
        reviews.MapGet("", List).WithName("ListGameReviews").ProducesValidationProblem();
        reviews.MapPut("/mine", Save).WithName("SaveGameReview")
            .ProducesValidationProblem().ProducesProblem(404).ProducesProblem(503);
        reviews.MapDelete("/mine", Delete).WithName("DeleteGameReview");
    }

    private static async Task<Ok<GameReviews>> List(int rawgId, ClaimsPrincipal user,
        IGameReviewStore store, CancellationToken ct, [FromQuery] int page = 1)
    {
        if (page is < 1 or > 10000)
            throw new ValidationException([new("page", "Informe uma página válida.")]);

        return TypedResults.Ok(await store.List(rawgId, user.GetOwnerId(), page, ct));
    }

    private static async Task<NoContent> Save(int rawgId, WriteGameReview request, ClaimsPrincipal user,
        IGameCatalog catalog, IGameReviewStore store, CancellationToken ct)
    {
        await Validator.ValidateAndThrowAsync(request, ct);
        if (await catalog.Find(rawgId, ct) is null) throw new GameNotFoundException();

        await store.Save(rawgId, user.GetOwnerId(), request, ct);
        return TypedResults.NoContent();
    }

    private static async Task<NoContent> Delete(int rawgId, ClaimsPrincipal user,
        IGameReviewStore store, CancellationToken ct)
    {
        await store.Delete(rawgId, user.GetOwnerId(), ct);
        return TypedResults.NoContent();
    }

    private sealed class ReviewValidator : AbstractValidator<WriteGameReview>
    {
        public ReviewValidator()
        {
            RuleFor(x => x.Rating).InclusiveBetween(1, 10).OverridePropertyName("rating");
            RuleFor(x => x.Text).NotEmpty().MaximumLength(2000)
                .Must(text => text?.Contains('\0') != true).OverridePropertyName("text");
        }
    }
}
