import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input, numberAttribute } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { InvoiceApiService } from './invoice-api-service';

@Component({
  selector: 'acme-invoice-detail-page',
  imports: [CurrencyPipe, DecimalPipe, RouterLink],
  templateUrl: './invoice-detail-page.html',
  styleUrl: './invoice-detail-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InvoiceDetailPage {
  private readonly api = inject(InvoiceApiService);

  /** Bound from the `:id` route parameter. */
  readonly id = input.required({ transform: numberAttribute });

  protected readonly invoice = rxResource({
    params: () => this.id(),
    stream: ({ params: id }) => this.api.get(id),
  });
}
