# Release process

Last reviewed: 2026-01-12, owner: Sam Okafor

How changes get from a merged pull request into production. Short version: main is always releasable, test is deployed automatically, production is promoted by hand every two weeks.

## Release trains

We release on a two-week train that matches the sprint. The release happens at sprint end, normally on the last Thursday of the sprint, after the demo.

- Whatever is on main and signed off by QA at that point goes out.
- Work that is not ready stays behind a feature flag or simply isn't merged yet. We do not hold the train for a single item.
- Out-of-train releases are only for hotfixes (see below).

### No release branches

We are trunk-based. There is no `release/*` branch and we do not cut one "just this once". Main is always releasable, which means:

- Every change reaches main through a pull request with a green pipeline and at least one approval.
- No direct pushes to main, and no force-push to any shared branch. The server rejects both.
- Half-finished features are merged behind a flag, not left on a long-lived branch.

(Older pages still mention `release/2024.x` branches. Those were deleted when we moved to trunk-based in 2024; ignore any instructions that reference them.)

## Pipeline stages

### Merge to main → test (automatic)

After a pull request is merged, the pipeline builds the API and UI, runs the full backend and frontend test suites, checks migrations, and deploys to the test environment (`invoices.test.acme.example` / `api.test.acme.example`). This takes about 15 minutes. If the deploy fails, the pipeline posts in #billing-dev and the author of the merge is expected to look first.

### QA sign-off

Tom Brandt runs the regression checklist on test before each train. He marks the release candidate (the pipeline run id) as signed off in the release work item. Nothing goes to production without his sign-off. If Tom is out, Mira Castell nominates a stand-in and writes the name in the release work item.

### Promotion to production (manual)

The on-call SRE — currently Sam Okafor — promotes the signed-off build to production (`invoices.acme.example` / `api.prod.acme.example`). Promotion:

1. Confirm QA sign-off is recorded for exactly this pipeline run.
2. Check the change-freeze calendar (see below).
3. Apply database migrations against `prod-db.acme.example` from the pipeline. Never from a laptop.
4. Deploy the API, then the UI.
5. Watch the dashboards and the log search for 30 minutes. Error rate and p95 latency should stay flat.
6. Post "released" with the release notes link in #billing-dev.

Developers never deploy to production themselves and never call production from dev machines.

## Change freeze around month-end

Month-end invoicing runs are the most important days of the month for the business. We freeze production changes from the second-to-last working day of the month until the second working day of the next month.

- No train promotions during the freeze. If sprint end falls inside it, the train moves to the first day after.
- Hotfixes during the freeze need approval from Lena Hofer and the on-call SRE.
- Migrations are never run during the freeze, hotfix or not.

TODO (Sam): publish the freeze calendar for 2026 H2 on this page instead of only in the release work item.

## Release notes

Release notes are generated from the `AB#` links in commit messages between the previous production tag and the new one. That is one more reason commit messages must start with `AB#<id>: <summary>` — a commit without an id simply does not show up in the notes.

The generator groups items by work item type (feature, bug, task) and pulls titles from Azure DevOps (`https://dev.acme.example/acme`). Mira Castell reviews the generated notes and edits the customer-facing wording before they are shared outside the team.

## Rollback

If something is wrong after promotion:

1. Decide quickly. If error rate or latency is clearly worse and the cause isn't obvious within 10 minutes, roll back.
2. Re-run the promotion step of the previous production pipeline run. This redeploys the previous API and UI builds.
3. Migrations are not rolled back automatically. Our migrations are expected to be backward-compatible with the previous release (expand/contract), so the old code runs against the new schema. If a migration is the problem, page Petra Vogel before touching the database.
4. Post in #billing-dev with what was rolled back and why, and open a bug work item.
5. If customers were affected, the on-call SRE starts a postmortem (see `postmortems-2025.md` for examples).

Note: `Down()` migrations exist and must be tested, but we do not run them in production as a rollback mechanism except with DBA approval. See PM-2025-11 for why.

## Hotfix flow

A hotfix is any change that needs to reach production before the next train.

1. Create a bug work item if there isn't one.
2. Branch from main: `bugfix/<id>-<slug>`, for example `bugfix/4721-reminder-timezone`.
3. Commit with `AB#<id>: <summary>`.
4. Open a pull request against main. Same rules as always: green pipeline, one approval. Never push directly to main, not even for a one-line fix, and never force-push.
5. After merge, the change goes to test automatically. Tom (or the stand-in) does a focused check of the fix.
6. The on-call SRE promotes that pipeline run to production. Because main is always releasable, everything else merged since the last train goes along with it — check the diff before promoting, and talk to the owners of anything surprising.

## Contacts

- Release promotion, rollback: Sam Okafor (on-call pager)
- QA sign-off: Tom Brandt
- Release notes wording: Mira Castell
- Pipeline problems: Ravi Menon / `@acme/dev-platform`
- Freeze exceptions: Lena Hofer
