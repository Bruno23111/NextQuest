using System.Text;
using FluentValidation;
using GamesBacklog.Api.Contracts;
using GamesBacklog.Application;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Identity;

namespace GamesBacklog.Api.Endpoints;

internal static class AuthEndpoints
{
    internal static void MapAuth(this RouteGroupBuilder api)
    {
        var auth = api.MapGroup("/auth").WithTags("Conta").RequireRateLimiting("auth")
            .AddEndpointFilter(ValidateRequest);
        SteamAuthEndpoints.MapSteam(auth);
        auth.MapPost("/register", Register).WithName("Register").ProducesValidationProblem()
            .ProducesProblem(503).ProducesProblem(429);
        auth.MapGet("/confirmEmail", Confirm).WithName("ConfirmEmail").Produces<string>(200, "text/plain")
            .ProducesProblem(400).ProducesProblem(429);
        auth.MapPost("/resendConfirmationEmail", ResendConfirmation).WithName("ResendConfirmationEmail")
            .ProducesValidationProblem().ProducesProblem(503).ProducesProblem(429);
        auth.MapPost("/login", Login).WithName("Login").Produces<SessionResponse>()
            .ProducesValidationProblem().ProducesProblem(401).ProducesProblem(429);
        auth.MapPost("/refresh", Refresh).WithName("RefreshSession").Produces<SessionResponse>()
            .ProducesValidationProblem().ProducesProblem(401).ProducesProblem(429);
        auth.MapPost("/forgotPassword", ForgotPassword).WithName("ForgotPassword")
            .ProducesValidationProblem().ProducesProblem(503).ProducesProblem(429);
        auth.MapPost("/resetPassword", ResetPassword).WithName("ResetPassword")
            .ProducesValidationProblem().ProducesProblem(429);
    }

    private static async ValueTask<object?> ValidateRequest(EndpointFilterInvocationContext context,
        EndpointFilterDelegate next)
    {
        if (context.Arguments.OfType<IAuthRequest>().SingleOrDefault() is { } request &&
            context.HttpContext.RequestServices.GetService(typeof(IValidator<>).MakeGenericType(request.GetType())) is IValidator validator)
        {
            var result = await validator.ValidateAsync(new ValidationContext<object>(request), context.HttpContext.RequestAborted);
            if (!result.IsValid)
                throw new ValidationException(result.Errors);
        }
        return await next(context);
    }

    private static async Task<Results<NoContent, ValidationProblem>> Register(Credentials request, IAccountAuthService auth)
    {
        var result = await auth.RegisterAsync(request.Email, request.Password);
        return result.Succeeded ? TypedResults.NoContent() : TypedResults.ValidationProblem(result.ValidationErrors!);
    }

    private static async Task<Results<ContentHttpResult, ProblemHttpResult>> Confirm(Guid userId, string code,
        IAccountAuthService auth)
    {
        var result = await auth.ConfirmEmailAsync(userId, code);
        if (!result.Succeeded)
            return TypedResults.Problem(statusCode: result.ErrorStatusCode, title: result.ErrorTitle);

        return TypedResults.Text("E-mail confirmado. Você já pode entrar no GamesBacklog.", "text/plain", Encoding.UTF8);
    }

    private static async Task<NoContent> ResendConfirmation(EmailRequest request, IAccountAuthService auth)
    {
        await auth.ResendConfirmationAsync(request.Email);
        return TypedResults.NoContent();
    }

    private static async Task<Results<SignInHttpResult, ProblemHttpResult>> Login(Credentials request,
        IAccountAuthService auth)
    {
        var result = await auth.LoginAsync(request.Email, request.Password);
        return result.Succeeded
            ? TypedResults.SignIn(result.Principal!, authenticationScheme: IdentityConstants.BearerScheme)
            : TypedResults.Problem(statusCode: result.ErrorStatusCode, title: result.ErrorTitle);
    }

    private static async Task<Results<SignInHttpResult, ProblemHttpResult>> Refresh(RefreshSession request,
        IAccountAuthService auth)
    {
        var result = await auth.RefreshAsync(request.RefreshToken);
        return result.Succeeded
            ? TypedResults.SignIn(result.Principal!, authenticationScheme: IdentityConstants.BearerScheme)
            : TypedResults.Problem(statusCode: result.ErrorStatusCode, title: result.ErrorTitle);
    }

    private static async Task<NoContent> ForgotPassword(EmailRequest request, IAccountAuthService auth)
    {
        await auth.ForgotPasswordAsync(request.Email);
        return TypedResults.NoContent();
    }

    private static async Task<Results<NoContent, ValidationProblem>> ResetPassword(ResetPasswordRequest request,
        IAccountAuthService auth)
    {
        var result = await auth.ResetPasswordAsync(request.Email, request.ResetCode, request.NewPassword);
        return result.Succeeded ? TypedResults.NoContent() : TypedResults.ValidationProblem(result.ValidationErrors!);
    }
}
