using FluentValidation;
using GamesBacklog.Application;

namespace GamesBacklog.Api.Validators;

internal sealed class UserProfileValidator : AbstractValidator<UpdateUserProfile>
{
    public UserProfileValidator()
    {
        RuleFor(x => x.DisplayName)
            .NotEmpty().WithMessage("Informe um nome para exibição.")
            .MaximumLength(60)
            .Must(value => value is not null && !value.Any(char.IsControl))
            .OverridePropertyName("displayName");

        RuleFor(x => x.Bio)
            .MaximumLength(300)
            .Must(value => value is null || value.All(character => !char.IsControl(character) || character is '\n' or '\r'))
            .WithMessage("A descrição contém caracteres não permitidos.")
            .OverridePropertyName("bio");

        RuleFor(x => x.AvatarUrl).MaximumLength(2048).Must(BeHttpsOrEmpty)
            .WithMessage("Use uma URL HTTPS válida para a imagem de perfil.")
            .OverridePropertyName("avatarUrl");
        RuleFor(x => x.HeaderUrl).MaximumLength(2048).Must(BeHttpsOrEmpty)
            .WithMessage("Use uma URL HTTPS válida para a imagem de capa.")
            .OverridePropertyName("headerUrl");
    }

    private static bool BeHttpsOrEmpty(string? value) => string.IsNullOrWhiteSpace(value) ||
        Uri.TryCreate(value, UriKind.Absolute, out var uri) && uri.Scheme == Uri.UriSchemeHttps &&
        string.IsNullOrEmpty(uri.UserInfo);
}
