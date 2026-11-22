using System.Security.Claims;

namespace GamesBacklog.Application;

public sealed class AuthLinks
{
    public Uri PublicOrigin { get; set; } = new("http://localhost:5080");
}

public sealed class SteamSettings
{
    public Uri? WebReturnUrl { get; set; }

    public static bool IsValid(Uri? url, bool development) => url is null ||
        url is { IsAbsoluteUri: true, UserInfo.Length: 0, Query.Length: 0 } &&
        !url.Fragment.Contains('?') &&
        (url.Scheme == "https" || development && url.Scheme == "http" && url.IsLoopback);
}

public sealed record AuthOperationResult(
    bool Succeeded,
    int? ErrorStatusCode = null,
    string? ErrorTitle = null,
    IDictionary<string, string[]>? ValidationErrors = null)
{
    public static AuthOperationResult Success() => new(true);

    public static AuthOperationResult Failure(int statusCode, string title) =>
        new(false, ErrorStatusCode: statusCode, ErrorTitle: title);

    public static AuthOperationResult ValidationFailure(IDictionary<string, string[]> errors) =>
        new(false, ErrorStatusCode: 400, ValidationErrors: errors);
}

public sealed record AuthSignInResult(
    bool Succeeded,
    ClaimsPrincipal? Principal = null,
    int? ErrorStatusCode = null,
    string? ErrorTitle = null)
{
    public static AuthSignInResult Success(ClaimsPrincipal principal) => new(true, Principal: principal);

    public static AuthSignInResult Failure(int statusCode, string title) =>
        new(false, ErrorStatusCode: statusCode, ErrorTitle: title);
}

public sealed record SteamStartResult(string State, string AuthorizationUrl, int ExpiresIn);

public sealed record SteamCallbackResult(
    bool IsInvalidRequest,
    string? InvalidTitle = null,
    string? RedirectParamName = null,
    string? RedirectParamValue = null);
