using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.OpenApi;
using Microsoft.OpenApi;

namespace GamesBacklog.Api;

internal static class BearerOpenApi
{
    private const string SchemeName = "bearer";

    public static Task DescribeDocument(OpenApiDocument document, OpenApiDocumentTransformerContext context,
        CancellationToken cancellationToken)
    {
        document.Info.Title = "GamesBacklog API";
        document.Servers = [new OpenApiServer { Url = "/" }];
        document.Components ??= new OpenApiComponents();
        document.Components.SecuritySchemes ??= new Dictionary<string, IOpenApiSecurityScheme>();
        document.Components.SecuritySchemes[SchemeName] = new OpenApiSecurityScheme
        {
            Type = SecuritySchemeType.Http,
            Scheme = SchemeName,
            Description = "Token opaco fornecido pelo endpoint de login."
        };

        return Task.CompletedTask;
    }

    public static Task DescribeOperation(OpenApiOperation operation, OpenApiOperationTransformerContext context,
        CancellationToken cancellationToken)
    {
        if (context.Description.ActionDescriptor.EndpointMetadata.OfType<IAuthorizeData>().Any())
            operation.Security = [new OpenApiSecurityRequirement { [new(SchemeName, context.Document)] = [] }];

        return Task.CompletedTask;
    }
}
