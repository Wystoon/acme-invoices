using Acme.Invoices.Api.Customers;
using Acme.Invoices.Domain;

namespace Acme.Invoices.Api.Invoices;

public sealed record InvoiceSummaryResponse(
    int Id,
    string Number,
    string CustomerName,
    DateOnly IssueDate,
    DateOnly DueDate,
    string Currency,
    decimal Total,
    string Status,
    int DaysOverdue
)
{
    public static InvoiceSummaryResponse From(Invoice invoice, DateOnly today) =>
        new(
            invoice.Id,
            invoice.Number,
            invoice.Customer?.Name ?? string.Empty,
            invoice.IssueDate,
            invoice.DueDate,
            invoice.Currency,
            invoice.Total,
            invoice.Status.ToString(),
            invoice.DaysOverdue(today)
        );
}

public sealed record InvoiceDetailResponse(
    int Id,
    string Number,
    CustomerResponse? Customer,
    DateOnly IssueDate,
    DateOnly DueDate,
    string Currency,
    decimal Total,
    string Status,
    int DaysOverdue,
    IReadOnlyList<InvoiceLineResponse> Lines
)
{
    public static InvoiceDetailResponse From(Invoice invoice, DateOnly today) =>
        new(
            invoice.Id,
            invoice.Number,
            invoice.Customer is { } customer ? CustomerResponse.From(customer) : null,
            invoice.IssueDate,
            invoice.DueDate,
            invoice.Currency,
            invoice.Total,
            invoice.Status.ToString(),
            invoice.DaysOverdue(today),
            [.. invoice.Lines.Select(InvoiceLineResponse.From)]
        );
}

public sealed record InvoiceLineResponse(
    string Description,
    decimal Quantity,
    decimal UnitPrice,
    decimal Total
)
{
    public static InvoiceLineResponse From(InvoiceLine line) =>
        new(line.Description, line.Quantity, line.UnitPrice, line.Total);
}
