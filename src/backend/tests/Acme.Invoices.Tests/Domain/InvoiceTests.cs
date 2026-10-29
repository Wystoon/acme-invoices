using Acme.Invoices.Domain;

namespace Acme.Invoices.Tests.Domain;

public class InvoiceTests
{
    private static readonly DateOnly Today = new(2026, 10, 15);

    [Fact]
    public void LineTotal_RoundsQuantityTimesUnitPrice()
    {
        var line = new InvoiceLine
        {
            Description = "SMS credits",
            Quantity = 3m,
            UnitPrice = 0.335m,
        };

        Assert.Equal(1.01m, line.Total);
    }

    [Fact]
    public void Total_SumsAllLines()
    {
        var invoice = CreateInvoice(InvoiceStatus.Sent, dueDate: Today);
        invoice.Lines.Add(
            new InvoiceLine
            {
                Description = "Consulting hours",
                Quantity = 2m,
                UnitPrice = 115.00m,
            }
        );
        invoice.Lines.Add(
            new InvoiceLine
            {
                Description = "Hosting, monthly",
                Quantity = 1m,
                UnitPrice = 49.90m,
            }
        );

        Assert.Equal(279.90m, invoice.Total);
    }

    [Fact]
    public void Total_IsZeroWithoutLines()
    {
        Assert.Equal(0m, CreateInvoice(InvoiceStatus.Draft, dueDate: Today).Total);
    }

    [Fact]
    public void SentInvoicePastItsDueDate_IsOverdueByWholeDays()
    {
        var invoice = CreateInvoice(InvoiceStatus.Sent, dueDate: Today.AddDays(-12));

        Assert.True(invoice.IsOverdue(Today));
        Assert.Equal(12, invoice.DaysOverdue(Today));
    }

    [Fact]
    public void SentInvoiceDueToday_IsNotOverdue()
    {
        var invoice = CreateInvoice(InvoiceStatus.Sent, dueDate: Today);

        Assert.False(invoice.IsOverdue(Today));
        Assert.Equal(0, invoice.DaysOverdue(Today));
    }

    [Theory]
    [InlineData(InvoiceStatus.Paid)]
    [InlineData(InvoiceStatus.Cancelled)]
    [InlineData(InvoiceStatus.Draft)]
    public void ClosedOrUnsentInvoice_IsNeverOverdue(InvoiceStatus status)
    {
        var invoice = CreateInvoice(status, dueDate: Today.AddDays(-40));

        Assert.False(invoice.IsOverdue(Today));
        Assert.False(invoice.CanSendReminder(Today));
    }

    private static Invoice CreateInvoice(InvoiceStatus status, DateOnly dueDate) =>
        new()
        {
            Number = "INV-TEST-0001",
            Currency = "EUR",
            Status = status,
            IssueDate = dueDate.AddDays(-30),
            DueDate = dueDate,
        };
}
