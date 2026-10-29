import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { InvoiceSummary, Page } from './invoice';
import { InvoiceListPage } from './invoice-list-page';

const invoice = (id: number, overrides: Partial<InvoiceSummary> = {}): InvoiceSummary => ({
  id,
  number: `INV-2026-${String(id).padStart(4, '0')}`,
  customerName: 'Bluefen Bakery',
  issueDate: '2026-09-14',
  dueDate: '2026-10-14',
  currency: 'EUR',
  total: 950,
  status: 'Sent',
  daysOverdue: 0,
  ...overrides,
});

const page = (items: InvoiceSummary[], totalCount = items.length): Page<InvoiceSummary> => ({
  items,
  page: 1,
  pageSize: 10,
  totalCount,
});

describe('InvoiceListPage', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [InvoiceListPage],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('renders one row per invoice with a link to its detail page', async () => {
    const fixture = TestBed.createComponent(InvoiceListPage);
    TestBed.tick();

    http
      .expectOne((r) => r.url === '/api/invoices' && r.params.get('page') === '1')
      .flush(page([invoice(40), invoice(39, { status: 'Paid' })], 40));
    await fixture.whenStable();

    const element: HTMLElement = fixture.nativeElement;
    const rows = element.querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);
    expect(rows[0].querySelector('a')?.getAttribute('href')).toBe('/invoices/40');
    expect(element.querySelector('.pager')?.textContent).toContain('Page 1 of 4');
  });

  it('asks for the first page of the chosen status when the filter changes', async () => {
    const fixture = TestBed.createComponent(InvoiceListPage);
    TestBed.tick();
    http.expectOne((r) => r.url === '/api/invoices').flush(page([invoice(40)], 40));
    await fixture.whenStable();

    const select: HTMLSelectElement = fixture.nativeElement.querySelector('#status-filter');
    select.value = 'Overdue';
    select.dispatchEvent(new Event('change'));
    TestBed.tick();

    const request = http.expectOne((r) => r.url === '/api/invoices');
    expect(request.request.params.get('status')).toBe('Overdue');
    expect(request.request.params.get('page')).toBe('1');
    request.flush(page([]));
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('No invoices match this filter.');
  });
});
