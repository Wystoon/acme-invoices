using System.Globalization;
using Acme.Invoices.Api.Notifications;
using Acme.Invoices.Domain;
using Acme.Invoices.Infrastructure;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

namespace Acme.Invoices.Api.Invoices;

public static class InvoiceEndpoints
{
    public const int DefaultPageSize = 20;
    public const int MaxPageSize = 100;

    public static IEndpointRouteBuilder MapInvoiceEndpoints(this IEndpointRouteBuilder app)
    {
        var invoices = app.MapGroup("/api/invoices");
        invoices.MapGet("/", ListInvoices);
        invoices.MapGet("/{id:int}", GetInvoice);
        invoices.MapPost("/{id:int}/send-reminder", SendReminder);
        return app;
    }

    private static async Task<
        Results<Ok<PagedResponse<InvoiceSummaryResponse>>, ValidationProblem>
    > ListInvoices(
        InvoicesDbContext db,
        TimeProvider clock,
        string? status,
        int? customerId,
        int? page,
        int? pageSize,
        CancellationToken cancellationToken
    )
    {
        var errors = new Dictionary<string, string[]>();
        var statusFilter = ParseStatus(status, errors);
        var pageNumber = page ?? 1;
        var size = pageSize ?? DefaultPageSize;
        if (pageNumber < 1)
        {
            errors["page"] = ["Page must be 1 or higher."];
        }

        if (size is < 1 or > MaxPageSize)
        {
            errors["pageSize"] = [$"Page size must be between 1 and {MaxPageSize}."];
        }

        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        var query = db.Invoices.AsNoTracking().WithFilter(statusFilter, customerId);
        var totalCount = await query.CountAsync(cancellationToken);
        var invoices = await query
            .Include(invoice => invoice.Customer)
            .Include(invoice => invoice.Lines)
            .OrderByDescending(invoice => invoice.IssueDate)
            .ThenByDescending(invoice => invoice.Id)
            .Skip((pageNumber - 1) * size)
            .Take(size)
            .ToListAsync(cancellationToken);

        var today = clock.Today();
        var items = invoices
            .Select(invoice => InvoiceSummaryResponse.From(invoice, today))
            .ToList();
        return TypedResults.Ok(
            new PagedResponse<InvoiceSummaryResponse>(items, pageNumber, size, totalCount)
        );
    }

    private static async Task<Results<Ok<InvoiceDetailResponse>, NotFound>> GetInvoice(
        int id,
        InvoicesDbContext db,
        TimeProvider clock,
        CancellationToken cancellationToken
    )
    {
        var invoice = await FindInvoiceAsync(db, id, cancellationToken);
        return invoice is null
            ? TypedResults.NotFound()
            : TypedResults.Ok(InvoiceDetailResponse.From(invoice, clock.Today()));
    }

    private static async Task<Results<Accepted, NotFound, ProblemHttpResult>> SendReminder(
        int id,
        InvoicesDbContext db,
        IEmailSender emailSender,
        TimeProvider clock,
        CancellationToken cancellationToken
    )
    {
        var invoice = await FindInvoiceAsync(db, id, cancellationToken);
        if (invoice?.Customer is not { } customer)
        {
            return TypedResults.NotFound();
        }

        if (!invoice.CanSendReminder(clock.Today()))
        {
            return TypedResults.Problem(
                statusCode: StatusCodes.Status409Conflict,
                title: "Reminder not sent",
                detail: $"Invoice {invoice.Number} is {invoice.Status}. Reminders go out for sent or overdue invoices only."
            );
        }

        var body = string.Create(
            CultureInfo.InvariantCulture,
            $"Invoice {invoice.Number} for {invoice.Currency} {invoice.Total:0.00} was due on {invoice.DueDate:yyyy-MM-dd}."
        );
        await emailSender.SendAsync(
            new EmailMessage(customer.Email, $"Reminder: invoice {invoice.Number}", body),
            cancellationToken
        );
        return TypedResults.Accepted((string?)null);
    }

    private static Task<Invoice?> FindInvoiceAsync(
        InvoicesDbContext db,
        int id,
        CancellationToken cancellationToken
    ) =>
        db
            .Invoices.AsNoTracking()
            .Include(invoice => invoice.Customer)
            .Include(invoice => invoice.Lines)
            .SingleOrDefaultAsync(invoice => invoice.Id == id, cancellationToken);

    private static InvoiceStatus? ParseStatus(string? status, Dictionary<string, string[]> errors)
    {
        if (status is null)
        {
            return null;
        }

        if (
            Enum.TryParse<InvoiceStatus>(status, ignoreCase: true, out var parsed)
            && Enum.IsDefined(parsed)
        )
        {
            return parsed;
        }

        errors["status"] =
        [
            $"Unknown status '{status}'. Use one of: {string.Join(", ", Enum.GetNames<InvoiceStatus>())}.",
        ];
        return null;
    }
}
