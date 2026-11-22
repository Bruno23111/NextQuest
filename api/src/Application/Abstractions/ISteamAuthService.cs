namespace GamesBacklog.Application;

public interface ISteamAuthService
{
    Task<SteamStartResult> StartAsync(string codeChallenge, Guid? ownerId, CancellationToken ct);
    Task<SteamCallbackResult> HandleCallbackAsync(
        string state,
        int stateQueryCount,
        string absoluteRequestUrl,
        IReadOnlyDictionary<string, string> openIdFields,
        bool hasInvalidOpenIdField,
        CancellationToken ct);
    Task<AuthSignInResult> LoginAsync(string state, string code, string codeVerifier, CancellationToken ct);
    Task<AuthOperationResult> LinkAsync(Guid ownerId, string state, string code, string codeVerifier, CancellationToken ct);
}
