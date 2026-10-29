---
name: angular-frontend
description: Use when changing anything under src/frontend.
---
# Angular frontend in Acme Invoices

Condensed from the wiki page `angular-style-guide.md`. For details, call
`get_wiki_section` with page `angular-style-guide.md` and the heading you need,
e.g. "Badges and status labels", "Design tokens", "Component test".

## Layout
- One folder per feature: `src/frontend/src/app/<feature>/` (today: `invoices/`)
- Models: `invoice.ts`. API service: `invoice-api-service.ts` (`InvoiceApiService`).
- Pages: `invoice-list-page.ts` + `.html` + `.scss`, class `InvoiceListPage`.
  No `.component` suffix (2025 style guide).
- Design tokens: CSS custom properties in `src/frontend/src/styles.scss`.

## Rules (lint enforces the ones marked *)
- Standalone components only, no NgModules.*
- `changeDetection: ChangeDetectionStrategy.OnPush` on every component.*
- `inject()` instead of constructor injection.*
- Signals for state: `signal`, `computed`, `input()`, `output()`; no `@Input`/`@Output`.*
- No `any`.*
- Selector prefix `acme-` (kebab-case).*
- Load data with `rxResource` and the feature's API service; never call `HttpClient` in a component.
- Built-in control flow: `@if`, `@for` with `track`, `@empty`.
- Never literal colours or sizes in component styles; use the tokens:
  `--acme-color-*`, `--acme-space-1..4`, `--acme-radius`, `--acme-radius-pill`, `--acme-font-size-small`.
- Accessibility: every control has a label, every table an accessible name,
  status is never conveyed by colour alone, errors use `role="alert"`.

## Badges and status labels
- Pill shape: `border-radius: var(--acme-radius-pill)`.
- Overdue: text `var(--acme-color-danger)` on `var(--acme-color-danger-surface)`.
- Visible text plus an accessible label, e.g. `aria-label="Overdue, 12 days"`.

## Commands (from the repository root)
- Lint: `npm --prefix src/frontend run lint`
- Tests (Vitest, headless): `npm --prefix src/frontend test`
- Format: `npm --prefix src/frontend run format`
- Build: `npm --prefix src/frontend run build`

## Tests
- Components and services get a `*.spec.ts` next to them.
- Use `TestBed`, `provideHttpClient()`, `provideHttpClientTesting()` and `HttpTestingController`.
- Zoneless: call `TestBed.tick()` after an input change, then `await fixture.whenStable()`.

## Before you finish
- [ ] Lint, tests and build pass
- [ ] New UI uses tokens and has accessible names
- [ ] No backend change needed for a frontend-only work item
