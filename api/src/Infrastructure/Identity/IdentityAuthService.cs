using System.Text;
using GamesBacklog.Application;
using Microsoft.AspNetCore.Authentication.BearerToken;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.Options;

namespace GamesBacklog.Infrastructure.Identity;

public sealed class IdentityAuthService(
    UserManager<BacklogUser> users,
    SignInManager<BacklogUser> signIn,
    IEmailSender<BacklogUser> emailSender,
    IOptionsMonitor<BearerTokenOptions> bearerOptions,
    IOptions<AuthLinks> links,
    TimeProvider clock) : IAccountAuthService
{
    public async Task<AuthOperationResult> RegisterAsync(string email, string password)
    {
        var user = new BacklogUser { UserName = email, Email = email };
        var result = await users.CreateAsync(user, password);
        if (!result.Succeeded) return AuthOperationResult.ValidationFailure(ToErrors(result));

        await SendConfirmation(user);
        return AuthOperationResult.Success();
    }

    public async Task<AuthOperationResult> ConfirmEmailAsync(Guid userId, string code)
    {
        var user = await users.FindByIdAsync(userId.ToString());
        var token = Decode(code);
        if (user is null || token is null || !(await users.ConfirmEmailAsync(user, token)).Succeeded)
            return AuthOperationResult.Failure(400, "Link de confirmação inválido ou expirado.");

        return AuthOperationResult.Success();
    }

    public async Task ResendConfirmationAsync(string email)
    {
        var user = await users.FindByEmailAsync(email);
        if (user is { EmailConfirmed: false })
            await SendConfirmation(user);
    }

    public async Task<AuthSignInResult> LoginAsync(string email, string password)
    {
        var user = await users.FindByEmailAsync(email);
        if (user is null || !(await signIn.CheckPasswordSignInAsync(user, password, lockoutOnFailure: true)).Succeeded)
            return AuthSignInResult.Failure(401, "Credenciais inválidas ou conta indisponível.");

        return AuthSignInResult.Success(await signIn.CreateUserPrincipalAsync(user));
    }

    public async Task<AuthSignInResult> RefreshAsync(string refreshToken)
    {
        var protector = bearerOptions.Get(IdentityConstants.BearerScheme).RefreshTokenProtector;
        var ticket = protector.Unprotect(refreshToken);
        if (ticket?.Properties.ExpiresUtc is not { } expires || expires <= clock.GetUtcNow())
            return AuthSignInResult.Failure(401, "Sessão inválida ou expirada.");

        var user = await signIn.ValidateSecurityStampAsync(ticket.Principal);
        if (user is null || !await signIn.CanSignInAsync(user))
            return AuthSignInResult.Failure(401, "Sessão inválida ou expirada.");

        return AuthSignInResult.Success(await signIn.CreateUserPrincipalAsync(user));
    }

    public async Task ForgotPasswordAsync(string email)
    {
        if (await users.FindByEmailAsync(email) is { EmailConfirmed: true } user)
        {
            var token = Encode(await users.GeneratePasswordResetTokenAsync(user));
            await emailSender.SendPasswordResetCodeAsync(user, email, token);
        }
    }

    public async Task<AuthOperationResult> ResetPasswordAsync(string email, string resetCode, string newPassword)
    {
        var user = await users.FindByEmailAsync(email);
        var token = Decode(resetCode);
        if (user is not { EmailConfirmed: true } || token is null)
            return AuthOperationResult.ValidationFailure(new Dictionary<string, string[]> { ["resetCode"] = ["Código inválido ou expirado."] });

        var result = await users.ResetPasswordAsync(user, token, newPassword);
        if (!result.Succeeded) return AuthOperationResult.ValidationFailure(ToErrors(result));
        if (await users.IsLockedOutAsync(user))
            await users.SetLockoutEndDateAsync(user, null);

        return AuthOperationResult.Success();
    }

    private async Task SendConfirmation(BacklogUser user)
    {
        var token = Encode(await users.GenerateEmailConfirmationTokenAsync(user));
        var url = QueryHelpers.AddQueryString(
            new Uri(links.Value.PublicOrigin, "/api/v1/auth/confirmEmail").AbsoluteUri,
            new Dictionary<string, string?> { ["userId"] = user.Id.ToString(), ["code"] = token });
        await emailSender.SendConfirmationLinkAsync(user, user.Email!, url);
    }

    private static IDictionary<string, string[]> ToErrors(IdentityResult result) =>
        result.Errors.GroupBy(error => error.Code)
            .ToDictionary(group => group.Key, group => group.Select(error => error.Description).ToArray());

    private static string Encode(string value) => WebEncoders.Base64UrlEncode(Encoding.UTF8.GetBytes(value));

    private static string? Decode(string value)
    {
        if (value.Length > 2048) return null;
        try { return Encoding.UTF8.GetString(WebEncoders.Base64UrlDecode(value)); }
        catch (FormatException) { return null; }
    }
}
