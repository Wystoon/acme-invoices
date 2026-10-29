# Git Workflow

Last reviewed: 2026-03-18, owner: Ravi Menon

How we branch, commit and push in the acme-invoices repo. The short version: branch from an
up-to-date main, commit with an `AB#<id>` prefix, push your branch, open a PR. Nothing else.

## Branch names

Every branch belongs to a work item in Azure DevOps (`https://dev.acme.example/acme`).

- Features: `feature/<id>-<slug>`, e.g. `feature/4821-export-invoices-csv`
- Bug fixes: `bugfix/<id>-<slug>`, e.g. `bugfix/4703-overdue-days-off-by-one`

The `<id>` is the work item number. The slug is short, lowercase and kebab-case, describing
the change. No personal names, no dates, no `test-2` or `final-final`.

## Starting work

Always branch from an up-to-date main, never from a stale local copy:

```bash
git switch main
git pull
git switch -c feature/4821-export-invoices-csv
```

Don't branch from someone else's feature branch unless you both agreed on it up front.

## Commit messages

Format: `AB#<id>: <summary>`

- Imperative mood: "Add CSV export", not "Added CSV export" or "Adds CSV export".
- Keep the summary under ~72 characters. Details go in the body, after a blank line.
- The `AB#<id>` prefix links the commit to the work item in Azure DevOps automatically.

Good:

```text
AB#4821: Add CSV export endpoint for invoices
AB#4703: Fix overdue day count at month boundary
```

Bad: `fixed stuff`, `WIP`, `AB#4821 added export` (no colon, past tense).

## Pushing

First push of a new branch sets the upstream:

```bash
git push -u origin feature/4821-export-invoices-csv
```

After that, a plain `git push` is enough. Then open a PR as described in `pull-requests.md`.

## Hard rules

- Never push directly to main. Every change goes through a PR, including one-line fixes.
- Never force-push. Not to main, not to shared branches, not to your own branch "just this
  once". The 2025 force-push incident is PM-2025-03 in `postmortems-2025.md`; read it once.
- If your branch is behind main, merge main into it and push normally.

The server enforces this anyway: pushes to main are rejected, and non-fast-forward pushes
(which is what a force-push is) are rejected too. If a push is rejected, don't look for a
workaround. Ask in the #billing-dev channel or ping Ravi Menon.

## Keeping up to date

```bash
git switch main
git pull
git switch feature/4821-export-invoices-csv
git merge main
```

Note: older pages still say "rebase on main before opening a PR". That needed a force-push
and is no longer allowed. Merge instead; the history is fine.

## After merge

- Delete your branch (the PR page has a button for it).
- Switch back to main and pull before starting the next work item.

TODO(Ravi): document the local hooks that check branch names and commit message format.
