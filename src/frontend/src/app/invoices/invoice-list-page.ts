import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { INVOICE_STATUSES, InvoiceStatus } from './invoice';
import { InvoiceApiService } from './invoice-api-service';

@Component({
  selector: 'acme-invoice-list-page',
  imports: [CurrencyPipe, RouterLink],
  templateUrl: './invoice-list-page.html',
  styleUrl: './invoice-list-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InvoiceListPage {
  private readonly api = inject(InvoiceApiService);

  protected readonly statuses = INVOICE_STATUSES;
  protected readonly pageSize = 10;
  protected readonly status = signal<InvoiceStatus | undefined>(undefined);
  protected readonly page = signal(1);

  protected readonly invoices = rxResource({
    params: () => ({ status: this.status(), page: this.page(), pageSize: this.pageSize }),
    stream: ({ params }) => this.api.list(params),
  });

  protected readonly pageCount = computed(() => {
    const result = this.invoices.value();
    return result ? Math.max(1, Math.ceil(result.totalCount / result.pageSize)) : 1;
  });

  /** Accessible name of the table, so screen readers announce the current page. */
  protected readonly caption = computed(
    () => `Invoices, page ${this.page()} of ${this.pageCount()}`,
  );

  protected selectStatus(value: string): void {
    this.status.set(INVOICE_STATUSES.find((status) => status === value));
    this.page.set(1);
  }

  protected goToPage(page: number): void {
    this.page.set(page);
  }
}
