# Angular Style Guide (src/frontend)

Last reviewed: 2026-09-14, owner: Jonas Eklund

How we write Angular code in `src/frontend`.
The app runs on Angular 22: standalone, signals, zoneless, OnPush.

If this page contradicts the linter, the linter wins.
Tell Jonas so the page gets fixed. Questions go to the #billing-dev channel.

---

## Commands

Run from the repo root.

| What   | Command                                |
| ------ | -------------------------------------- |
| Test   | `npm --prefix src/frontend test`       |
| Lint   | `npm --prefix src/frontend run lint`   |
| Format | `npm --prefix src/frontend run format` |

Local dev:

- UI: http://localhost:4200
- API: http://localhost:5080
- `/api` is proxied from the UI dev server to the API.

---

## Components

### Standalone only

Every component, directive and pipe is standalone.
No NgModules. There is no `AppModule`.
Standalone is the default in Angular 22, so don't write `standalone: true`.

```ts
@Component({
  selector: 'acme-invoice-list-page',
  imports: [InvoiceStatusBadge, CurrencyPipe],
  templateUrl: './invoice-list-page.html',
  styleUrl: './invoice-list-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InvoiceListPage {}
```

### OnPush everywhere

Every component sets `changeDetection: ChangeDetectionStrategy.OnPush`.
Lint enforces it. A PR without it will not pass CI.

The app is zoneless. Change detection is driven by signals.
If you mutate a plain field and expect the view to update, it won't.
Put the value in a signal.

### Selectors

- Components: prefix `acme-`, kebab-case, e.g. `acme-invoice-list-page`.
- Directives: prefix `acme`, camelCase, e.g. `acmeAutofocus`.

Both are enforced by angular-eslint.

Do:

```ts
selector: 'acme-invoice-status-badge'
selector: '[acmeAutofocus]'
```

Don't:

```ts
selector: 'app-invoice-badge' // wrong prefix
selector: 'acmeInvoiceBadge' // components are kebab-case
```

Inline `template` is fine for tiny components. No `::ng-deep`.

---

## File naming and folder layout

We follow the 2025 Angular style guide: no type suffix, no `.component.ts`.

### File names

| Thing     | File                        | Class                |
| --------- | --------------------------- | -------------------- |
| Page      | `invoice-list-page.ts`      | `InvoiceListPage`    |
| Template  | `invoice-list-page.html`    | -                    |
| Styles    | `invoice-list-page.scss`    | -                    |
| Component | `invoice-status-badge.ts`   | `InvoiceStatusBadge` |
| Service   | `invoice-api-service.ts`    | `InvoiceApiService`  |
| Model     | `invoice.ts`                | `Invoice`            |
| Test      | `invoice-list-page.spec.ts` | -                    |

- File names are kebab-case.
- The class name is the PascalCase file name.
- `page` or `service` is part of the name, not a dotted suffix.
- Tests sit next to the file they test.

Don't: `invoice-list.component.ts`, `invoice-api.service.ts`.

### Folder layout

Group by feature, not by type.

```text
src/frontend/src/
  styles.scss
  app/
    app.config.ts
    app.routes.ts
    invoices/
      invoice.ts
      invoice-api-service.ts
      invoice-list-page.ts
      invoice-list-page.html
      invoice-list-page.scss
      invoice-detail-page.ts
      invoice-status-badge.ts
    shared/
```

- A feature lives in `src/app/<feature>/`, e.g. `src/app/invoices/`.
- Models live in `<feature>/<name>.ts`, e.g. `invoices/invoice.ts`.
- No `components/`, `services/` or `models/` subfolders.
- `shared/` is for things used by two or more features.

TODO(Jonas): decide whether `shared/` should split into `ui/` and `util/`.

---

## Signals and state

### Local state

`signal` for writable state, `computed` for derived state.

