using System.Net;
using System.Security.Claims;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using FluentValidation;
using GamesBacklog.Api.Contracts;
using GamesBacklog.Api.Endpoints;
using GamesBacklog.Api.Validators;
using GamesBacklog.Application;
using GamesBacklog.Domain;
using GamesBacklog.Infrastructure;
using Mapster;
using Microsoft.AspNetCore.HttpOverrides;

namespace GamesBacklog.Api;

public static class ApiHost
{
    public static WebApplication Build(WebApplicationOptions options, Action<WebApplicationBuilder>? configure = null)
    {
        var builder = WebApplication.CreateBuilder(options);
        var services = builder.Services;
        var config = builder.Configuration;

        services.AddSingleton(TimeProvider.System);
        services.AddScoped<BacklogService>();
        services.AddScoped<UserProfileService>();
        services.AddSingleton<IValidator<CreateGame>, CreateGameValidator>();
        services.AddSingleton<IValidator<UpdateGame>, UpdateGameValidator>();
        services.AddSingleton<IValidator<ImportGame>, ImportGameValidator>();
        services.AddSingleton<IValidator<BacklogQuery>, BacklogQueryValidator>();
        services.AddSingleton<IValidator<CatalogQuery>, CatalogQueryValidator>();
        services.AddSingleton<IValidator<Credentials>, CredentialsValidator>();
        services.AddSingleton<IValidator<EmailRequest>, EmailRequestValidator>();
        services.AddSingleton<IValidator<RefreshSession>, RefreshSessionValidator>();
        services.AddSingleton<IValidator<ResetPasswordRequest>, ResetPasswordRequestValidator>();
        services.AddSingleton<IValidator<StartSteamRequest>, StartSteamRequestValidator>();
        services.AddSingleton<IValidator<RedeemSteamRequest>, RedeemSteamRequestValidator>();
        services.AddSingleton<IValidator<UpdateUserProfile>, UserProfileValidator>();

        var mapping = new TypeAdapterConfig();
        mapping.NewConfig<BacklogEntry, BacklogGame>().MapToConstructor(true);
        mapping.Compile();
        services.AddSingleton(mapping);

        services.AddOptions<AuthLinks>().BindConfiguration("Auth")
            .Validate(x => x.PublicOrigin is { IsAbsoluteUri: true, UserInfo.Length: 0, PathAndQuery: "/", Fragment.Length: 0 } &&
                (x.PublicOrigin.Scheme == "https" || builder.Environment.IsDevelopment() && x.PublicOrigin.Scheme == "http"),
                "Auth:PublicOrigin deve ser a origem HTTPS acessível ao usuário.").ValidateOnStart();

        services.AddOptions<SteamSettings>().BindConfiguration("Steam")
            .Validate(x => SteamSettings.IsValid(x.WebReturnUrl, builder.Environment.IsDevelopment()),
                "Steam:WebReturnUrl deve ser a URL HTTPS de retorno do app.").ValidateOnStart();

        services.AddInfrastructure(config);
        services.AddScoped<SteamAuthEndpoints>();

        services.AddCors(options => options.AddPolicy("steam-web", policy =>
        {
            var url = config.GetValue<Uri>("Steam:WebReturnUrl");
            if (url is not null)
                policy.WithOrigins(url.GetLeftPart(UriPartial.Authority)).AllowAnyHeader().AllowAnyMethod();
        }));

        services.AddAuthorization();

        services.ConfigureHttpJsonOptions(options =>
        {
            options.SerializerOptions.NumberHandling = JsonNumberHandling.Strict;
            options.SerializerOptions.Converters.Add(
                new JsonStringEnumConverter<GameStatus>(JsonNamingPolicy.CamelCase, allowIntegerValues: false));
        });
        services.Configure<RouteHandlerOptions>(options => options.ThrowOnBadRequest = true);
        services.AddProblemDetails(options => options.CustomizeProblemDetails = ApiProblems.AddTraceId);
        services.AddExceptionHandler<ApiErrors>();
        services.AddOpenApi(options => options.AddDocumentTransformer(BearerOpenApi.DescribeDocument)
            .AddOperationTransformer(BearerOpenApi.DescribeOperation));
        services.Configure<ForwardedHeadersOptions>(options =>
        {
            options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
            if (config["Proxy:KnownAddress"] is { Length: > 0 } proxy)
                options.KnownProxies.Add(IPAddress.Parse(proxy));
        });
        services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            options.AddPolicy("auth", context => Limit(context.Connection.RemoteIpAddress?.ToString() ?? "unknown", 30));
            options.AddPolicy("catalog", context => Limit(context.User.FindFirstValue(ClaimTypes.NameIdentifier)
                ?? context.Connection.RemoteIpAddress?.ToString() ?? "unknown", 45));
        });

        configure?.Invoke(builder);
        var app = builder.Build();
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
        var steamWebEnabled = !string.IsNullOrEmpty(config["Steam:WebReturnUrl"]);
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
        return app;
    }

    private static RateLimitPartition<string> Limit(string key, int count) =>
        RateLimitPartition.GetFixedWindowLimiter(key, _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = count,
            Window = TimeSpan.FromMinutes(1)
        });
}
