namespace Acme.Invoices.Api.Notifications;

/// <summary>Writes emails to the log instead of sending them. No mail server is involved.</summary>
public sealed partial class LoggingEmailSender(ILogger<LoggingEmailSender> logger) : IEmailSender
{
    public Task SendAsync(EmailMessage message, CancellationToken cancellationToken)
    {
        LogEmail(logger, message.To, message.Subject);
        return Task.CompletedTask;
    }

    [LoggerMessage(Level = LogLevel.Information, Message = "Email to {To}: {Subject}")]
    private static partial void LogEmail(ILogger logger, string to, string subject);
}