```ts
export class InvoiceListPage {
  protected readonly search = signal('');
  protected readonly invoices = signal<Invoice[]>([]);

  protected readonly filtered = computed(() => {
    const term = this.search().toLowerCase();
    return this.invoices().filter((i) => i.customerName.toLowerCase().includes(term));
  });
}
```

- Mark signals `readonly`. You update the value, not the field.
- `protected` for members only the template reads.
- Use `.set()` / `.update()`.

### Inputs and outputs

`input()` and `input.required()` for inputs, `output()` for outputs.
No `@Input` / `@Output` decorators, no `new EventEmitter()`.

```ts
export class InvoiceRow {
  readonly invoice = input.required<Invoice>();
  readonly compact = input(false);
  readonly selected = output<string>();

  protected select(): void {
    this.selected.emit(this.invoice().id);
  }
}
```

Don't:

```ts
@Input() invoice!: Invoice;
@Output() selected = new EventEmitter<string>();
```

`effect()` is only for side effects that leave Angular (focus, `localStorage`).
Never use it to copy one signal into another. That is `computed()`.

---

## Dependency injection

Use `inject()`. No constructor injection.

Do:

```ts
private readonly api = inject(InvoiceApiService);
```

Don't:

```ts
constructor(private api: InvoiceApiService) {}
```

- Services are `@Injectable({ providedIn: 'root' })` unless they hold page state.
- App-wide providers live in `app.config.ts`.

---

## Data loading

### API services

Each feature has one API service wrapping `HttpClient`.
Components never call `HttpClient` directly.

```ts
@Injectable({ providedIn: 'root' })
export class InvoiceApiService {
  private readonly http = inject(HttpClient);

  list(status?: InvoiceStatus): Observable<Invoice[]> {
    const params = status ? { status } : undefined;
    return this.http.get<Invoice[]>('/api/invoices', { params });
  }
}
```

- Return typed observables. No `Observable<any>`.
- No subscribing inside the service.
- Keep URLs relative (`/api/...`).

### Resources

Load data in components with `rxResource`, or `httpResource` for a plain GET.

```ts
export class InvoiceListPage {
  private readonly api = inject(InvoiceApiService);
  protected readonly status = signal<InvoiceStatus | undefined>(undefined);

  protected readonly invoices = rxResource({
    params: () => ({ status: this.status() }),
    stream: ({ params }) => this.api.list(params.status),
  });
}
```

When `status` changes, the resource reloads. No manual `subscribe`.

```ts
protected readonly invoice = httpResource<Invoice>(() => `/api/invoices/${this.id()}`);
```

### Loading, error, empty

```html
@if (invoices.isLoading()) {
  <p>Loading invoices…</p>
} @else if (invoices.error()) {
  <p role="alert">Could not load invoices. Try again.</p>
} @else {
  <acme-invoice-table [invoices]="invoices.value() ?? []" />
}
```

Always handle all three states. Tom Brandt (QA) will test them.

---

## Templates

### Control flow

Use `@if`, `@for`, `@empty`, `@switch`. No `*ngIf` / `*ngFor`.

```html
<ul>
  @for (invoice of invoices(); track invoice.id) {
    <li>{{ invoice.number }} – {{ invoice.customerName }}</li>
  } @empty {
    <li>No invoices match your filter.</li>
  }
</ul>
```

- `@for` always has `track`. Track a stable id, not `$index`.
- Add `@empty` whenever a list can be empty.
- `[class.foo]`, not `ngClass`. Complex expressions move to `computed()`.

---

## TypeScript

### No `any`

`@typescript-eslint/no-explicit-any` is an error in our lint config.

- Use real types or `unknown`, narrowed with type guards.
- Don't silence it with `eslint-disable`. Reviewers will reject it.

### Models

```ts
// src/app/invoices/invoice.ts
export type InvoiceStatus = 'Draft' | 'Sent' | 'Paid' | 'Overdue';

export interface Invoice {
  readonly id: string;
  readonly number: string;
  readonly customerName: string;
  readonly status: InvoiceStatus;
  readonly total: number;
  readonly dueDate: string;
}
```

