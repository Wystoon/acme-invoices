---
name: db-migrations
description: Use when adding or changing database schema or EF Core migrations in the Acme backend.
---
# EF Core migrations in Acme Invoices

Condensed from the wiki page `database-migrations.md`. For details, call
`get_wiki_section` with page `database-migrations.md` and the heading named below.

## Where things are
- DbContext: `src/backend/Acme.Invoices.Infrastructure/InvoicesDbContext.cs`
- Migrations: `src/backend/Acme.Invoices.Infrastructure/Migrations/`
- Seed data: `src/backend/Acme.Invoices.Infrastructure/SeedData.cs` (runs through `UseSeeding`)
- Database: SQLite. In Development the API migrates and seeds on startup.

## Create a migration
`dotnet-ef` is a local tool. Run from the repository root:

```bash
dotnet tool restore
dotnet ef migrations add <Name> \
  --project src/backend/Acme.Invoices.Infrastructure \
  --startup-project src/backend/Acme.Invoices.Api \
  --output-dir Migrations
```

Remove the last, unmerged migration with `dotnet ef migrations remove` and the same three options.

## Rules (CI checks the first three with `node tools/ci/check-migrations.mjs`)
1. File id `<14-digit timestamp>_<Name>`, Name in PascalCase: `AddXyz`, `RemoveXyz`, `RenameXyz`.
2. `Down()` is never empty and undoes `Up()`. A lone `throw` counts as empty.
3. `DropColumn` or `DropTable` in `Up()` needs `// acme:destructive-approved AB#<ticket>`
   on the line above, and approval from the database owner (Petra Vogel).
   A `Down()` that drops what its own `Up()` added needs no marker.
4. New non-nullable columns get a default value, so existing rows stay valid.
5. One concern per migration. Never edit a merged migration; add a new one.
6. Seed data lives in `SeedData.cs`, never in a migration (`HasData`).
   Seed values are fixed: fixed IDs, no `DateTime.Now`, no random values.
7. SQLite cannot alter columns; EF Core rebuilds the table. Decimals are stored as text,
   so do not sort or sum money in SQL.

## Before you finish
- [ ] Migration generated with the command above, not written by hand
- [ ] `Down()` implemented; applied, rolled back and re-applied locally
- [ ] Seed data in `SeedData.cs` updated if the new column needs values
- [ ] Domain and API tests cover the new field
- [ ] `node tools/ci/check-migrations.mjs` passes
- [ ] `dotnet test --solution src/backend` passes

## Wiki sections for details
- "Part 2: Naming and file layout", "Part 4: Down() is mandatory", "Part 5: Destructive changes"
- "Seed data rules", "Part 8: Seed data, data migrations, rollback, CI"
