namespace GamesBacklog.Api.Contracts;

internal sealed record StartSteamRequest(string CodeChallenge) : IAuthRequest;

internal sealed record RedeemSteamRequest(
    string State,
    string Code,
    string CodeVerifier) : IAuthRequest;

internal sealed record StartSteamResponse(string State, string AuthorizationUrl, int ExpiresIn);
