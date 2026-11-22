using GamesBacklog.Application;
using GamesBacklog.Infrastructure.Catalog;
using GamesBacklog.Infrastructure.Identity;
using GamesBacklog.Infrastructure.Persistence;
using GamesBacklog.Infrastructure.Steam;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace GamesBacklog.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services,
        IConfiguration config)
    {
        services.AddDbContext<BacklogDbContext>(options => options.UseNpgsql(
            config.GetConnectionString("Backlog")
            ?? throw new InvalidOperationException("Configure ConnectionStrings:Backlog.")));

        services.AddScoped<IBacklogStore, BacklogStore>();
        services.AddScoped<IUserProfileStore, UserProfileStore>();

        services.AddOptions<RawgOptions>().BindConfiguration("Rawg");
        services.AddHttpClient<RawgCatalog>(client =>
        {
            client.BaseAddress = new Uri("https://api.rawg.io/api/");
            client.Timeout = TimeSpan.FromSeconds(8);
        }).ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler { AllowAutoRedirect = false }).RemoveAllLoggers();
        services.AddScoped<IGameCatalog>(provider => provider.GetRequiredService<RawgCatalog>());
        services.AddScoped<IPopularGameCatalog>(provider => provider.GetRequiredService<RawgCatalog>());

        services.AddOptions<SmtpOptions>().BindConfiguration("Smtp");
        services.AddTransient<IEmailSender<BacklogUser>, SmtpIdentityEmailSender>();

        services.AddScoped<SteamLoginStore>();
        services.AddHttpClient<SteamOpenId>(client =>
        {
            client.Timeout = TimeSpan.FromSeconds(8);
            client.MaxResponseContentBufferSize = 4096;
        }).ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler
        {
            AllowAutoRedirect = false,
            UseCookies = false
        }).RemoveAllLoggers();

        services.AddOptions<SteamApiOptions>().BindConfiguration("Steam");
        services.AddHttpClient<ISteamGameDataService, SteamGameDataService>(client =>
        {
            client.BaseAddress = new Uri("https://api.steampowered.com/");
            client.Timeout = TimeSpan.FromSeconds(20);
        }).ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler { AllowAutoRedirect = false }).RemoveAllLoggers();

        var protection = services.AddDataProtection().SetApplicationName("GamesBacklog");
        if (config["Auth:KeyDirectory"] is { Length: > 0 } keyDirectory)
            protection.PersistKeysToFileSystem(new DirectoryInfo(keyDirectory));

        services.AddIdentityCore<BacklogUser>(options =>
        {
            options.SignIn.RequireConfirmedAccount = true;
            options.User.AllowedUserNameCharacters = "";
            options.Password.RequiredLength = 8;
            options.Password.RequireNonAlphanumeric = false;
            options.Password.RequireDigit = false;
            options.Password.RequireUppercase = false;
            options.Password.RequireLowercase = false;
        }).AddUserStore<BacklogUserStore>().AddSignInManager().AddDefaultTokenProviders();

        services.AddScoped<IUserConfirmation<BacklogUser>, BacklogUserConfirmation>();

        services.AddAuthentication(IdentityConstants.BearerScheme).AddBearerToken(IdentityConstants.BearerScheme, options =>
        {
            options.BearerTokenExpiration = TimeSpan.FromMinutes(15);
            options.RefreshTokenExpiration = TimeSpan.FromDays(7);
        });

        services.AddScoped<IAccountAuthService, IdentityAuthService>();
        services.AddScoped<ISteamAuthService, SteamAuthService>();

        return services;
    }
}
