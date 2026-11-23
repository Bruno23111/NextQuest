using FluentValidation;
using GamesBacklog.Application;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace GamesBacklog.Api;

internal sealed class ApiErrors : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext context, Exception exception, CancellationToken ct)
    {
        IResult? result = exception switch
        {
            ValidationException error => Results.ValidationProblem(error.Errors.GroupBy(x => x.PropertyName)
                .ToDictionary(group => group.Key, group => group.Select(x => x.ErrorMessage).ToArray())),
            GameNotFoundException => Results.Problem(statusCode: 404, title: "Jogo não encontrado."),
            ProfileNotFoundException => Results.Problem(statusCode: 404, title: "Perfil não encontrado."),
            DiscordUnavailableException => Results.Problem(statusCode: 503, title: "Não foi possível publicar no Discord. Confira o webhook e tente novamente."),
            DiscordLinkConflictException => Results.Problem(statusCode: 409, title: "Este Discord já está vinculado ou não corresponde à conta conectada."),
            DiscordOAuthNotConfiguredException => Results.Problem(statusCode: 503, title: "O vínculo com Discord ainda não está configurado no servidor."),
            DuplicateImportException => Results.Problem(statusCode: 409, title: "Jogo já importado para esta plataforma."),
            CatalogUnavailableException => Results.Problem(statusCode: 503, title: "Catálogo indisponível. Tente novamente."),
            DealsNotConfiguredException => Results.Problem(statusCode: 503, title: "A integração de promoções ainda aguarda configuração no servidor."),
            DealsUnavailableException => Results.Problem(statusCode: 503, title: "Promoções indisponíveis no momento. Tente novamente."),
            EmailUnavailableException => Results.Problem(statusCode: 503,
                title: "Envio de e-mail indisponível. Tente reenviar a mensagem."),
            SteamUnavailableException => Results.Problem(statusCode: 503, title: "Login Steam indisponível. Tente novamente."),
            SteamAccountNotLinkedException => Results.Problem(statusCode: 409,
                title: "Vincule uma conta Steam antes de consultar sua biblioteca."),
            SteamGameDataPrivateException => Results.Problem(statusCode: 403,
                title: "A Steam não disponibilizou estes dados. Verifique a privacidade do perfil e do jogo."),
            SteamGameDataUnavailableException => Results.Problem(statusCode: 503,
                title: "Dados da Steam indisponíveis. Tente novamente."),
            BadHttpRequestException error => Results.Problem(statusCode: error.StatusCode, title: "Requisição inválida."),
            _ => null
        };

        if (result is null) return false;
        await result.ExecuteAsync(context);
        return true;
    }
}

internal static class ApiProblems
{
    internal static void AddTraceId(ProblemDetailsContext context) =>
        context.ProblemDetails.Extensions["traceId"] = context.HttpContext.TraceIdentifier;
}
