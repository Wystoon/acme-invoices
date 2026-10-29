import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'invoices' },
  {
    path: 'invoices',
    title: 'Invoices · Acme',
    loadComponent: () => import('./invoices/invoice-list-page').then((m) => m.InvoiceListPage),
  },
  {
    path: 'invoices/:id',
    title: 'Invoice · Acme',
    loadComponent: () => import('./invoices/invoice-detail-page').then((m) => m.InvoiceDetailPage),
  },
  { path: '**', redirectTo: 'invoices' },
];
