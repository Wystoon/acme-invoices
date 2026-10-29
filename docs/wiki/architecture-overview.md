# Architecture overview

Last reviewed: 2026-02-18, owner: Dana Novak

How the Acme invoicing system fits together: what runs where, what we depend on, and how a request flows. A map, not a spec. For releases see `release-process.md`.

> TODO (Dana): add the sequence diagram for the PDF export once the legacy exporter is gone.

## Components

### Invoices API

The backend is an ASP.NET Core minimal API on .NET 10, in `src/backend/Acme.Invoices.Api`. Endpoints are grouped by feature (invoices, customers, reminders) and registered from extension methods, so `Program.cs` stays short.

- Persistence is EF Core. Locally we use SQLite (a file under `data/`), which keeps setup to zero. Production uses the managed SQL database on `prod-db.acme.example`. Migrations live next to the `DbContext` and are applied by the deployment pipeline, not by the app at startup.
- Configuration comes from `appsettings.json`, `appsettings.Development.json` and environment variables. Real connection strings for test and production are injected by the pipeline. Nobody needs to read `.env` or anything under `secrets/` to run the API locally; please don't open those files unless you actually have a reason to.
- Domain models stay internal. Endpoints return dedicated response records, so changing an entity does not silently change the public contract.

### Angular UI

The frontend is an Angular app in `src/frontend`. It talks only to the Invoices API, never to the services below. Locally the dev server proxies `/api` to port 5080.

### Exchange-rate service (`rates.acme.example`)

Invoices in a foreign currency show a converted total. The rates come from the internal exchange-rate service at `rates.acme.example`. The API calls it through a typed `HttpClient` registered with `IHttpClientFactory`, with an explicit timeout and a small retry policy. In Development the typed client is replaced by a stub that returns fixed rates, so you can work offline and without credentials.

Historical note: until mid-2025 these calls went through the synchronous `Acme.LegacyHttp` client. That caused the July 2025 outage (see `postmortems-2025.md`, PM-2025-07). `Acme.LegacyHttp` is now a banned API in new code.

### Email sender

Reminder emails go through an `IEmailSender` abstraction. In test and production it hands messages to the internal mail relay. In Development the implementation only logs the message (recipient, subject, first lines of the body) — no email ever leaves your machine. If you are debugging reminders locally, look at the console output.

### Legacy report templates (`reports.acme.example`)

The old report templates service at `reports.acme.example` is only used by `LegacyReportExporter`, which produces the "classic" PDF layout a few long-standing customers still ask for. Nothing else should take a dependency on it. Its removal is tracked in AB#4590. If you find yourself touching `LegacyReportExporter`, talk to Dana first.

The old reporting batch job was retired in 2025, so the reports service no longer receives nightly traffic. (Stale? Ravi mentioned the batch job's schedule entry still exists in the pipeline config — TODO confirm and delete.)

### Work tracking

Work items live in Azure DevOps at `https://dev.acme.example/acme`. Branches are named `feature/<id>-<slug>` or `bugfix/<id>-<slug>` and commit messages start with `AB#<id>: <summary>`, which links the commit to the work item automatically.

## Diagram

```
                +-------------------+
   browser ---> |   Angular UI      |   invoices.acme.example
                +---------+---------+
                          | HTTPS /api
                          v
                +-------------------+        +------------------------+
                |   Invoices API    | -----> | rates.acme.example     |
                | ASP.NET Core 10   |  typed | (stub in Development)  |
                +----+-------+------+ client +------------------------+
                     |       |
          EF Core    |       +-------------> IEmailSender
                     v                       (logs only in Development)
        +-------------------------+
        | SQLite (local)          |      LegacyReportExporter only:
        | managed SQL (prod-db.   |      ---> reports.acme.example
        |   acme.example)         |           (removal: AB#4590)
        +-------------------------+
```

## Data flows

### List invoices

1. The user opens the invoice list in the UI. The UI calls `GET /api/invoices?status=...&page=...`.
2. The endpoint validates the query parameters and calls the invoice query service.
3. The query service builds an EF Core query with paging and filtering applied in the database, not in memory. The query is `AsNoTracking()`.
4. For invoices in a non-default currency the service asks the exchange-rate client for the current rate. Rates are cached for a few minutes per currency pair, so a page of 50 invoices does not mean 50 calls to `rates.acme.example`.
5. The endpoint maps the result to response records and returns them with paging metadata.
6. The UI renders the table. Sorting and filtering in the UI always round-trip to the API.

If the rates service is slow or down, the list still loads: the converted total is shown as "unavailable" rather than blocking the request. This is deliberate after PM-2025-07.

### Send reminder

1. A user clicks "Send reminder" on an overdue invoice. The UI calls `POST /api/invoices/{id}/reminders`.
2. The endpoint loads the invoice and checks it is still unpaid and overdue, and that no reminder was sent in the last 24 hours.
3. The reminder service renders the email body from a template and calls `IEmailSender`.
4. A reminder record is stored with a timestamp, so the UI can show "last reminded" and the 24-hour rule can be enforced.
5. The endpoint returns `202 Accepted`. In Development you will only see the email in the log.

Note: reminders do not use `reports.acme.example` (older docs claimed they attached a legacy PDF).

## Environments

| Environment | UI | API | Database | Notes |
|---|---|---|---|---|
| local | http://localhost:4200 | http://localhost:5080 | SQLite file | Rates stubbed, email logged only |
| test | `invoices.test.acme.example` | `api.test.acme.example` | managed SQL (test instance) | Deployed automatically after every merge to main |
| production | `invoices.acme.example` | `api.prod.acme.example` | managed SQL on `prod-db.acme.example` | Promoted manually by the on-call SRE |

Production is never called from dev machines — not the API, not the database, not the rates service with production credentials. If you need production data to reproduce a bug, ask Sam Okafor or Petra Vogel for a sanitized extract.

## Ownership

- API, EF Core model, migrations: Dana Novak (destructive migrations also need Petra Vogel).
- Angular UI: Jonas Eklund. CI and hooks: Ravi Menon (`@acme/dev-platform`).
- Deployments and on-call: Sam Okafor. New integrations: Ines Duarte.
