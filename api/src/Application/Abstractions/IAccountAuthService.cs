namespace GamesBacklog.Application;

public interface IAccountAuthService
{
    Task<AuthOperationResult> RegisterAsync(string email, string password);
    Task<AuthOperationResult> ConfirmEmailAsync(Guid userId, string code);
    Task ResendConfirmationAsync(string email);
    Task<AuthSignInResult> LoginAsync(string email, string password);
    Task<AuthSignInResult> RefreshAsync(string refreshToken);
    Task ForgotPasswordAsync(string email);
    Task<AuthOperationResult> ResetPasswordAsync(string email, string resetCode, string newPassword);
}
