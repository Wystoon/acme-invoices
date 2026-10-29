namespace Acme.Invoices.Domain;

public enum InvoiceStatus
{
    Draft,
    Sent,
    Paid,
    Overdue,
    Cancelled,
}
