using System.Security.Claims;
using GamesBacklog.Api.Contracts;
using GamesBacklog.Application;
using Microsoft.AspNetCore.Http.Extensions;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.Options;

namespace GamesBacklog.Api.Endpoints;

internal sealed class SteamAuthEndpoints(ISteamAuthService steamAuth, IOptions<SteamSettings> settings)
{
    internal static void MapSteam(RouteGroupBuilder auth)
    {
        var group = auth.MapGroup("/steam").ProducesProblem(429);
        group.MapPost("/start", (StartSteamRequest request, SteamAuthEndpoints endpoints, CancellationToken ct) =>
            endpoints.Start(request, null, ct)).WithName("StartSteamLogin")
            .ProducesValidationProblem().ProducesProblem(503);
        group.MapPost("/link/start", (StartSteamRequest request, ClaimsPrincipal user, SteamAuthEndpoints endpoints,
            CancellationToken ct) => endpoints.Start(request, Owner(user), ct))
            .WithName("StartSteamLink").RequireAuthorization()
            .ProducesValidationProblem().ProducesProblem(401).ProducesProblem(503);
        group.MapGet("/callback", (string state, HttpContext context, SteamAuthEndpoints endpoints, CancellationToken ct) =>
            endpoints.Callback(state, context, ct)).WithName("SteamCallback").Produces(302)
            .ProducesProblem(400).ProducesProblem(503);
        group.MapPost("/token", (RedeemSteamRequest request, SteamAuthEndpoints endpoints, CancellationToken ct) =>
            endpoints.Login(request, ct)).WithName("RedeemSteamLogin").Produces<SessionResponse>()
            .ProducesValidationProblem().ProducesProblem(401).ProducesProblem(409).ProducesProblem(503);
        group.MapPost("/link", (RedeemSteamRequest request, ClaimsPrincipal user, SteamAuthEndpoints endpoints,
            CancellationToken ct) => endpoints.Link(request, Owner(user), ct))
            .WithName("LinkSteamAccount").RequireAuthorization()
            .ProducesValidationProblem().ProducesProblem(401).ProducesProblem(409).ProducesProblem(503);
    }

    private async Task<Ok<StartSteamResponse>> Start(StartSteamRequest request, Guid? ownerId, CancellationToken ct)
    {
        var result = await steamAuth.StartAsync(request.CodeChallenge, ownerId, ct);
        return TypedResults.Ok(new StartSteamResponse(result.State, result.AuthorizationUrl, result.ExpiresIn));
    }

    private async Task<Results<RedirectHttpResult, ProblemHttpResult>> Callback(string state, HttpContext context,
        CancellationToken ct)
    {
        context.Response.Headers["Referrer-Policy"] = "no-referrer";
        var request = context.Request;
        var absoluteUrl = UriHelper.BuildAbsolute(request.Scheme, request.Host, request.PathBase, request.Path);

        var fields = new Dictionary<string, string>(StringComparer.Ordinal);
        var hasInvalidField = false;
        foreach (var (key, values) in request.Query.Where(pair => pair.Key.StartsWith("openid.", StringComparison.Ordinal)))
        {
            if (values.Count != 1 || values[0] is not { } value)
            {
                hasInvalidField = true;
                break;
            }
            fields.Add(key, value);
        }

        var outcome = await steamAuth.HandleCallbackAsync(
            state,
            request.Query["state"].Count,
            absoluteUrl,
            fields,
            hasInvalidField,
            ct);

        if (outcome.IsInvalidRequest)
            return TypedResults.Problem(statusCode: 400, title: outcome.InvalidTitle);

        return RedirectToApp(state, outcome.RedirectParamName!, outcome.RedirectParamValue!);
    }

    private async Task<Results<SignInHttpResult, ProblemHttpResult>> Login(RedeemSteamRequest request, CancellationToken ct)
    {
        var result = await steamAuth.LoginAsync(request.State, request.Code, request.CodeVerifier, ct);
        return result.Succeeded
            ? TypedResults.SignIn(result.Principal!, authenticationScheme: IdentityConstants.BearerScheme)
            : TypedResults.Problem(statusCode: result.ErrorStatusCode, title: result.ErrorTitle);
    }

    private async Task<Results<NoContent, ProblemHttpResult>> Link(RedeemSteamRequest request, Guid ownerId, CancellationToken ct)
    {
        var result = await steamAuth.LinkAsync(ownerId, request.State, request.Code, request.CodeVerifier, ct);
        return result.Succeeded
            ? TypedResults.NoContent()
            : TypedResults.Problem(statusCode: result.ErrorStatusCode, title: result.ErrorTitle);
    }

    private RedirectHttpResult RedirectToApp(string state, string name, string value)
    {
        var returnUrl = settings.Value.WebReturnUrl!;
        var parameters = new Dictionary<string, string?> { ["state"] = state, [name] = value };
        if (returnUrl.Fragment.Length == 0)
            return TypedResults.Redirect(QueryHelpers.AddQueryString(returnUrl.AbsoluteUri, parameters));

        var uri = new UriBuilder(returnUrl)
        {
            Fragment = QueryHelpers.AddQueryString(returnUrl.Fragment[1..], parameters)
        };
        return TypedResults.Redirect(uri.Uri.AbsoluteUri);
    }

    private static Guid Owner(ClaimsPrincipal user) => Guid.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)!);
}
