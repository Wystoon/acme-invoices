# Database Migrations (EF Core)

Last reviewed: 2026-09-14, owner: Petra Vogel

How we change the Acme Invoices schema without breaking anyone's day.

This is a 9-part guide.
Read Part 1 and Part 3 even if you skip the rest.

Questions: the #billing-dev channel.
Schema approvals: Petra Vogel (database owner).

TODO(Petra): add a diagram of the migration pipeline.

---

## Part 1: Ground rules

The short version. The other parts expand on these.

1. Every schema change is an EF Core migration.
   No hand-written SQL scripts against any database.
2. Names are `AddXyz`, `RemoveXyz` or `RenameXyz`, PascalCase.
3. Every migration implements `Down()`, and you have run it.
4. No destructive change without a
   `// acme:destructive-approved AB#<ticket>` marker
   AND approval from the database owner.
5. Seed data lives in `SeedData.cs`, not in migrations.
6. We run on SQLite. Some things work differently.
7. One migration per pull request, unless the work item needs more.
8. Never edit a merged migration. Add a new one.

### Where things live

All paths are under `src/backend/`.

| What | Path |
|------|------|
| DbContext | `Acme.Invoices.Infrastructure/InvoicesDbContext.cs` |
| Migrations | `Acme.Invoices.Infrastructure/Migrations/` |
| Seed data | `Acme.Invoices.Infrastructure/SeedData.cs` |
| Startup project | `Acme.Invoices.Api` |
| Local DB file | `Acme.Invoices.Api/acme-invoices.db` |

The CI check is `tools/ci/check-migrations.mjs` (repo root).

### Who to ask

- Petra Vogel: database owner, approves destructive changes.
- Dana Novak: Billing backend, knows the invoice tables.
- Ravi Menon (`@acme/dev-platform`): owns CI and the check script.
- Sam Okafor: SRE, on-call. Ask before long data migrations.

---

## Part 2: Naming and file layout

### The naming rule

PascalCase, starting with one of these verbs:

- `AddXyz`: new tables, columns, indexes, constraints.
- `RemoveXyz`: removing any of those.
- `RenameXyz`: renames.

Good:

```text
AddCustomerPaymentTerms
AddInvoiceDueDateIndex
RemoveLegacyFaxNumber
RenameInvoiceLineQtyToQuantity
```

Bad:

```text
add_payment_terms         snake_case
PaymentTerms              no verb
UpdateStuff               Update is not allowed
Fix                       no
AddCustomerPaymentTerms2  pick a better name
```

The one exception is `Initial`, the first migration.
Do not create another one.

### The migration file id

EF Core generates the id as `<14-digit timestamp>_<Name>`.

The timestamp is UTC, `yyyyMMddHHmmss`.

Example: `20261027115532_Initial`

Each migration produces these files:

```text
Migrations/
  20261027115532_Initial.cs
  20261027115532_Initial.Designer.cs
  InvoicesDbContextModelSnapshot.cs
```

The snapshot is shared and rewritten every time.

- Do not rename files by hand.
  The id is also in the `[Migration("...")]` attribute.
- Do not edit timestamps to reorder migrations.
  Merge main into your branch and regenerate (see the FAQ).
- Do not delete the Designer file.

### One concern per migration

Payment terms AND a column rename = two migrations.
Probably two pull requests.

---

## Part 3: Creating, removing and applying

### First: restore local tools

`dotnet-ef` is a LOCAL tool, pinned in the repo tool manifest.

Run once after cloning, and after the manifest changes:

```bash
dotnet tool restore
```

"Could not execute because the specified command
or file was not found" means you skipped this.

Do NOT install `dotnet-ef` globally.
A global version drifts from the one CI uses.

### Add a migration

From the repository root:

```bash
dotnet ef migrations add AddCustomerPaymentTerms --project src/backend/Acme.Invoices.Infrastructure --startup-project src/backend/Acme.Invoices.Api --output-dir Migrations
```

- `--project`: where migrations live (Infrastructure).
- `--startup-project`: the API, which holds the configuration.
- `--output-dir Migrations`: one folder. No sub-folders.

### Remove the last migration

Only for a migration that is NOT merged yet:

```bash
dotnet ef migrations remove \
  --project src/backend/Acme.Invoices.Infrastructure \
  --startup-project src/backend/Acme.Invoices.Api
```

This also reverts the snapshot.

If it was applied locally, roll back first,
or delete the local database file.

### Apply migrations locally

