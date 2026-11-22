using System.Net;
using System.Net.Mail;
using GamesBacklog.Application;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;

namespace GamesBacklog.Infrastructure.Identity;

public sealed class SmtpOptions
{
    public string Host { get; set; } = "";
    public int Port { get; set; } = 587;
    public string From { get; set; } = "";
    public string? Username { get; set; }
    public string? Password { get; set; }
    public bool EnableSsl { get; set; } = true;
}

public sealed class SmtpIdentityEmailSender(IOptions<SmtpOptions> options) : IEmailSender<BacklogUser>
{
    public Task SendConfirmationLinkAsync(BacklogUser user, string email, string confirmationLink) =>
        Send(email, "Confirme seu e-mail no GamesBacklog",
            $"Abra este link para confirmar sua conta:\n{confirmationLink}");

    public Task SendPasswordResetCodeAsync(BacklogUser user, string email, string resetCode) =>
        Send(email, "Redefina sua senha do GamesBacklog", $"Copie o código no aplicativo:\n{resetCode}");

    public Task SendPasswordResetLinkAsync(BacklogUser user, string email, string resetLink) =>
        Send(email, "Redefina sua senha do GamesBacklog", $"Abra este link:\n{resetLink}");

    private async Task Send(string address, string subject, string body)
    {
        var settings = options.Value;
        if (string.IsNullOrWhiteSpace(settings.Host) || string.IsNullOrWhiteSpace(settings.From))
            throw new EmailUnavailableException();

        using var message = new MailMessage(settings.From, address, subject, body);
        using var smtp = new SmtpClient(settings.Host, settings.Port) { EnableSsl = settings.EnableSsl };
        if (!string.IsNullOrWhiteSpace(settings.Username))
            smtp.Credentials = new NetworkCredential(settings.Username, settings.Password);

        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(15));
        try
        {
            await smtp.SendMailAsync(message, timeout.Token);
        }
        catch (Exception ex) when (ex is SmtpException or OperationCanceledException)
        {
            throw new EmailUnavailableException();
        }
    }
}
