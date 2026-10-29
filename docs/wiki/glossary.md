# Glossary

Last reviewed: 2025-11-20, owner: Mira Castell

Billing and engineering terms used around Acme Invoices. Alphabetical.

## A–D

**AB# link**: A reference to an Azure DevOps work item, written `AB#<id>`. Used in commit
messages (`AB#<id>: <summary>`), PR descriptions and migration markers.

**Credit note**: A document that reduces or cancels an issued invoice. We never edit an issued
invoice; we issue a credit note instead.

**Design token**: A named value (color, spacing, font size) shared across the Angular UI so the
same value is not hard-coded in many places.

**Dunning**: The process of reminding customers about unpaid invoices, in escalating levels.
Also called "reminders" in the UI.

## E–I

**Epic**: A work item grouping several Features. Sits under an Initiative.

**Feature**: A work item for one deliverable capability. Groups user stories and bugs.

**Initiative**: The top level of the work item hierarchy: Initiative > Epic > Feature.

**Invoice**: A request for payment sent to a customer. Has a number, an issue date, a due date
and one or more invoice lines. Amounts are `decimal`, rounded with `Money.Round`.

**Invoice line**: One row on an invoice: description, quantity, unit price, line total.

## M–O

**Migration**: An EF Core class that changes the database schema. Named `AddXyz`, `RemoveXyz`
or `RenameXyz`. See database-migrations.md.

**Overdue**: An invoice whose due date has passed and that is not fully paid.

## P–R

**Payment terms**: The number of days a customer has to pay, e.g. "30 days net". The due date
is the issue date plus the payment terms.

**Reminder**: One dunning step sent for an overdue invoice. See Dunning.

## S–Z

**Seed data**: Fixed, deterministic demo rows created by `SeedData.cs` on startup in
Development. Not real customer data.

**Work item**: Any tracked item in Azure DevOps (https://dev.acme.example/acme): bug, user
story, task, Feature, Epic, Initiative.

TODO(Mira): add "write-off" and "partial payment" once the finance team agrees on wording.
