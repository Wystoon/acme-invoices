# Pull Requests

Last reviewed: 2026-05-07, owner: Lena Hofer

Every change to acme-invoices goes through a pull request into main.
Branch names and commit message rules are in `git-workflow.md`.

## Basics

- The target branch is always `main`.
- Every PR links its work item as `AB#<id>` (e.g. `AB#4821`), in the title and the template.
- One approval is required before merge. Authors don't approve their own PRs.
- CI must be green: build, backend tests, frontend tests and lint. No exceptions.
- Keep PRs small: one work item, one PR, reviewable in about 20 minutes. Split bigger work.

## Template

Use the template in `docs/templates/pull_request.md`. It has five headings. Keep all of
them, in this order, even when a section is only one line:

```markdown
## Summary
## Work item
## Changes
## Test evidence
## Risk
```

### Summary

One or two sentences: what changes for the user or the system, and why.

### Work item

The link as `AB#<id>`. Azure DevOps turns it into a link to the work item automatically.

### Changes

A short list of what changed, grouped by area (Api, Domain, Infrastructure, frontend).

### Test evidence

The test command you ran and its result counts. "Tested locally" is not test evidence.

```text
dotnet test --solution src/backend      -> Passed: 142, Failed: 0, Skipped: 0
npm --prefix src/frontend test          -> Tests: 87 passed, 0 failed
```

Run both if you touched both sides. Manual checks, such as a keyboard-only walkthrough of
a new page, go in as extra bullets below the counts.

### Risk

One of `low`, `medium` or `high`, plus one line explaining why.

- `low`: small, well tested, easy to revert.
- `medium`: touches money, dates, or code shared across features.
- `high`: data migrations, auth, or anything Petra Vogel or Ines Duarte should look at.

## Example

```markdown
## Summary
Add a CSV export for the invoice list so finance can reconcile offline.

## Work item
AB#4821

## Changes
- Api: new `GET /api/invoices/export` endpoint
- Frontend: export button on the invoice list page

## Test evidence
- `dotnet test --solution src/backend`: 145 passed, 0 failed
- `npm --prefix src/frontend test`: 89 passed, 0 failed

## Risk
low - read-only endpoint, behind the existing invoice permissions
```

## Reviewing

- Reviewers check that the template is complete before reading any code.
- Missing test evidence or a missing `AB#` link means "request changes", no discussion.
- Questions go in PR comments, not in chat, so the answer stays with the change.
- Tom Brandt (QA) is added as an optional reviewer on anything user-facing.

TODO(Lena): add review turnaround expectations (we said "same day" in the retro).
