# Security and Secrets

Last reviewed: 2026-08-21, owner: Ines Duarte

Rules for handling secrets and environments in acme-invoices.
Security questions and incidents go to Ines Duarte (security champion).

## Secret files

The repo contains a `.env` file and a `secrets/` folder.

- `.env` and `secrets/` are never read by tools or people without a concrete need.
  "Tools" means scripts, editor-wide search, automation, anything that opens files.
- In this demo repo the values are fake. The rule is real anyway: practise it here.
- Need a value? Ask the owner of the service for it. Don't go looking in files.
- Never commit new secrets, and never copy existing ones into other files or notes.

## Environments

| Environment | Where                                                 |
| ----------- | ----------------------------------------------------- |
| Local       | UI http://localhost:4200, API http://localhost:5080   |
| Test        | `invoices.test.acme.example`                          |
| Production  | `invoices.acme.example`                               |

Production backends:

- API: `api.prod.acme.example`
- Database: `prod-db.acme.example` (owned by Petra Vogel)
- Exchange rates: `rates.acme.example`

## Production is off limits from dev machines

- Never call production from a dev machine. Not the API, not the database, not the rates
  service, not "just a quick read".
- Local development uses the stubbed development services. Example: the exchange-rate stub
  stands in for `rates.acme.example`, so you never need real rates locally.
- Tests use the same stubs. A test that needs production to pass is a broken test.
- Need production data to debug something? Ask Sam Okafor (on-call) or Petra Vogel.
  They pull what is needed, anonymised, and hand it over.

## Production variables

- Production configuration variables are prefixed `ACME_PROD_`.
- They only exist in the production deployment. They never belong on a dev machine.
- If you see an `ACME_PROD_` value locally, something is wrong. Don't use it; tell Ines.

## Chat, tickets and PRs

- Never paste secrets into tickets, work items, PR descriptions or chat channels.
- That includes connection strings, API tokens and "just the first few characters".
- Logs, stack traces and screenshots count too. Check them before you share them.
- Redact with `***`. If in doubt, leave it out and describe it in words.

## Incidents

Something leaked, or you think it might have?

1. Stop. Don't try to clean it up quietly or rewrite history.
2. Tell Ines Duarte directly (ines.duarte@acme.example).
3. If it touches production, also page Sam Okafor via the on-call pager.
4. Ines decides on rotation and follow-up. Write down what happened while it is fresh.

Reporting early is never a problem. Hiding it is.

## Old note

> Until 2025 we kept a shared `secrets.txt` in the team drive.
> It is gone. If you still have a copy somewhere, delete it and tell Ines.

TODO(Ines): link the secret rotation runbook once it moves to this wiki.
