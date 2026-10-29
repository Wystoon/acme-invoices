# Postmortems 2025

Last reviewed: 2026-01-20, owner: Sam Okafor

This page collects the Billing postmortems from 2025. All postmortems are blameless: we describe what happened and what the system allowed to happen, not who to blame. People who caused an incident are referred to as "a developer". Times are in UTC.

Action items are tracked as Azure DevOps work items at `https://dev.acme.example/acme`. Status below is as of the last review.

## PM-2025-03: Force-push to main erased two days of commits

**Date:** 2025-03-13
**Severity:** high (development blocked, no customer impact)
**Postmortem lead:** Ravi Menon

### Summary

A developer force-pushed a rebased local copy of main to the server. Their local main was two days behind, so the push replaced the server's main with an older history plus their own commits. 14 commits from 3 people disappeared from the server. The commits were recovered from a colleague's clone about 5 hours later.

### Timeline

- 09:42 — A developer rebases local work onto a stale local main and runs `git push --force origin main` after a normal push was rejected.
- 09:43 — Push succeeds. The pipeline starts a build from the rewritten main.
- 10:05 — Another developer's pull request shows unexpected conflicts against main. They post in #billing-dev.
- 10:31 — Dana Novak notices commits from the previous two days are missing from main's history.
- 10:40 — Merges to main are paused. Ravi Menon is paged.
- 11:15 — The server-side reflog is not available to us; recovery from a local clone is chosen.
- 12:50 — A colleague's clone is found with all 14 commits (fetched the previous evening).
- 13:55 — Main is restored from that clone and verified against pull request merge records.
- 14:40 — Merges resume. Pipeline green on restored main.

### Impact

- About 5 hours with no merges to main for the whole team.
- 14 commits from 3 people temporarily lost; all recovered.
- One test deployment rolled back to an older build. No production impact.

### Root cause

Main accepted direct pushes and non-fast-forward pushes. A rejected normal push led to a force-push, which the server allowed. Nothing in the tooling distinguished main from a personal branch.

### What went well

- The problem was spotted within an hour.
- Recovery from a local clone worked, and pull request records let us verify nothing was missed.

### What went badly

- No server-side protection on main.
- Branch naming and "pull request only" were conventions, not enforced.
- It took 2 hours to find a clone that was recent enough.

### Action items

| Action | Owner | Work item | Status |
|---|---|---|---|
| Server rule rejecting direct pushes to main and non-fast-forward pushes (`receive.denyNonFastForwards`, plus a pre-receive hook) | Ravi Menon | AB#4402 | Done |
| Enforce branch naming `feature/<id>-<slug>` / `bugfix/<id>-<slug>` and PR-only flow to main | Ravi Menon | AB#4403 | Done |
| Add "never force-push" to `git-workflow.md` | Dana Novak | AB#4404 | Done |
| Commit message hook requiring `AB#<id>: <summary>` | Ravi Menon | AB#4405 | Done |

## PM-2025-07: Exchange-rate calls froze the API

**Date:** 2025-07-31 (month-end)
**Severity:** critical (customer-facing outage)
**Postmortem lead:** Sam Okafor

### Summary

The exchange-rate service `rates.acme.example` became slow during the month-end invoicing run. The Invoices API called it synchronously through `LegacyHttpClient` from `Acme.LegacyHttp`, with no effective timeout. Request threads blocked waiting for responses, the thread pool was starved, and the API stopped answering any requests — including ones unrelated to exchange rates. The API was unavailable for 38 minutes.

### Timeline

- 07:58 — Month-end invoicing run starts; traffic rises as expected.
- 08:06 — `rates.acme.example` p95 latency climbs from ~80 ms to over 20 s (cause on their side: a slow database query, tracked by the rates team).
- 08:09 — Invoices API p95 latency jumps; thread count rises steadily.
- 08:12 — Health checks time out. The on-call pager fires. Sam Okafor acknowledges.
- 08:20 — API returns no responses. UI shows errors for all users.
- 08:27 — Thread dumps show hundreds of threads blocked in `LegacyHttpClient.Get`.
- 08:35 — Decision: disable currency conversion via configuration flag and restart the API.
- 08:42 — Restart rolled out; API recovers partially, then stalls again because the flag was read only on some code paths.
- 08:46 — Second fix: rates client pointed at a fallback returning "unavailable". Restart.
- 08:50 — API healthy. Total unavailability: 38 minutes (08:12–08:50).
- 10:30 — `rates.acme.example` back to normal latency; conversion re-enabled.

### Impact

