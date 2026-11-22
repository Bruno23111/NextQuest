using GamesBacklog.Api.Endpoints;

namespace GamesBacklog.Api;

public static class ApiHost
{
    public static WebApplication Build(WebApplicationOptions options, Action<WebApplicationBuilder>? configure = null)
    {
        var builder = WebApplication.CreateBuilder(options);
        builder.AddApiServices();
        configure?.Invoke(builder);

        var app = builder.Build();
        ConfigurePipeline(app);
        return app;
    }

    private static void ConfigurePipeline(WebApplication app)
    {
        app.UseForwardedHeaders();
        app.Use(async (context, next) =>
        {
            context.Response.Headers.CacheControl = "no-store";
            await next(context);
            var endpoint = context.GetEndpoint() as RouteEndpoint;
            app.Logger.LogInformation("{Method} {Route} {StatusCode} {TraceId}", context.Request.Method,
                endpoint?.RoutePattern.RawText ?? "(unmatched)", context.Response.StatusCode, context.TraceIdentifier);
        });
        app.UseExceptionHandler();
        app.UseStatusCodePages();
        var steamWebEnabled = !string.IsNullOrEmpty(app.Configuration["Steam:WebReturnUrl"]);
        if (steamWebEnabled) app.UseCors();
        app.UseAuthentication();
        app.UseAuthorization();
        app.UseRateLimiter();
        if (app.Environment.IsDevelopment()) app.MapOpenApi();
        app.MapGet("/health", () => TypedResults.NoContent()).ExcludeFromDescription();

        var api = app.MapGroup("/api/v1");
        if (steamWebEnabled) api.RequireCors("steam-web");
        api.MapAuth();
        api.MapBacklog();
        api.MapSteamGameData();
        api.MapUserProfile();
    }
}
