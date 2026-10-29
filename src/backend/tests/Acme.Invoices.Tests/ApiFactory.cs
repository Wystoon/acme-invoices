using System.Collections.Concurrent;
using Acme.Invoices.Api.Notifications;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Data.Sqlite;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Time.Testing;

namespace Acme.Invoices.Tests;

/// <summary>
/// Runs the API against a private in-memory SQLite database, a fixed clock and a recording email sender.
/// </summary>
public sealed class ApiFactory : WebApplicationFactory<Program>
{
    public static readonly DateTimeOffset Now = new(2026, 10, 15, 9, 0, 0, TimeSpan.Zero);

    private readonly string _connectionString =
        $"Data Source=acme-tests-{Guid.NewGuid():N};Mode=Memory;Cache=Shared";

    // A shared in-memory database lives as long as one connection to it is open.
    private readonly SqliteConnection _keepAlive;

    public ApiFactory()
    {
        _keepAlive = new SqliteConnection(_connectionString);
        _keepAlive.Open();
    }

    public RecordingEmailSender Emails { get; } = new();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");
        builder.UseSetting("ConnectionStrings:Invoices", _connectionString);
        builder.ConfigureTestServices(services =>
        {
            services.AddSingleton<TimeProvider>(new FakeTimeProvider(Now));
            services.AddSingleton<IEmailSender>(Emails);
        });
    }

    public override async ValueTask DisposeAsync()
    {
        await base.DisposeAsync();
        await _keepAlive.DisposeAsync();
    }
}

public sealed class RecordingEmailSender : IEmailSender
{
    public ConcurrentQueue<EmailMessage> Sent { get; } = new();

    public Task SendAsync(EmailMessage message, CancellationToken cancellationToken)
    {
        Sent.Enqueue(message);
        return Task.CompletedTask;
    }
}