- Models mirror the API response. No UI-only fields.
- String literal unions over `enum`.
- Dates arrive as ISO strings; format with `DatePipe`.

Money is rounded by the API. No money arithmetic in the frontend. Display only.

---

## Routing

### Lazy-loaded pages

Every page is lazy-loaded with `loadComponent`.

```ts
export const routes: Routes = [
  {
    path: 'invoices',
    loadComponent: () =>
      import('./invoices/invoice-list-page').then((m) => m.InvoiceListPage),
  },
  {
    path: 'invoices/:id',
    loadComponent: () =>
      import('./invoices/invoice-detail-page').then((m) => m.InvoiceDetailPage),
  },
];
```

### Route params as inputs

`withComponentInputBinding()` is on, so route params bind to inputs.

```ts
provideRouter(routes, withComponentInputBinding()),
```

```ts
export class InvoiceDetailPage {
  readonly id = input.required<string>();
}
```

Don't inject `ActivatedRoute` just to read a param.

---

## Accessibility

We target WCAG AA. It is a release requirement.

### Rules

- Every form control has a label. A placeholder is not a label.
- Every table has an accessible name (`<caption>` or `aria-label`).
- Status is never shown by colour alone. Always include text.
- Focus is always visible. Don't remove `outline` without a replacement.
- Everything is keyboard reachable. Use real `<button>` / `<a>`, no clickable `<div>`.
- Errors use `role="alert"`.
- Contrast meets WCAG AA (4.5:1 normal text, 3:1 large text and UI).

### Examples

Do:

```html
<label for="invoice-search">Search invoices</label>
<input id="invoice-search" type="search" />

<table>
  <caption>Invoices</caption>
</table>

<p role="alert">Could not save the invoice. Check the due date.</p>
```

Don't:

```html
<input placeholder="Search" />
<div (click)="open()">Open</div>
<span class="red-dot"></span>
```

The global focus style lives in `src/styles.scss`. Don't override it per component.

TODO: add an automated a11y check to CI. Until then, test keyboard-only by hand.

---

## Design tokens

Colours, spacing and radii come from CSS custom properties in `src/styles.scss`.
Never write literal colours (`#c00`, `red`, `rgb(...)`) in component styles.

### Token list

| Token                         | Use                                |
| ----------------------------- | ---------------------------------- |
| `--acme-color-text`           | Default text                       |
| `--acme-color-muted`          | Secondary text, hints              |
| `--acme-color-surface`        | Card and page backgrounds          |
| `--acme-color-border`         | Borders, dividers                  |
| `--acme-color-primary`        | Links, primary buttons, focus ring |
| `--acme-color-success`        | Paid / success                     |
| `--acme-color-danger`         | Errors, overdue text               |
| `--acme-color-danger-surface` | Background behind danger text      |
| `--acme-space-1` .. `-4`      | Spacing, smallest to largest       |
| `--acme-radius`               | Cards, inputs, buttons             |
| `--acme-radius-pill`          | Badges and pills                   |
| `--acme-font-size-small`      | Badges, captions                   |

### Usage

Do:

```scss
.card {
  padding: var(--acme-space-3);
  border: 1px solid var(--acme-color-border);
  border-radius: var(--acme-radius);
  color: var(--acme-color-text);
}
```

Don't:

```scss
.card {
  padding: 12px;
  border: 1px solid #ddd;
  color: #333;
}
```

Need a new token? Ask in #billing-dev first.
New tokens go into `src/styles.scss` and the design library together.

### Badges and status labels

Use the shared `acme-invoice-status-badge`. Don't hand-roll badges per page.

- Pill shape: `border-radius: var(--acme-radius-pill)`.
- Small text: `font-size: var(--acme-font-size-small)`.
- Overdue: `--acme-color-danger` text on `--acme-color-danger-surface`.
- Paid: `--acme-color-success`.
- Always show text. Colour is a hint, never the only signal.
- Accessible label with the full meaning, e.g. "Overdue, 12 days".

