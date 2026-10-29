# Onboarding: your first week on Billing

Last reviewed: 2026-03-04, owner: Lena Hofer

Welcome to the Billing team. This page gets you from a blank laptop to your first merged pull request. It is long on purpose; skim the headings and come back as you need them. If something here is wrong, fix it in a pull request — that counts as a great first contribution.

## Day 1: accounts and access

Most access is requested through the internal access portal at `access.acme.example`. Your manager (Lena Hofer) pre-approves the standard Billing bundle, so most requests are granted within a few hours.

### What to request

| Access | Where | Notes |
|---|---|---|
| Source repository (read/write) | access portal → "Billing developer" bundle | Includes pull request rights. You cannot push to main — nobody can. |
| Azure DevOps project | access portal → "Billing developer" bundle | Work items at `https://dev.acme.example/acme`. |
| #billing-dev channel | ask anyone on the team to add you | Main place for questions. |
| Test environment logs | access portal → "Log search (test)" | Read-only. |
| Production logs | not in your first month | Requested later via Sam Okafor if your work needs it. |
| Email | issued by IT on day 1 | `firstname.lastname@acme.example` |

You do not get production database access as a developer, and you should not need it. Production is never called from dev machines. If a bug needs production data, ask Petra Vogel for a sanitized extract.

### VPN

The VPN section moved, see the access portal. (The old instructions on this page referred to a client that was replaced in 2025.) You only need the VPN for the test environment; local development works without it.

## Day 1–2: tools

Install the following:

