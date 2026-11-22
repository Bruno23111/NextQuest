using System.ComponentModel.DataAnnotations;
using System.Text;
using System.Text.Json;
using GamesBacklog.Infrastructure.Identity;
using Microsoft.AspNetCore.Authentication.BearerToken;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.Options;

namespace GamesBacklog.Api.Endpoints;

internal interface IAuthRequest { }

internal sealed record Credentials([property: Required, EmailAddress, RegularExpression(@"[^\s<>\x00]+"), StringLength(256)] string Email,
    [property: Required, StringLength(128)] string Password) : IAuthRequest;
internal sealed record EmailRequest([property: Required, EmailAddress, RegularExpression(@"[^\s<>\x00]+"), StringLength(256)] string Email) : IAuthRequest;
internal sealed record SessionResponse(string TokenType, string AccessToken, long ExpiresIn, string RefreshToken);
internal sealed record RefreshSession([property: Required, StringLength(8192)] string RefreshToken) : IAuthRequest;
internal sealed record ResetPasswordRequest(
    [property: Required, EmailAddress, RegularExpression(@"[^\s<>\x00]+"), StringLength(256)] string Email,
    [property: Required, StringLength(2048)] string ResetCode,
    [property: Required, StringLength(128)] string NewPassword) : IAuthRequest;

internal sealed class AuthLinks
{
    public Uri PublicOrigin { get; set; } = new("http://localhost:5080");
}

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
        if (context.Arguments.OfType<IAuthRequest>().SingleOrDefault() is { } request)
        {
            var errors = new List<ValidationResult>();
            if (!Validator.TryValidateObject(request, new ValidationContext(request), errors, validateAllProperties: true))
                return TypedResults.ValidationProblem(errors
                    .SelectMany(error => error.MemberNames.DefaultIfEmpty("body"),
                        (error, member) => new { Field = JsonNamingPolicy.CamelCase.ConvertName(member), error.ErrorMessage })
                    .GroupBy(error => error.Field)
                    .ToDictionary(group => group.Key, group => group.Select(error => error.ErrorMessage!).ToArray()));
        }
        return await next(context);
    }

    private static async Task<Results<NoContent, ValidationProblem>> Register(Credentials request,
        UserManager<BacklogUser> users, IEmailSender<BacklogUser> email, IOptions<AuthLinks> links)
    {
        var user = new BacklogUser { UserName = request.Email, Email = request.Email };
        var result = await users.CreateAsync(user, request.Password);
        if (!result.Succeeded) return Errors(result);
        await SendConfirmation(user, users, email, links.Value);
        return TypedResults.NoContent();
    }

    private static async Task<Results<ContentHttpResult, ProblemHttpResult>> Confirm(Guid userId, string code,
        UserManager<BacklogUser> users)
    {
        var user = await users.FindByIdAsync(userId.ToString());
        var token = Decode(code);
        if (user is null || token is null || !(await users.ConfirmEmailAsync(user, token)).Succeeded)
            return TypedResults.Problem(statusCode: 400, title: "Link de confirmação inválido ou expirado.");

        return TypedResults.Text("E-mail confirmado. Você já pode entrar no GamesBacklog.", "text/plain", Encoding.UTF8);
    }

    private static async Task<NoContent> ResendConfirmation(EmailRequest request, UserManager<BacklogUser> users,
        IEmailSender<BacklogUser> email, IOptions<AuthLinks> links)
    {
        var user = await users.FindByEmailAsync(request.Email);
        if (user is { EmailConfirmed: false }) await SendConfirmation(user, users, email, links.Value);
        return TypedResults.NoContent();
    }

    private static async Task<Results<SignInHttpResult, ProblemHttpResult>> Login(Credentials request,
        UserManager<BacklogUser> users, SignInManager<BacklogUser> signIn)
    {
        var user = await users.FindByEmailAsync(request.Email);
        if (user is null || !(await signIn.CheckPasswordSignInAsync(user, request.Password, lockoutOnFailure: true)).Succeeded)
            return TypedResults.Problem(statusCode: 401, title: "Credenciais inválidas ou conta indisponível.");

        return TypedResults.SignIn(await signIn.CreateUserPrincipalAsync(user), authenticationScheme: IdentityConstants.BearerScheme);
    }

    private static async Task<Results<SignInHttpResult, ProblemHttpResult>> Refresh(RefreshSession request,
        SignInManager<BacklogUser> signIn, IOptionsMonitor<BearerTokenOptions> options, TimeProvider clock)
    {
        var protector = options.Get(IdentityConstants.BearerScheme).RefreshTokenProtector;
        var ticket = protector.Unprotect(request.RefreshToken);
        if (ticket?.Properties.ExpiresUtc is not { } expires || expires <= clock.GetUtcNow())
            return TypedResults.Problem(statusCode: 401, title: "Sessão inválida ou expirada.");

        var user = await signIn.ValidateSecurityStampAsync(ticket.Principal);
        if (user is null || !await signIn.CanSignInAsync(user))
            return TypedResults.Problem(statusCode: 401, title: "Sessão inválida ou expirada.");

        return TypedResults.SignIn(await signIn.CreateUserPrincipalAsync(user), authenticationScheme: IdentityConstants.BearerScheme);
    }

    private static async Task<NoContent> ForgotPassword(EmailRequest request, UserManager<BacklogUser> users,
        IEmailSender<BacklogUser> email)
    {
        if (await users.FindByEmailAsync(request.Email) is { EmailConfirmed: true } user)
            await email.SendPasswordResetCodeAsync(user, request.Email, Encode(await users.GeneratePasswordResetTokenAsync(user)));
        return TypedResults.NoContent();
    }

    private static async Task<Results<NoContent, ValidationProblem>> ResetPassword(ResetPasswordRequest request,
        UserManager<BacklogUser> users)
    {
        var user = await users.FindByEmailAsync(request.Email);
        var token = Decode(request.ResetCode);
        if (user is not { EmailConfirmed: true } || token is null)
            return TypedResults.ValidationProblem(new Dictionary<string, string[]> { ["resetCode"] = ["Código inválido ou expirado."] });

        var result = await users.ResetPasswordAsync(user, token, request.NewPassword);
        if (!result.Succeeded) return Errors(result);
        if (await users.IsLockedOutAsync(user))
            await users.SetLockoutEndDateAsync(user, null);
        return TypedResults.NoContent();
    }

    private static async Task SendConfirmation(BacklogUser user, UserManager<BacklogUser> users,
        IEmailSender<BacklogUser> email, AuthLinks links)
    {
        var token = Encode(await users.GenerateEmailConfirmationTokenAsync(user));
        var url = QueryHelpers.AddQueryString(new Uri(links.PublicOrigin, "/api/v1/auth/confirmEmail").AbsoluteUri,
            new Dictionary<string, string?> { ["userId"] = user.Id.ToString(), ["code"] = token });
        await email.SendConfirmationLinkAsync(user, user.Email!, url);
    }

    private static ValidationProblem Errors(IdentityResult result) =>
        TypedResults.ValidationProblem(result.Errors.GroupBy(error => error.Code)
            .ToDictionary(group => group.Key, group => group.Select(error => error.Description).ToArray()));

    private static string Encode(string value) => WebEncoders.Base64UrlEncode(Encoding.UTF8.GetBytes(value));

    private static string? Decode(string value)
    {
        if (value.Length > 2048) return null;
        try { return Encoding.UTF8.GetString(WebEncoders.Base64UrlDecode(value)); }
        catch (FormatException) { return null; }
    }
}
