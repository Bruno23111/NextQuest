using System.Security.Claims;
using FluentValidation;
using GamesBacklog.Application;
using GamesBacklog.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;

namespace GamesBacklog.Api.Endpoints;

internal static class SocialEndpoints
{
    internal static void MapSocial(this RouteGroupBuilder api)
    {
        var friends = api.MapGroup("/friends").RequireAuthorization().WithTags("Amigos");
        friends.MapGet("", Connections);
        friends.MapGet("/{id:guid}", Profile).Produces<FriendProfile>().ProducesValidationProblem().ProducesProblem(404);
        friends.MapPut("/request", Request).RequireRateLimiting("social")
            .ProducesValidationProblem().ProducesProblem(404);
        friends.MapPost("/code/rotate", RotateCode).RequireRateLimiting("social");
        friends.MapPut("/{id:guid}/accept", Accept).ProducesProblem(404);
        friends.MapDelete("/{id:guid}", Remove);

        var wishlist = api.MapGroup("/wishlist").RequireAuthorization().WithTags("Lista de desejos");
        wishlist.MapGet("", Wishlist).ProducesValidationProblem();
        wishlist.MapGet("/ids", (ClaimsPrincipal user, SocialStore store, CancellationToken ct) =>
            store.WishIds(user.GetOwnerId(), ct));
        wishlist.MapPut("/{gameId:int:min(1)}", AddWish).ProducesProblem(404);
        wishlist.MapDelete("/{gameId:int:min(1)}", RemoveWish);
    }

    private static async Task<ConnectionsResult> Connections(ClaimsPrincipal user, SocialStore store, CancellationToken ct)
    {
        var owner = user.GetOwnerId();
        return new(await store.FriendCode(owner, ct), await store.Connections(owner, ct));
    }

    private static async Task<IResult> Profile(Guid id, ClaimsPrincipal user, SocialStore store, CancellationToken ct,
        [FromQuery] int page = 1, [FromQuery] int wishlistPage = 1)
    {
        ValidatePage(page);
        ValidatePage(wishlistPage);
        var profile = await store.Profile(user.GetOwnerId(), id, page, wishlistPage, ct);
        return profile is null ? Results.Problem(statusCode: 404, title: "Perfil de amigo não encontrado.")
            : Results.Ok(profile);
    }

    private static async Task<IResult> Request(FriendRequest request, ClaimsPrincipal user, SocialStore store,
        CancellationToken ct)
    {
        var code = request.Code?.Trim().ToLowerInvariant();
        if (code is not { Length: 20 } || !code.All(Uri.IsHexDigit))
            throw new ValidationException([new("code", "Informe um código de amizade válido.")]);

        var owner = user.GetOwnerId();
        var id = await store.FindByCode(code, ct);
        if (id == owner)
            throw new ValidationException([new("code", "Use o código de outro jogador.")]);
        if (id is null)
            return Results.Problem(statusCode: 404, title: "Nenhum jogador encontrado com esse código.");

        await store.Request(owner, id.Value, ct);
        return Results.NoContent();
    }

    private static async Task<CodeResult> RotateCode(ClaimsPrincipal user, SocialStore store, CancellationToken ct) =>
        new(await store.RotateCode(user.GetOwnerId(), ct));

    private static async Task<IResult> Accept(Guid id, ClaimsPrincipal user, SocialStore store, CancellationToken ct) =>
        await store.Accept(user.GetOwnerId(), id, ct) ? Results.NoContent()
            : Results.Problem(statusCode: 404, title: "Pedido de amizade não encontrado.");

    private static async Task<IResult> Remove(Guid id, ClaimsPrincipal user, SocialStore store, CancellationToken ct)
    {
        await store.Remove(user.GetOwnerId(), id, ct);
        return Results.NoContent();
    }

    private static Task<PagedResult<CatalogGame>> Wishlist(ClaimsPrincipal user, SocialStore store,
        CancellationToken ct, [FromQuery] int page = 1)
    {
        ValidatePage(page);
        return store.Wishlist(user.GetOwnerId(), page, ct);
    }

    private static async Task<IResult> AddWish(int gameId, ClaimsPrincipal user, SocialStore store, CancellationToken ct) =>
        await store.AddWish(user.GetOwnerId(), gameId, ct) ? Results.NoContent()
            : Results.Problem(statusCode: 404, title: "Jogo não encontrado no catálogo.");

    private static async Task<IResult> RemoveWish(int gameId, ClaimsPrincipal user, SocialStore store, CancellationToken ct)
    {
        await store.RemoveWish(user.GetOwnerId(), gameId, ct);
        return Results.NoContent();
    }

    private static void ValidatePage(int page)
    {
        if (page < 1 || page > int.MaxValue / SocialStore.PageSize)
            throw new ValidationException([new("page", "Informe uma página válida.")]);
    }

    private sealed record ConnectionsResult(string Code, IReadOnlyList<FriendConnection> Connections);
    private sealed record FriendRequest(string? Code);
    private sealed record CodeResult(string Code);
}
