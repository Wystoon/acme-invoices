import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { InvoiceApiService } from './invoice-api-service';

describe('InvoiceApiService', () => {
  let api: InvoiceApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(InvoiceApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('sends the page, page size and status filter', () => {
    api.list({ status: 'Overdue', page: 2, pageSize: 10 }).subscribe();

    const request = http.expectOne((r) => r.url === '/api/invoices');
    expect(request.request.params.get('page')).toBe('2');
    expect(request.request.params.get('pageSize')).toBe('10');
    expect(request.request.params.get('status')).toBe('Overdue');
    request.flush({ items: [], page: 2, pageSize: 10, totalCount: 0 });
  });

  it('leaves out the status when no filter is set', () => {
    api.list({ page: 1, pageSize: 10 }).subscribe();

    const request = http.expectOne((r) => r.url === '/api/invoices');
    expect(request.request.params.has('status')).toBe(false);
    request.flush({ items: [], page: 1, pageSize: 10, totalCount: 0 });
  });

  it('loads one invoice by id', () => {
    api.get(17).subscribe();

    http.expectOne('/api/invoices/17').flush({});
  });
});