```ts
@Component({
  selector: 'acme-invoice-status-badge',
  template: `
    <span class="badge" [class.badge--overdue]="isOverdue()" [attr.aria-label]="label()">
      {{ status() }}
    </span>
  `,
  styleUrl: './invoice-status-badge.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InvoiceStatusBadge {
  readonly status = input.required<InvoiceStatus>();
  readonly daysOverdue = input(0);

  protected readonly isOverdue = computed(() => this.status() === 'Overdue');
  protected readonly label = computed(() =>
    this.isOverdue() ? `Overdue, ${this.daysOverdue()} days` : this.status(),
  );
}
```

```scss
.badge {
  padding: 0 var(--acme-space-2);
  border-radius: var(--acme-radius-pill);
  font-size: var(--acme-font-size-small);
}

.badge--overdue {
  color: var(--acme-color-danger);
  background: var(--acme-color-danger-surface);
}
```

---

## Testing

Vitest with Angular `TestBed`.

```bash
npm --prefix src/frontend test
```

### Service test with HttpTestingController

```ts
describe('InvoiceApiService', () => {
  let service: InvoiceApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(InvoiceApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('requests overdue invoices', () => {
    service.list('Overdue').subscribe();
    const req = http.expectOne('/api/invoices?status=Overdue');
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });
});
```

### Component test

```ts
it('labels overdue badges', async () => {
  const fixture = TestBed.createComponent(InvoiceStatusBadge);
  fixture.componentRef.setInput('status', 'Overdue');
  fixture.componentRef.setInput('daysOverdue', 12);
  await fixture.whenStable();

  const badge = fixture.nativeElement.querySelector('.badge');
  expect(badge.getAttribute('aria-label')).toBe('Overdue, 12 days');
});
```

Test loading, error, empty and happy states for every page.
Use `setInput` for signal inputs and `await fixture.whenStable()` (zoneless).

---

## Lint and format

```bash
npm --prefix src/frontend run lint
npm --prefix src/frontend run format
```

ESLint with angular-eslint; Prettier for formatting.
Don't argue about formatting in reviews. Run the formatter.

CI runs lint, tests and the production build. All must be green.

---

## PR checklist (frontend)

- [ ] Standalone component with `ChangeDetectionStrategy.OnPush`.
- [ ] `input()` / `output()`, no decorators; `inject()` for dependencies.
- [ ] Selector prefix `acme-` (component) or `acme` (directive).
- [ ] File names without `.component`.
- [ ] Data via API service + `rxResource` / `httpResource`.
- [ ] Loading, error and empty states handled.
- [ ] `@for` has `track` and `@empty`.
- [ ] No `any`.
- [ ] New pages lazy-loaded with `loadComponent`.
- [ ] Controls labelled, tables named, status not colour-only.
- [ ] Keyboard-only walkthrough done.
- [ ] Only design tokens in styles.
- [ ] Test, lint and format commands run; counts pasted.

General PR rules: `pull-requests.md`.

---

## Outdated: NgModule era notes (2023)

> Kept for history. Do not follow this for new code.
> TODO(Jonas): delete once nobody asks about it anymore.

In 2023 the app had an `AppModule`, a `SharedModule` and one module per feature.

- Components were declared in module `declarations`.
- Routes used `loadChildren` with `invoices.module.ts`.
- `@Input()` / `@Output()` with `EventEmitter`.
- Default change detection with zone.js.
- Files named `invoice-list.component.ts`, `invoice.service.ts`.
- `*ngIf`, `*ngFor` with `trackBy`.
- `subscribe` in `ngOnInit` with `takeUntil(this.destroy$)`.
- Tests on Karma and Jasmine.

Leftovers of this style: convert them when you touch the file.
Don't open style-only PRs without a work item.

---

## Related pages

`coding-standards.md`, `pull-requests.md`, `git-workflow.md`, `security-and-secrets.md`.
