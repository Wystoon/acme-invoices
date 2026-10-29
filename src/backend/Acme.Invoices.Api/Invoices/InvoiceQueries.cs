using Acme.Invoices.Domain;

namespace Acme.Invoices.Api.Invoices;

public static class InvoiceQueries
{
    public static IQueryable<Invoice> WithFilter(
        this IQueryable<Invoice> invoices,
        InvoiceStatus? status,
        int? customerId
    )
    {
        if (status is { } wantedStatus)
        {
            invoices = invoices.Where(invoice => invoice.Status == wantedStatus);
        }

        if (customerId is { } wantedCustomer)
        {
            invoices = invoices.Where(invoice => invoice.CustomerId == wantedCustomer);
        }

        return invoices;
    }
}