```bash
dotnet ef database update \
  --project src/backend/Acme.Invoices.Infrastructure \
  --startup-project src/backend/Acme.Invoices.Api
```

Rarely needed: in Development the API applies
migrations and seeds on startup.

### Roll back to a specific migration

```bash
dotnet ef database update Initial \
  --project src/backend/Acme.Invoices.Infrastructure \
  --startup-project src/backend/Acme.Invoices.Api
```

This runs `Down()` for every migration after `Initial`.

Pass the name of the migration you want to END on.

### Reset your local database

Stop the API, delete the file, start the API:

```bash
rm src/backend/Acme.Invoices.Api/acme-invoices.db
```

The API (http://localhost:5080) recreates, migrates and seeds it.

### After generating: read the code

EF Core guesses. Open the generated `.cs` file and check:

- Only what you meant to change.
- Column types and nullability as expected.
- Renames are renames, not drop+add (Part 6).
- `Down()` is not empty and undoes `Up()`.

Then format it:

```bash
dotnet csharpier format src/backend/Acme.Invoices.Infrastructure/Migrations
```

CI runs `dotnet csharpier check .` on migrations too.

---

## Part 4: Down() is mandatory

### The rule

ALWAYS implement `Down()`. ALWAYS test it.

An empty `Down()` fails CI (Part 8).

A `Down()` that only throws `NotSupportedException`
counts as empty.

### How to test Down()

On a throwaway copy of your local database:

1. Apply your migration (`dotnet ef database update`).
2. Roll back to the previous migration.
3. Apply it again.
4. Start the API, click through the invoice list.

If step 2 or 3 fails, the migration is not done.

### Example

```csharp
public partial class AddCustomerPaymentTerms : Migration
{
    protected override void Up(MigrationBuilder mb)
    {
        mb.AddColumn<int>(
            name: "PaymentTermsDays",
            table: "Customers",
            type: "INTEGER",
            nullable: false,
            defaultValue: 14
        );
    }

    protected override void Down(MigrationBuilder mb)
    {
        mb.DropColumn(name: "PaymentTermsDays", table: "Customers");
    }
}
```

A `Down()` that removes what its own `Up()` added is not destructive.

It needs no marker. The marker is for `Up()`: changes that destroy existing data.

The check script only looks at `Up()` for this reason.

### When Down() cannot restore data

Some changes lose data on the way back.

- `Down()` must still restore the schema.
- Add a comment saying what data is lost.
- Say so in the PR description so Petra can decide.

---

## Part 5: Destructive changes

### What counts as destructive

- `DropColumn`
- `DropTable`
- `AlterColumn` that can lose data:
  - narrowing a type,
  - NOT NULL without a default,
  - `TEXT` to `INTEGER`,
  - shorter max length.
- `migrationBuilder.Sql(...)` with `DELETE` or `DROP`,
  or `UPDATE` without `WHERE`.

### The rule

No destructive change without BOTH:

1. `// acme:destructive-approved AB#<ticket>`
   on the line directly above the call.
2. Approval from the database owner (Petra Vogel) on the PR.

```csharp
// acme:destructive-approved AB#4907
migrationBuilder.DropColumn(name: "FaxNumber", table: "Customers");
```

Marker rules:

- Immediately above. A blank line in between does not count.
- A real work item at https://dev.acme.example/acme.
- One marker per call. One at the top of the file covers nothing.
- The marker is not the approval.
  It tells the reviewer and CI that you know.

### Prefer two-step removal

To remove a column the code still reads:

1. Release N: stop reading and writing it in code. Ship.
2. Release N+1: `RemoveXyz` migration, marker, Petra's approval.

Rolling back N+1 then does not break a running N.

---

## Part 6: Schema changes in practice

### New columns on existing rows

Existing rows get a value the moment the migration runs.

Choose it on purpose.

| Case | Do this |
|------|---------|
| Optional value | `nullable: true`, no default |
| Required, sensible default | `nullable: false` + `defaultValue` |
| Required, no sensible default | nullable, backfill, then NOT NULL later |

Never add NOT NULL without a default.

On SQLite it fails or silently fills zero/empty.

Money columns:

- CLR type `decimal`, default `0m`.
- Round in code with `Money.Round`
  (2 places, `MidpointRounding.AwayFromZero`).
- Never round in SQL.

Dates:

- No `defaultValueSql: "CURRENT_TIMESTAMP"` for business dates.
- Set them in code via the injected `TimeProvider`.

### Renames vs drop+add

EF Core sometimes turns a property rename into drop+add.

That loses every value in the column.

If you see this for a rename:

```csharp
mb.DropColumn(name: "Qty", table: "InvoiceLines");
mb.AddColumn<int>(name: "Quantity", table: "InvoiceLines" /* ... */);
```

replace it with:

```csharp
mb.RenameColumn(name: "Qty", table: "InvoiceLines", newName: "Quantity");
```

and name it `RenameInvoiceLineQtyToQuantity`.

- A rename is not destructive. No marker.
- A drop+add is destructive and needs one.
  That is your hint something went wrong.
- Renames break raw SQL using the old name.
  Search the repo first.

### Indexes

- Let EF Core name them (`IX_<Table>_<Column>`).
- Migration name: `AddInvoiceDueDateIndex`.
- Unique indexes fail on existing duplicates. Check first.

---

## Part 7: SQLite specifics

We use EF Core with SQLite in every environment.

### No ALTER COLUMN

SQLite cannot alter a column in place.

For `AlterColumn`, EF Core rebuilds the table:

1. Create a new table with the new schema.
2. Copy all rows.
3. Drop the old table.
4. Rename the new one.

Consequences:

- Slow on large tables. Locks for the whole copy.
- Foreign keys and indexes are recreated. Read the code.
- Review it as a destructive change.
- Some operations are unsupported; EF Core throws.
  Do not "fix" that with raw SQL. Talk to Petra.

### Decimals are stored as TEXT

The SQLite provider stores `decimal` as TEXT.

So:

- NO `ORDER BY` on a decimal column in SQL.
  It sorts as text: "100.00" before "9.50".
- NO `SUM`, `AVG`, `MIN`, `MAX` on decimals in SQL.
  Some fail to translate; raw SQL gives wrong answers.
- Do the math in C#, in memory. Then `Money.Round`.

```csharp
// Wrong: sorts as text in SQL
var list = await db.Invoices.OrderBy(i => i.Total).ToListAsync(ct);

// Right: load, then sort in memory
var all = await db.Invoices.ToListAsync(ct);
var list = all.OrderBy(i => i.Total).ToList();
```

This does not scale to millions of rows. We do not have millions.

### Other things to know

- One writer at a time. A long write blocks the API.
- Foreign keys are on because EF Core enables them per connection.
- Types are loose outside EF Core.
- `DateTimeOffset` is TEXT too. Sort in memory.

---

## Part 8: Seed data, data migrations, rollback, CI

### Seed data rules

Seed data lives in `Acme.Invoices.Infrastructure/SeedData.cs`.

It is wired through EF Core `UseSeeding` and `UseAsyncSeeding`.

- Deterministic: same rows every time.
- Fixed IDs. No `Guid.NewGuid()`.
- No `DateTime.Now` / `UtcNow`. Use fixed dates.
- Idempotent: running twice creates no duplicates.
- Implement BOTH `UseSeeding` and `UseAsyncSeeding`, same logic.
- Never seed new data in a migration with `HasData`.
- No real customer data, ever.

```csharp
public static void Seed(DbContext context, bool _)
{
    var db = (InvoicesDbContext)context;
    if (db.Customers.Any(c => c.Id == SeedIds.DemoCustomer))
    {
        return; // already seeded
    }

    db.Customers.Add(new Customer
    {
        Id = SeedIds.DemoCustomer,
        Name = "Acme Demo Customer",
        PaymentTermsDays = 30,
        CreatedAt = new DateTime(2026, 1, 15, 0, 0, 0, DateTimeKind.Utc),
    });
    db.SaveChanges();
}
```

In Development the API migrates and seeds on startup.

The seed may run more than once. Hence idempotent.

Why no `HasData`? It bakes rows into migrations and the snapshot.

Every edit to a seeded row becomes a new migration.

Old `HasData` calls in `Initial` stay. Do not add new ones.

### Long-running data migrations

A data migration changes rows, not schema.

- Under ~10,000 rows: OK inside the migration
  with simple, set-based `migrationBuilder.Sql(...)`.
- Bigger or slow: NOT in a migration.
  Write a one-off command, run it in test first,
  schedule it with Sam Okafor.
- Single writer: the API cannot write while it runs.
- Must be idempotent, like seed data.
- No money arithmetic in SQL. Load, compute in C#, save.

### Rollback procedure

If a release with a migration goes wrong:

1. Tell #billing-dev and the on-call pager (Sam Okafor).
2. Decide: roll forward (fix migration) or roll back.
   Prefer roll forward if the fix is small.
3. Roll back: the release pipeline runs `Down()` to the
   previous release's last migration, then redeploys
   the previous build.
4. Petra confirms the state on `prod-db.acme.example`.
5. Write a postmortem (see postmortems-2025.md).

Production is never touched from a developer machine.

Never point `dotnet ef database update` at `prod-db.acme.example`.

### CI checks

`tools/ci/check-migrations.mjs` runs on every PR touching `Migrations/`.

Owner: Ravi Menon (`@acme/dev-platform`).

It checks:

- Naming: file id `<14-digit timestamp>_<Name>` with a PascalCase name.
  The `Add`/`Remove`/`Rename` prefix is our convention (Part 2); reviewers check it.
- Non-empty `Down()`: at least one real call.
- Destructive markers: every `DropColumn` and `DropTable` in `Up()`
  has `// acme:destructive-approved AB#<ticket>` directly above.
- A data-losing `AlterColumn` needs the marker too, but the script cannot tell
  which ones lose data. Reviewers check those.

Run it locally before pushing:

```bash
node tools/ci/check-migrations.mjs
```

It does NOT check:

- Whether Petra approved. Reviewer's job.
- Whether `Down()` is correct. Your job.
- Whether an `AlterColumn` really loses data. It flags all of them.

CI also runs the backend tests and `dotnet csharpier check .`.

Release builds treat warnings as errors. Generated code too.

### Review checklist

Copy into the PR description:

- [ ] Work item linked (`AB#<id>`)
- [ ] Branch is `feature/<id>-<slug>` or `bugfix/<id>-<slug>`
- [ ] Name is `AddXyz` / `RemoveXyz` / `RenameXyz`, PascalCase
- [ ] File id is `<14-digit timestamp>_<Name>`
- [ ] Designer file and snapshot included
- [ ] One concern per migration
- [ ] Generated code read line by line
- [ ] `Down()` implemented, not empty
- [ ] `Down()` tested (update, roll back, update)
- [ ] Renames use `RenameColumn`, not drop+add
- [ ] New columns: nullability and default decided
- [ ] Destructive calls have the marker on the line above
- [ ] Petra Vogel approved, if anything is destructive
- [ ] No `ORDER BY` / `SUM` on decimals in SQL
- [ ] No new `HasData`; seed changes in `SeedData.cs`
- [ ] Seed is deterministic and idempotent
- [ ] Large data migrations scheduled with on-call
- [ ] `node tools/ci/check-migrations.mjs` passes
- [ ] `dotnet csharpier check .` and tests pass

---

## Part 9: FAQ and history

### FAQ

**Two branches added a migration. The snapshot conflicts.**

Whoever merges second:

1. Merges main into their branch (no rebase: see `git-workflow.md`).
2. Runs `dotnet ef migrations remove ...`.
3. Runs `dotnet ef migrations add ...` again.

Never merge the snapshot by hand.

**Can I edit a migration after it is merged?**

No. It may be applied in test or production. Write a new one.

**`dotnet ef` says "No project was found".**

Run from the repo root, pass `--project` and `--startup-project`.

Also run `dotnet tool restore`.

**Works locally, API crashes on startup in test.**

Usually a non-idempotent seed, or NOT NULL without a default.

Check the log search for the startup exception.

**Can I use `migrationBuilder.Sql`?**

For small, set-based data fixes, yes.

Not for schema EF Core can express.

Not for anything destructive without the marker.

**How do I see the SQL a migration will run?**

```bash
dotnet ef migrations script \
  --project src/backend/Acme.Invoices.Infrastructure \
  --startup-project src/backend/Acme.Invoices.Api
```

**Do integration tests run migrations?**

They use in-memory SQLite and build the schema from the model.

They do not run `Down()`. That is manual (Part 4).

See testing.md.

**Does `Acme.LegacyHttp` have a database?**

No. It is deprecated. Do not add migrations there.

**Can we switch to another database?**

Not on this page. Ask Lena Hofer.

### Outdated: the 2024 process (do not use)

Kept because old PRs still link here. None of it applies.

- ~~Names after the ticket, e.g. `Ticket3120`.~~
- ~~`Down()` optional "for additive changes".~~
- ~~`// DESTRUCTIVE OK` comment, no ticket.~~
- ~~Seed data via `HasData` in each migration.~~
- ~~`dotnet-ef` installed globally.~~
- ~~Schema scripts emailed to dba@acme.example.~~

If an old page says otherwise, it is wrong. Follow Parts 1 to 8.

TODO(Petra): delete this section after the Q1 2027 cleanup.