- Invoices API and UI unavailable for 38 minutes during month-end.
- The invoicing run was delayed by about an hour; no invoices were lost or duplicated.
- Support received a number of customer calls about the portal being down.

### Root cause

- `Acme.LegacyHttp` performs synchronous, blocking I/O. Under load, each slow call held a thread-pool thread.
- The default timeout of `LegacyHttpClient` was 100 seconds, far longer than any useful response time.
- The list-invoices path treated exchange rates as required, so one slow dependency blocked the whole response.
- The configuration flag to disable conversion was not honored everywhere.

### What went well

- Paging worked; the on-call SRE was on it within minutes.
- Thread dumps pointed straight at the cause.

### What went badly

- The outage happened on the worst possible day.
- We had known for a while that `Acme.LegacyHttp` was synchronous but had not prioritized removing it.
- The first mitigation was incomplete.

### Action items

| Action | Owner | Work item | Status |
|---|---|---|---|
| Move exchange-rate calls to a typed `HttpClient` via `IHttpClientFactory` with explicit timeouts and graceful "unavailable" fallback | Dana Novak | AB#4511 | Done |
| Ban `Acme.LegacyHttp` in new code via BannedApiAnalyzers rule RS0030 (entries in `BannedSymbols.txt`) | Ravi Menon | AB#4512 | Done |
| Remove the last usage of `Acme.LegacyHttp` (`LegacyReportExporter`, calls `reports.acme.example`) | Dana Novak | AB#4590 | Open |
| Load test the list-invoices path with a slow rates stub | Tom Brandt | AB#4513 | Done |

Note: the RS0030 rule flags any new reference. The existing usage in `LegacyReportExporter` is suppressed locally with a comment pointing at AB#4590. Do not copy that suppression elsewhere.

## PM-2025-11: Migration dropped a column with live data

**Date:** 2025-11-18
**Severity:** high (data temporarily missing in production)
**Postmortem lead:** Petra Vogel

### Summary

A migration removed the `Invoice.LegacyReference` column using `DropColumn`. The column was believed to be unused, but it still held data that some customers rely on to match invoices to their own purchase orders. The migration's `Down()` method re-created the column, but empty, so rolling back the migration did not bring the data back. Data was restored from backup after about 3 hours.

### Timeline

- 13:02 — Release promoted to production; migrations applied, including the one dropping `LegacyReference`.
- 13:40 — A customer reports via support that their purchase order references are missing from invoices.
- 13:55 — Billing confirms the column is gone. Sam Okafor rolls the application back.
- 14:05 — The migration's `Down()` is run with DBA present. Column re-created, but empty.
- 14:20 — Petra Vogel starts point-in-time restore of the `Invoice` table to a side database.
- 15:45 — Restore complete. Values copied back into `Invoice.LegacyReference` by invoice id.
- 16:10 — Data verified against a sample of customer invoices. Incident closed.

### Impact

- Purchase order references missing from invoices for about 3 hours.
- Invoices created during the window had no reference; 11 were fixed by hand with customers' help.
- No financial data (amounts, statuses) affected.

### Root cause

- A destructive schema change went through the same path as any other migration, with no extra review.
- "Unused" was checked by searching the code, not by checking data in the column.
- `Down()` was generated and never tested; it restored schema, not data.
- The change was not split into expand/contract steps.

### What went well

- Backups and point-in-time restore worked as designed.
- Rolling the application back was quick.

### What went badly

- Nobody with database ownership saw the migration before it ran.
- We believed `Down()` was a safety net. It isn't, for data.

### Action items

| Action | Owner | Work item | Status |
|---|---|---|---|
| No destructive migration (drop column/table, narrowing type change) without a `// acme:destructive-approved AB#<ticket>` comment in the migration and DBA approval from Petra Vogel | Petra Vogel | AB#4655 | Done |
| CI script `tools/ci/check-migrations.mjs` fails the build when a destructive operation lacks the approval comment | Ravi Menon | AB#4656 | Done |
| `Down()` must be tested for every migration (schema round-trip test in the backend test suite) | Dana Novak | AB#4657 | Done |
| Check column data, not just code references, before declaring a column unused | Dana Novak | AB#4658 | Done |
| Document expand/contract migrations in the wiki | Petra Vogel | AB#4659 | Open |

## Recurring themes

Looking at all three:

- **Conventions that were not enforced failed.** Force-push protection, banned APIs and migration approval are now enforced by tooling, not just written down.
- **Rollback is not the same as recovery.** Restoring the previous code is easy; restoring data or history is not.
- **Month-end is high risk.** See the change freeze in `release-process.md`.

TODO (Sam): add the December 2025 near-miss with the email relay once the write-up is reviewed.
