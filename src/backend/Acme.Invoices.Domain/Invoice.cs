namespace Acme.Invoices.Domain;

public class Invoice
{
    public int Id { get; set; }

    public required string Number { get; set; }

    public int CustomerId { get; set; }

    public Customer? Customer { get; set; }

    public DateOnly IssueDate { get; set; }

    public DateOnly DueDate { get; set; }

    public required string Currency { get; set; }

    public InvoiceStatus Status { get; set; }

    public List<InvoiceLine> Lines { get; } = [];

    public decimal Total => Money.Round(Lines.Sum(line => line.Quantity * line.UnitPrice));

    /// <summary>
    /// An invoice is overdue when it is marked overdue, or when it was sent and the due date has passed.
    /// </summary>
    public bool IsOverdue(DateOnly today) =>
        Status == InvoiceStatus.Overdue || (Status == InvoiceStatus.Sent && DueDate < today);

    public int DaysOverdue(DateOnly today) =>
        IsOverdue(today) ? Math.Max(0, today.DayNumber - DueDate.DayNumber) : 0;

    public bool CanSendReminder(DateOnly today) => Status == InvoiceStatus.Sent || IsOverdue(today);
}
