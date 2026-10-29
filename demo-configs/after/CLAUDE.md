# Acme Invoices

Invoice service: .NET API in `src/backend`, Angular UI in `src/frontend`.
Work items come from Azure DevOps through the `acme` MCP server. The engineering wiki is in `docs/wiki`; search it with the wiki tools instead of reading whole pages.

## How we work
- Explain decisions in plain language a product owner can follow. Keep answers short.
- When two instructions conflict, choose the safer option and say so.
- If five wiki searches have not answered a question, stop and ask.

## Useful commands
- Backend tests: `dotnet test --solution src/backend`
- Frontend lint: `npm --prefix src/frontend run lint`
- Context for a work item: `.acme/out/<id>/context.md`

Guardrails (branches, secrets, formatting, tests, approvals) are enforced by permissions, hooks and CI, not by this file. See `docs/RULES.md`.
