import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { InvoiceDetail, InvoiceQuery, InvoiceSummary, Page } from './invoice';

@Injectable({ providedIn: 'root' })
export class InvoiceApiService {
  private readonly http = inject(HttpClient);

  list(query: InvoiceQuery): Observable<Page<InvoiceSummary>> {
    let params = new HttpParams().set('page', query.page).set('pageSize', query.pageSize);
    if (query.status) {
      params = params.set('status', query.status);
    }
    return this.http.get<Page<InvoiceSummary>>('/api/invoices', { params });
  }

  get(id: number): Observable<InvoiceDetail> {
    return this.http.get<InvoiceDetail>(`/api/invoices/${id}`);
  }
}
