using FluentValidation;
using GamesBacklog.Api.Contracts;

namespace GamesBacklog.Api.Validators;

internal sealed class CredentialsValidator : AbstractValidator<Credentials>
{
    public CredentialsValidator()
    {
        RuleFor(x => x.Email)
            .NotEmpty()
            .EmailAddress()
            .Matches(@"^[^\s<>\x00]+$")
            .MaximumLength(256)
            .OverridePropertyName("email");

        RuleFor(x => x.Password)
            .NotEmpty()
            .MaximumLength(128)
            .OverridePropertyName("password");
    }
}

internal sealed class EmailRequestValidator : AbstractValidator<EmailRequest>
{
    public EmailRequestValidator()
    {
        RuleFor(x => x.Email)
            .NotEmpty()
            .EmailAddress()
            .Matches(@"^[^\s<>\x00]+$")
            .MaximumLength(256)
            .OverridePropertyName("email");
    }
}

internal sealed class RefreshSessionValidator : AbstractValidator<RefreshSession>
{
    public RefreshSessionValidator()
    {
        RuleFor(x => x.RefreshToken)
            .NotEmpty()
            .MaximumLength(8192)
            .OverridePropertyName("refreshToken");
    }
}

internal sealed class ResetPasswordRequestValidator : AbstractValidator<ResetPasswordRequest>
{
    public ResetPasswordRequestValidator()
    {
        RuleFor(x => x.Email)
            .NotEmpty()
            .EmailAddress()
            .Matches(@"^[^\s<>\x00]+$")
            .MaximumLength(256)
            .OverridePropertyName("email");

        RuleFor(x => x.ResetCode)
            .NotEmpty()
            .MaximumLength(2048)
            .OverridePropertyName("resetCode");

        RuleFor(x => x.NewPassword)
            .NotEmpty()
            .MaximumLength(128)
            .OverridePropertyName("newPassword");
    }
}

internal sealed class StartSteamRequestValidator : AbstractValidator<StartSteamRequest>
{
    public StartSteamRequestValidator()
    {
        RuleFor(x => x.CodeChallenge)
            .NotEmpty()
            .Matches("^[A-Za-z0-9_-]{43}$")
            .OverridePropertyName("codeChallenge");
    }
}

internal sealed class RedeemSteamRequestValidator : AbstractValidator<RedeemSteamRequest>
{
    public RedeemSteamRequestValidator()
    {
        RuleFor(x => x.State)
            .NotEmpty()
            .Matches("^[A-Za-z0-9_-]{43}$")
            .OverridePropertyName("state");

        RuleFor(x => x.Code)
            .NotEmpty()
            .Matches("^[A-Za-z0-9_-]{43}$")
            .OverridePropertyName("code");

        RuleFor(x => x.CodeVerifier)
            .NotEmpty()
            .Matches("^[A-Za-z0-9._~-]{43,128}$")
            .OverridePropertyName("codeVerifier");
    }
}
