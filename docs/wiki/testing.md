# Testing

Last reviewed: 2026-06-02, owner: Tom Brandt

What we test, how we name tests, and how to run them. Short on purpose.

## What to test

### Domain rules: unit tests

Anything in `Acme.Invoices.Domain` (totals, due dates, overdue status, dunning levels, rounding
with `Money.Round`) gets plain unit tests in `tests/Acme.Invoices.Tests` (xUnit).

- No database, no HTTP. Construct the objects and assert.
- Dates come from `FakeTimeProvider`, never `DateTime.Now`. Advance the fake clock to test
  "overdue after 30 days" instead of waiting 30 days.

### Endpoints: integration tests

Every minimal API endpoint in `Acme.Invoices.Api` gets at least one integration test.

- Use `WebApplicationFactory<Program>` and swap the database for in-memory SQLite.
- Keep the SQLite connection open for the lifetime of the test, or the in-memory database
  disappears.
- Register a `FakeTimeProvider` in the factory so responses with dates are stable.
- Assert on status codes and the response body, not on internal state.

### Frontend: Vitest specs

The Angular app in `src/frontend` uses Vitest.

- Components and services get a `*.spec.ts` next to them.
- HTTP calls are tested with `HttpTestingController`: expect the request, flush a response,
  then assert on the signals or rendered output.
- Call `httpTesting.verify()` in `afterEach` so stray requests fail the test.

### Test data

- Build test data in the test itself (or a small builder), with fixed IDs and fixed dates.
- Do not rely on `SeedData.cs` rows in tests; seed data is for local development.
- Money assertions compare `decimal` values exactly, after `Money.Round`.

## Naming

Either style is fine; be consistent within a file.

- `Method_Condition_Result`, e.g. `Total_WithDiscountLine_RoundsAwayFromZero`
- A plain-English sentence, e.g. `"marks the invoice overdue one day after the due date"`

TODO(Tom): pick one style for new test files. Discussed twice, no decision yet.

## How to run

### Backend

```bash
dotnet test --solution src/backend
```

Use exactly this form. The test runner is Microsoft.Testing.Platform, and the old positional
`dotnet test src/backend` is rejected.

The full backend suite runs in a few seconds. Run it before every PR.

### Frontend

```bash
npm --prefix src/frontend test
npm --prefix src/frontend run lint
```

Run both before every PR that touches the frontend.

## Notes

- CI runs all of the above on every pull request; a red build blocks the merge.
- Migrations' `Down()` methods are not covered by automated tests. See database-migrations.md.
- Old note: some tests in `Acme.LegacyHttp` were skipped in 2025. That project is deprecated;
  do not add tests there.
