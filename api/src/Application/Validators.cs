using FluentValidation;

namespace GamesBacklog.Application;

internal static class BacklogTextRules
{
    public static IRuleBuilderOptions<T, string?> WithoutNullCharacter<T>(this IRuleBuilder<T, string?> rule) =>
        rule.Must(text => text?.Contains('\0') != true).WithMessage("O texto contém um caractere inválido.");
}

public sealed class CreateGameValidator : AbstractValidator<CreateGame>
{
    public CreateGameValidator()
    {
        RuleFor(x => x.Title).NotEmpty().MaximumLength(250).WithoutNullCharacter().OverridePropertyName("title");
        RuleFor(x => x.Platform).NotEmpty().MaximumLength(100).WithoutNullCharacter().OverridePropertyName("platform");
    }
}

public sealed class UpdateGameValidator : AbstractValidator<UpdateGame>
{
    public UpdateGameValidator()
    {
        RuleFor(x => x.Title).NotEmpty().MaximumLength(250).WithoutNullCharacter().When(x => x.Title is not null).OverridePropertyName("title");
        RuleFor(x => x.Platform).NotEmpty().MaximumLength(100).WithoutNullCharacter().When(x => x.Platform is not null).OverridePropertyName("platform");
        RuleFor(x => x.Status).IsInEnum().OverridePropertyName("status");
        RuleFor(x => x).Must(x => x.Title is not null || x.Platform is not null || x.Status is not null)
            .WithMessage("Informe pelo menos um campo para atualizar.").OverridePropertyName("body");
    }
}

public sealed class ImportGameValidator : AbstractValidator<ImportGame>
{
    public ImportGameValidator()
    {
        RuleFor(x => x.RawgId).GreaterThan(0).OverridePropertyName("rawgId");
        RuleFor(x => x.PlatformId).GreaterThan(0).OverridePropertyName("platformId");
    }
}

public sealed class BacklogQueryValidator : AbstractValidator<BacklogQuery>
{
    public BacklogQueryValidator()
    {
        RuleFor(x => x.Q).MaximumLength(250).WithoutNullCharacter().OverridePropertyName("q");
        RuleFor(x => x.Status).IsInEnum().OverridePropertyName("status");
        RuleFor(x => x.Page).InclusiveBetween(1, 10_000).OverridePropertyName("page");
    }
}

public sealed class CatalogQueryValidator : AbstractValidator<CatalogQuery>
{
    public CatalogQueryValidator()
    {
        RuleFor(x => x.Q).Must(q => q is not null && q.Trim().Length >= 2)
            .WithMessage("Informe pelo menos dois caracteres.").MaximumLength(100).WithoutNullCharacter().OverridePropertyName("q");
        RuleFor(x => x.Page).InclusiveBetween(1, 10_000).OverridePropertyName("page");
    }
}
