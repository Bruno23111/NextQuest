using FluentValidation;
using GamesBacklog.Application;
using GamesBacklog.Infrastructure.Identity;
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
            DuplicateImportException => Results.Problem(statusCode: 409, title: "Jogo já importado para esta plataforma."),
            CatalogUnavailableException => Results.Problem(statusCode: 503, title: "Catálogo indisponível. Tente novamente."),
            EmailUnavailableException => Results.Problem(statusCode: 503,
                title: "Envio de e-mail indisponível. Tente reenviar a mensagem."),
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
