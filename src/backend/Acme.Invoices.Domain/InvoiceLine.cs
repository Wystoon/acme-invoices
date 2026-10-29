namespace Acme.Invoices.Domain;

public class InvoiceLine
{
    public int Id { get; set; }

    public int InvoiceId { get; set; }

    public required string Description { get; set; }

    public decimal Quantity { get; set; }

    public decimal UnitPrice { get; set; }

    public decimal Total => Money.Round(Quantity * UnitPrice);
}
