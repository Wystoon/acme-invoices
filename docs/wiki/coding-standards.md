# Backend Coding Standards (C#)

Last reviewed: 2026-06-02, owner: Dana Novak

Rules for everything under `src/backend` (.NET 10, solution `Acme.Invoices.slnx`).
For the frontend, see `angular-style-guide.md`.

Projects in the solution:

- `Acme.Invoices.Domain` - entities, value objects, `Money`.
- `Acme.Invoices.Infrastructure` - EF Core + SQLite, typed HTTP clients.
- `Acme.Invoices.Api` - minimal API endpoints.
- `Acme.LegacyHttp` - deprecated, see [HTTP](#http).
- `tests/Acme.Invoices.Tests` - xUnit tests.

Run the tests with:

```bash
dotnet test --solution src/backend
```

## General

- Nullable reference types are on in every project. Don't disable them per file.
- Release builds treat warnings as errors. A warning you ignore locally breaks CI.
- Async all the way. Never call `.Result`, `.Wait()` or `.GetAwaiter().GetResult()`.
- Every async method that does I/O takes a `CancellationToken` and passes it on.
- Format with CSharpier (`dotnet csharpier format .`). Don't hand-format.

```csharp
public async Task<Invoice?> FindAsync(Guid id, CancellationToken cancellationToken) =>
    await db.Invoices.SingleOrDefaultAsync(i => i.Id == id, cancellationToken);
```

## Models: records vs classes

- API responses and requests are `record`s. These are our boundary models.
- EF Core entities are classes. Never return an entity from an endpoint.
- Map entity -> response explicitly (a static `From` method on the record is fine).

```csharp
public sealed record InvoiceResponse(
    Guid Id,
    string Number,
    string CustomerName,
    string Status,
    decimal Total,
    DateOnly DueDate)
{
    public static InvoiceResponse From(Invoice invoice) =>
        new(invoice.Id, invoice.Number, invoice.CustomerName,
            invoice.Status.ToString(), invoice.Total, invoice.DueDate);
}
```

Don't add `[JsonIgnore]` to an entity to "hide" a field. Make a response record instead.

## Endpoints

Minimal API endpoints are grouped per feature folder in `Acme.Invoices.Api`:

```text
Acme.Invoices.Api/
  Invoices/
    InvoiceEndpoints.cs
    InvoiceResponse.cs
    CreateInvoiceRequest.cs
  Customers/
    ...
```

- One `Map<Feature>Endpoints` extension method per feature, using `MapGroup`.
- Handlers are small. Business rules live in the Domain project.
- Use `TypedResults` so the OpenAPI document is accurate.

## Errors and validation

- Validation failures return `TypedResults.ValidationProblem(errors)` (HTTP 400).
- Not found returns `TypedResults.NotFound()`.
- Don't throw exceptions for expected cases like "invoice not found".
- Unhandled exceptions are turned into ProblemDetails by the global handler.
  Don't catch-and-swallow in endpoints.

```csharp
if (request.DueDate < today)
{
    return TypedResults.ValidationProblem(new Dictionary<string, string[]>
    {
        ["dueDate"] = ["Due date cannot be in the past."],
    });
}
```

## Dates and time

- Inject `TimeProvider`. Never use `DateTime.Now`, `DateTime.UtcNow` or `DateTimeOffset.Now`.
- Tests use a fake `TimeProvider` so "overdue" logic is deterministic.
- Store timestamps in UTC. Use `DateOnly` for due dates and invoice dates.

```csharp
var today = DateOnly.FromDateTime(timeProvider.GetUtcNow().UtcDateTime);
```

## Money

- Money is always `decimal`. Never `double` or `float`.
- Round with `Money.Round`: 2 decimal places, `MidpointRounding.AwayFromZero`.
- Round once, at the defined points (line total, tax, invoice total). Not "just in case".
- Don't call `Math.Round` directly on money. Its default is banker's rounding.

```csharp
var lineTotal = Money.Round(line.Quantity * line.UnitPrice);
```

Note: older code in `InvoiceCalculator` still has a local rounding helper.
It does the same thing; replace it with `Money.Round` when you touch that file.

## HTTP

- Always use `IHttpClientFactory` with typed clients, e.g. `ExchangeRateClient`.
- Register typed clients in Infrastructure with `services.AddHttpClient<ExchangeRateClient>(...)`.
- Base addresses come from configuration, never hard-coded.
- In development the exchange-rate client points to the local stub, not `rates.acme.example`.
- Never use `Acme.LegacyHttp` / `LegacyHttpClient` in new code.
  The build fails with analyzer error **RS0030** (banned API).
  The ban list is `src/backend/BannedSymbols.txt`.
- The one remaining legacy usage is `LegacyReportExporter`.
  It is scheduled for removal in AB#4590. Don't copy from it, don't add to it.
- Don't edit `BannedSymbols.txt` or wrap RS0030 in `#pragma warning disable`.
  If you think you need the legacy client, talk to Dana first.

```csharp
public sealed class ExchangeRateClient(HttpClient http)
{
    public async Task<decimal> GetRateAsync(string from, string to, CancellationToken cancellationToken)
    {
        var response = await http.GetFromJsonAsync<RateResponse>(
            $"rates/{from}/{to}", cancellationToken);
        return response!.Rate;
    }
}
```

## Logging

- Use `[LoggerMessage]` source-generated methods. No `logger.LogInformation($"...")`.
- Message templates use named placeholders in PascalCase: `{InvoiceId}`.
- Never log secrets, tokens or full customer addresses.

```csharp
internal static partial class InvoiceLog
{
    [LoggerMessage(Level = LogLevel.Information, Message = "Invoice {InvoiceId} marked as paid")]
    public static partial void InvoicePaid(ILogger logger, Guid invoiceId);
}
```

## Naming

| Thing                 | Convention               | Example                    |
| --------------------- | ------------------------ | -------------------------- |
| Types, methods        | PascalCase               | `InvoiceCalculator`        |
| Async methods         | `Async` suffix           | `GetRateAsync`             |
| Locals, parameters    | camelCase                | `dueDate`                  |
| Private fields        | `_camelCase`             | `_timeProvider`            |
| Interfaces            | `I` prefix               | `IInvoiceRepository`       |
| Response records      | `<Thing>Response`        | `InvoiceResponse`          |
| Request records       | `<Verb><Thing>Request`   | `CreateInvoiceRequest`     |
| Test methods          | `Method_State_Expected`  | `Round_Midpoint_RoundsUp`  |

- Prefer primary constructors for services; then there are no `_fields` at all.
- No abbreviations except well-known ones (`Id`, `Http`, `Api`).

## Tests

- xUnit in `tests/Acme.Invoices.Tests`.
- Every bug fix comes with a test that fails before the fix.
- Use the fake `TimeProvider` and the exchange-rate stub. Tests never call real services.
- Command: `dotnet test --solution src/backend`.

TODO(Dana): add a section on EF Core migrations once Petra signs off on the process.
