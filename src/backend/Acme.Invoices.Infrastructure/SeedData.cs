using Acme.Invoices.Domain;

namespace Acme.Invoices.Infrastructure;

/// <summary>
/// Fixed demo data: 8 customers and 40 invoices issued weekly from 5 January 2026.
/// Everything is derived from the invoice index, so every database starts identical.
/// </summary>
public static class SeedData
{
    public const int CustomerCount = 8;
    public const int InvoiceCount = 40;

    private static readonly DateOnly FirstIssueDate = new(2026, 1, 5);

    private static readonly (string Name, string Email)[] CustomerRows =
    [
        ("Bluefen Bakery", "accounts@bluefen.example"),
        ("Corvalt Logistics", "billing@corvalt.example"),
        ("Dunmere Dental", "office@dunmere.example"),
        ("Eskholt Interiors, Ltd.", "finance@eskholt.example"),
        ("Fallowmere Builders", "ap@fallowmere.example"),
        ("Grisdale \"Old Mill\" Brewing", "books@grisdale.example"),
        ("Hollowmarsh Marine", "payables@hollowmarsh.example"),
        ("Ivelby Gardens", "hello@ivelby.example"),
    ];

    private static readonly (string Description, decimal Quantity, decimal UnitPrice)[] Catalog =
    [
        ("Consulting hours", 6m, 115.00m),
        ("Hosting, monthly", 1m, 49.90m),
        ("Support plan", 1m, 120.00m),
        ("Workshop day", 1m, 950.00m),
        ("Travel expenses", 1m, 86.35m),
        ("License seats", 5m, 12.40m),
        ("Design review", 3m, 72.50m),
    ];

    /// <summary>Adds the demo data unless the database already has customers. The caller saves.</summary>
    public static bool AddTo(InvoicesDbContext db)
    {
        if (db.Customers.Any())
        {
            return false;
        }

        var customers = CustomerRows
            .Select(
                (row, index) =>
                    new Customer
                    {
                        Id = index + 1,
                        Name = row.Name,
                        Email = row.Email,
                    }
            )
            .ToList();
        db.Customers.AddRange(customers);
        db.Invoices.AddRange(Enumerable.Range(0, InvoiceCount).Select(CreateInvoice));
        return true;
    }

    private static Invoice CreateInvoice(int index)
    {
        var issueDate = FirstIssueDate.AddDays(index * 7);
        var invoice = new Invoice
        {
            Id = index + 1,
            Number = $"INV-2026-{index + 1:0000}",
            CustomerId = index % CustomerCount + 1,
            IssueDate = issueDate,
            DueDate = issueDate.AddDays(30),
            Currency = index % 5 == 4 ? "USD" : "EUR",
            Status = StatusFor(index),
        };
        invoice.Lines.AddRange(LinesFor(index));
        return invoice;
    }

    private static InvoiceStatus StatusFor(int index) =>
        index switch
        {
            >= 37 => InvoiceStatus.Draft,
            _ when index % 13 == 6 => InvoiceStatus.Cancelled,
            >= 32 => InvoiceStatus.Sent,
            _ when index % 9 == 4 => InvoiceStatus.Overdue,
            _ => InvoiceStatus.Paid,
        };

    private static IEnumerable<InvoiceLine> LinesFor(int index)
    {
        // INV-2026-0017 bills SMS credits at a fraction of a cent.
        if (index == 16)
        {
            return
            [
                new InvoiceLine
                {
                    Description = "SMS credits, EU",
                    Quantity = 3m,
                    UnitPrice = 0.335m,
                },
                new InvoiceLine
                {
                    Description = "SMS credits, UK",
                    Quantity = 3m,
                    UnitPrice = 0.335m,
                },
            ];
        }

        return Enumerable
            .Range(0, index % 3 + 1)
            .Select(line => Catalog[(index * 3 + line) % Catalog.Length])
            .Select(item => new InvoiceLine
            {
                Description = item.Description,
                Quantity = item.Quantity + index % 4,
                UnitPrice = item.UnitPrice,
            });
    }
}
