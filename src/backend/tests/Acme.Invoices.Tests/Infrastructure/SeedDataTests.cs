using Acme.Invoices.Domain;
using Acme.Invoices.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Acme.Invoices.Tests.Infrastructure;

public class SeedDataTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private static CancellationToken Cancellation => TestContext.Current.CancellationToken;

    [Fact]
    public async Task StartingTheAppTwice_DoesNotDuplicateSeedData()
    {
        _ = factory.CreateClient();
        var afterFirstStart = await CountRowsAsync(factory.Services);

        // A second host with the same configuration: same database, migrations and seeding run again.
        await using var secondStart = factory.WithWebHostBuilder(_ => { });
        _ = secondStart.CreateClient();
        var afterSecondStart = await CountRowsAsync(secondStart.Services);

        Assert.Equal(SeedData.CustomerCount, afterFirstStart[0]);
        Assert.Equal(SeedData.InvoiceCount, afterFirstStart[1]);
        Assert.Equal(afterFirstStart, afterSecondStart);
    }

    private static async Task<int[]> CountRowsAsync(IServiceProvider services)
    {
        await using var scope = services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<InvoicesDbContext>();
        return
        [
            await db.Customers.CountAsync(Cancellation),
            await db.Invoices.CountAsync(Cancellation),
            await db.Set<InvoiceLine>().CountAsync(Cancellation),
        ];
    }
}
