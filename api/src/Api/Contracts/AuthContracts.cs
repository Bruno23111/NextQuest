namespace GamesBacklog.Api.Contracts;

internal interface IAuthRequest { }

internal sealed record Credentials(string Email, string Password) : IAuthRequest;

internal sealed record EmailRequest(string Email) : IAuthRequest;

internal sealed record SessionResponse(
    string TokenType,
    string AccessToken,
    long ExpiresIn,
    string RefreshToken);

internal sealed record RefreshSession(string RefreshToken) : IAuthRequest;

internal sealed record ResetPasswordRequest(
    string Email,
    string ResetCode,
    string NewPassword) : IAuthRequest;