- **.NET 10 SDK** — the exact version is pinned in `global.json` at the repo root. Check with `dotnet --version`.
- **Node 26** — check with `node --version`. Any Node 26.x works; a version manager is recommended but not required.
- **Git** — recent version. Set your name and `@acme.example` email in your Git config.
- **VS Code** — our recommended editor. Accept the recommended extensions when you open the repo (C#, Angular language service, ESLint, Prettier).

Formatting is automated: CSharpier for C#, Prettier for TypeScript/HTML/SCSS, ESLint for lint rules. You do not need to configure anything beyond what `dotnet tool restore` and `npm ci` install.

## Day 2: clone and set up

Clone the repository from the URL shown in Azure DevOps, then from the repo root:

```sh
dotnet tool restore
npm --prefix src/frontend ci
```

`dotnet tool restore` installs repo-local tools (CSharpier, EF Core tools). `npm --prefix src/frontend ci` installs frontend dependencies exactly as locked.

A few things to know about the repo:

- `.env` files and the `secrets/` folder are not needed for local development. Don't read them unless you have a concrete reason, and never paste their contents anywhere.
- Local development uses SQLite. The database file is created on first run.
- The exchange-rate service is stubbed in Development and the email sender only logs, so you can work fully offline.

## Day 2: run the app

### API

```sh
dotnet run --project src/backend/Acme.Invoices.Api --launch-profile http
```

The API listens on http://localhost:5080. The OpenAPI document is available in Development.

### UI

In a second terminal:

```sh
npm --prefix src/frontend start
```

The UI runs on http://localhost:4200 and proxies `/api` to the API on port 5080. Start the API first.

### Run the tests

Backend (run exactly this form from the repo root):

```sh
dotnet test --solution src/backend
```

Frontend:

```sh
npm --prefix src/frontend test
```

Backend tests are xUnit; frontend tests are Vitest. Both must be green before you open a pull request. "Green" here means no failing tests and no build warnings — the pipeline treats warnings as errors.

## Who's who

| Person | Role | Ask them about |
|---|---|---|
| Lena Hofer | Engineering manager | Priorities, people stuff, freeze exceptions |
| Mira Castell | Product owner, Billing | What we build and why, acceptance criteria |
| Dana Novak | Backend developer, Billing | The API, EF Core, architecture questions |
| Jonas Eklund | Frontend developer | The Angular UI, frontend tooling |
| Tom Brandt | QA engineer | Test plans, regression checklist, release sign-off |
| Ravi Menon | Dev Platform team lead | CI pipeline, Git hooks, repo configuration (`@acme/dev-platform`) |
| Sam Okafor | SRE, on-call | Deployments, production incidents, logs |
| Ines Duarte | Security champion | Anything involving secrets, auth, new external calls |
| Petra Vogel | Database owner / DBA | Migrations, production data, backups |

Your onboarding buddy is assigned by Lena on day 1 — usually Dana or Jonas.

## Team rituals

### Stand-up

Daily at 09:30, 15 minutes, on the team video bridge. Three things: what you finished, what you're on, what's blocking you. Detailed discussions move to after stand-up.

### Refinement

Tuesdays, one hour, every week. Mira brings the top of the backlog; we clarify acceptance criteria, split items that are too big and estimate. New joiners are expected to listen for the first two sessions and ask questions — questions from fresh eyes are genuinely useful.

### Sprint demo

At sprint end (every second Thursday), before the release train. Each person shows what they finished, on the test environment. Keep it short and show the real thing, not slides.

### Retro

After the demo, 45 minutes. Lena facilitates. (We used to do retro on Fridays; that changed in 2025 but some calendar invites may still say Friday.)

## Your first ticket

Lena or your buddy will pick a small item tagged `good-first-item` in Azure DevOps. Here is the whole loop, end to end.

### 1. Read the work item

Read the description and acceptance criteria. If anything is unclear, ask Mira in the work item comments or in #billing-dev. Move the item to "Active".

### 2. Create a branch

Branches are named after the work item:

- `feature/<id>-<slug>` for features and tasks, e.g. `feature/4810-invoice-due-date-filter`
- `bugfix/<id>-<slug>` for bugs, e.g. `bugfix/4822-reminder-timezone`

```sh
git switch main
git pull
git switch -c feature/4810-invoice-due-date-filter
```

### 3. Make the change

Keep it small. Add or update tests for what you changed. Run the formatter and both test suites locally.

### 4. Commit

Commit messages start with the work item id:

```
AB#4810: Add due date filter to invoice list
```

The `AB#` prefix links the commit to the work item and is how release notes are generated. A commit hook checks the format; if it rejects your message, fix the message rather than bypassing the hook.

### 5. Push and open a pull request

Push your branch and open a pull request against main. Never push directly to main, and never force-push — not to main, and not to a branch someone else is working on. (If you rebased your own branch and need to update the pull request, ask your buddy first; see `git-workflow.md`.) The server rejects pushes to main and non-fast-forward pushes anyway; see PM-2025-03 in `postmortems-2025.md` for the story.

In the pull request description, link the work item and describe how you tested.

### 6. Review and merge

At least one approval and a green pipeline are required. Respond to comments, push follow-up commits, and once approved, complete the merge. The change deploys to test automatically. Check it there, then move the work item to "Resolved" for Tom.

## Where to ask questions

- **#billing-dev** — the default. Ask in the channel rather than in direct messages so others can learn from the answer.
- **Your buddy** — for anything you'd rather not ask in the channel.
- **Pipeline or hook problems** — tag `@acme/dev-platform` in #billing-dev.
- **Security questions** — Ines Duarte. If you think a secret leaked, tell her immediately; no blame.
- **Production issues** — page the on-call SRE via the on-call pager. Don't try to fix production yourself.

There are no stupid questions in your first month. Or after.

## FAQ

### The API fails to start with a database error

Delete the local SQLite file under `data/` and start again; it is recreated with migrations applied. If that does not help, check you are on the pinned .NET SDK version.

### `npm ci` fails

Check `node --version` reports 26.x. Delete `src/frontend/node_modules` and retry. If it still fails, post the error in #billing-dev.

### Exchange rates look wrong locally

They are stubbed in Development with fixed values. That's expected. Don't point your local API at `rates.acme.example` with real credentials.

### I didn't get the reminder email

In Development the email sender only logs. Look at the API console output.

### Can I push a tiny fix straight to main?

No. Every change goes through a pull request from a `feature/` or `bugfix/` branch, however small.

### I accidentally committed something from `secrets/` or a `.env` file

Don't try to rewrite history and force-push. Tell Ines Duarte right away; she'll rotate the secret and Ravi will help clean up.

### Where is the architecture documented?

See `architecture-overview.md`. For releases, see `release-process.md`.

### Where's the old setup script (`setup-dev.ps1`)?

Removed in 2025. The two commands under "Clone and set up" replace it. TODO (Jonas): delete the leftover reference in the README.

## End of week one checklist

- [ ] All access from the table above granted
- [ ] API and UI run locally
- [ ] Both test suites pass locally
- [ ] Attended stand-up, refinement and (if it falls in your first week) demo
- [ ] First pull request opened
- [ ] Read `architecture-overview.md`, `release-process.md` and `postmortems-2025.md`
