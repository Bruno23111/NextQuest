using System.Security.Claims;
using FluentValidation;
using GamesBacklog.Application;
using GamesBacklog.Domain;
using Microsoft.AspNetCore.Http.HttpResults;

namespace GamesBacklog.Api.Endpoints;

internal static class DiscordEndpoints
{
    internal static void MapDiscord(this RouteGroupBuilder api)
    {
        var group = api.MapGroup("/discord").WithTags("Discord").RequireAuthorization()
            .RequireRateLimiting("discord").ProducesProblem(401).ProducesProblem(429);
        group.MapGet("", Status).WithName("GetDiscordIntegration").ProducesProblem(404);
        group.MapPost("/oauth/start", StartLink).WithName("StartDiscordLink").ProducesProblem(503);
        group.MapPost("/oauth/complete", CompleteLink).WithName("CompleteDiscordLink")
            .ProducesValidationProblem().ProducesProblem(409).ProducesProblem(503);
        group.MapDelete("/account", DisconnectAccount).WithName("DisconnectDiscordAccount").ProducesProblem(404);
        group.MapPut("", Configure).WithName("SetDiscordIntegration").ProducesValidationProblem().ProducesProblem(404);
        group.MapDelete("", Disconnect).WithName("RemoveDiscordIntegration").ProducesProblem(404);
        group.MapPost("/games/{id:guid}", ShareGame).WithName("ShareDiscordGame")
            .ProducesProblem(404).ProducesProblem(409).ProducesProblem(503);
        group.MapPost("/games/{id:guid}/invite", Invite).WithName("SendDiscordGameInvite")
            .ProducesValidationProblem().ProducesProblem(404).ProducesProblem(409).ProducesProblem(503);
        group.MapPost("/steam/{appId:int}/achievements", ShareAchievement).WithName("ShareDiscordAchievement")
            .ProducesValidationProblem().ProducesProblem(403).ProducesProblem(404).ProducesProblem(409).ProducesProblem(503);
    }

    internal sealed record Settings(string? WebhookUrl);
    internal sealed record StartRequest(bool ChooseChannel);
    internal sealed record AuthorizationResponse(string AuthorizationUrl);
    internal sealed record CompleteRequest(string? Code, string? State);
    internal sealed record InviteRequest(DateTimeOffset StartsAt, string? Message);
    internal sealed record AchievementRequest(string? ApiName);

    private static async Task<Ok<DiscordConnection>> Status(
        ClaimsPrincipal user, IDiscordAccountLink link, CancellationToken ct) =>
        TypedResults.Ok(await link.Get(user.GetOwnerId(), ct));

    private static Ok<AuthorizationResponse> StartLink(StartRequest request, ClaimsPrincipal user,
        IDiscordAccountLink link) =>
        TypedResults.Ok(new AuthorizationResponse(link.Start(user.GetOwnerId(), request.ChooseChannel)));

    private static async Task<NoContent> CompleteLink(CompleteRequest request, ClaimsPrincipal user,
        IDiscordAccountLink link, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Code) || request.Code.Length > 512 ||
            string.IsNullOrWhiteSpace(request.State) || request.State.Length > 2048)
            throw new ValidationException([new("oauth", "Retorno do Discord inválido.")]);

        await link.Complete(user.GetOwnerId(), request.Code, request.State, ct);
        return TypedResults.NoContent();
    }

    private static async Task<NoContent> DisconnectAccount(ClaimsPrincipal user, IDiscordAccountLink link, CancellationToken ct)
    {
        await link.Disconnect(user.GetOwnerId(), ct);
        return TypedResults.NoContent();
    }

    private static async Task<NoContent> Configure(Settings settings, ClaimsPrincipal user,
        IDiscordSharing discord, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(settings.WebhookUrl) || settings.WebhookUrl.Length > 300)
            throw new ValidationException([new("webhookUrl", "Informe uma URL de webhook do Discord válida.")]);

        await discord.SetWebhook(user.GetOwnerId(), settings.WebhookUrl, ct);
        return TypedResults.NoContent();
    }

    private static async Task<NoContent> Disconnect(ClaimsPrincipal user, IDiscordSharing discord, CancellationToken ct)
    {
        await discord.SetWebhook(user.GetOwnerId(), null, ct);
        return TypedResults.NoContent();
    }

    private static async Task<Results<NoContent, ProblemHttpResult>> ShareGame(Guid id, ClaimsPrincipal user,
        BacklogService backlog, IDiscordSharing discord, CancellationToken ct)
    {
        var ownerId = user.GetOwnerId();
        var game = await backlog.Find(ownerId, id, ct);
        if (game.Status != GameStatus.Completed)
            return TypedResults.Problem(statusCode: 409, title: "Marque o jogo como zerado antes de compartilhar.");

        return await Publish(discord, ownerId, new($"Jogo zerado: {game.Title}", $"Plataforma: {game.Platform}", game.CoverUrl), ct);
    }

    private static async Task<Results<NoContent, ProblemHttpResult>> Invite(Guid id, InviteRequest request,
        ClaimsPrincipal user, BacklogService backlog, IDiscordSharing discord, TimeProvider clock,
        CancellationToken ct)
    {
        if (request.StartsAt <= clock.GetUtcNow())
            throw new ValidationException([new("startsAt", "Escolha uma data e um horário no futuro.")]);

        var message = request.Message?.Trim();
        if (message is { Length: > 300 })
            throw new ValidationException([new("message", "Use até 300 caracteres no convite.")]);

        var ownerId = user.GetOwnerId();
        var game = await backlog.Find(ownerId, id, ct);
        var timestamp = request.StartsAt.ToUnixTimeSeconds();
        var description = $"Plataforma: {game.Platform}\nQuando: <t:{timestamp}:F> (<t:{timestamp}:R>)";
        if (!string.IsNullOrEmpty(message))
            description += $"\n\n{message}";

        return await Publish(discord, ownerId, new($"Bora jogar? {game.Title}", description, game.CoverUrl), ct);
    }

    private static async Task<Results<NoContent, ProblemHttpResult>> ShareAchievement(int appId,
        AchievementRequest request, ClaimsPrincipal user, ISteamGameDataService steam,
        IDiscordSharing discord, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.ApiName) || request.ApiName.Length > 200)
            throw new ValidationException([new("apiName", "Selecione uma conquista Steam válida.")]);

        var ownerId = user.GetOwnerId();
        var game = await steam.GetAchievements(ownerId, appId, ct);
        var achievement = game.Achievements.FirstOrDefault(item => item.ApiName == request.ApiName);
        if (achievement is null)
            return TypedResults.Problem(statusCode: 404, title: "Conquista não encontrada.");
        if (!achievement.Achieved)
            return TypedResults.Problem(statusCode: 409, title: "Compartilhe apenas conquistas desbloqueadas.");

        return await Publish(discord, ownerId, new($"Conquista: {achievement.Name}", game.GameName, achievement.IconUrl), ct);
    }

    private static async Task<Results<NoContent, ProblemHttpResult>> Publish(
        IDiscordSharing discord, Guid ownerId, DiscordPost post, CancellationToken ct)
    {
        if (await discord.Send(ownerId, post with { Title = post.Title[..Math.Min(post.Title.Length, 256)] }, ct))
            return TypedResults.NoContent();

        return TypedResults.Problem(statusCode: 409, title: "Configure um canal do Discord no seu perfil.");
    }
}
