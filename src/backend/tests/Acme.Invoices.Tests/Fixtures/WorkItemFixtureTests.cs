using System.Text.Json;
using Acme.Invoices.Domain;
using Acme.Invoices.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Acme.Invoices.Tests.Fixtures;

/// <summary>
/// The work item fixtures in data/ado describe this codebase. These tests keep them in step with the seed data.
/// </summary>
public class WorkItemFixtureTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private static CancellationToken Cancellation => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Bug4840_ReproStepsMatchSeedInvoice17()
    {
        _ = factory.CreateClient();
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<InvoicesDbContext>();
        var invoice = await db
            .Invoices.Include(i => i.Lines)
            .SingleAsync(i => i.Number == "INV-2026-0017", Cancellation);

        Assert.Equal(2, invoice.Lines.Count);
        Assert.All(
            invoice.Lines,
            line =>
            {
                Assert.Equal(3m, line.Quantity);
                Assert.Equal(0.335m, line.UnitPrice);
                Assert.Equal(1.01m, line.Total);
            }
        );

        // Computed from the lines, not from Invoice.Total, so this stays true after the bug is fixed.
        var reportedTotal = Money.Round(invoice.Lines.Sum(line => line.Quantity * line.UnitPrice));
        var expectedTotal = invoice.Lines.Sum(line => line.Total);
        Assert.Equal(2.01m, reportedTotal);
        Assert.Equal(2.02m, expectedTotal);

        var fields = LoadFields(4840);
        var description = fields.GetProperty("System.Description").GetString();
        Assert.NotNull(description);
        Assert.Contains("INV-2026-0017", description);
        Assert.Contains("3 &times; 0.335 = <b>1.01</b>", description);
        Assert.Contains("<b>Expected:</b> invoice total <b>2.02</b>", description);
        Assert.Contains("<b>Actual:</b> invoice total <b>2.01</b>", description);

        var criteria = fields.GetProperty("Microsoft.VSTS.Common.AcceptanceCriteria").GetString();
        Assert.NotNull(criteria);
        Assert.Contains("round each line first", criteria);
    }

    private static JsonElement LoadFields(int workItemId)
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (
            directory is not null
            && !Directory.Exists(Path.Combine(directory.FullName, "data", "ado"))
        )
        {
            directory = directory.Parent;
        }

        Assert.NotNull(directory);
        var path = Path.Combine(
            directory.FullName,
            "data",
            "ado",
            "workitems",
            $"{workItemId}.json"
        );
        using var document = JsonDocument.Parse(File.ReadAllText(path));
        return document.RootElement.GetProperty("fields").Clone();
    }
}
