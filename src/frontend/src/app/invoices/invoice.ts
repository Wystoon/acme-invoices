/** Shapes of the Acme Invoices API responses (src/backend/Acme.Invoices.Api). */

export const INVOICE_STATUSES = ['Draft', 'Sent', 'Paid', 'Overdue', 'Cancelled'] as const;

export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
}

export interface InvoiceSummary {
  id: number;
  number: string;
  customerName: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  total: number;
  status: InvoiceStatus;
  daysOverdue: number;
}

export interface Customer {
  id: number;
  name: string;
  email: string;
}

export interface InvoiceLine {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface InvoiceDetail {
  id: number;
  number: string;
  customer: Customer | null;
  issueDate: string;
  dueDate: string;
  currency: string;
  total: number;
  status: InvoiceStatus;
  daysOverdue: number;
  lines: InvoiceLine[];
}

export interface InvoiceQuery {
  status?: InvoiceStatus;
  page: number;
  pageSize: number;
}
