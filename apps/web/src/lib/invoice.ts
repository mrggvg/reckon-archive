import { todayIso } from './format';
import type { Invoice, InvoiceStatus, Session } from './types';

export function invoiceStatusComputed(inv: Invoice): InvoiceStatus {
  if (inv.status === 'paid') return 'paid';
  if (inv.dueDate && inv.dueDate < todayIso()) return 'overdue';
  return 'unpaid';
}

export function parseInvoiceNumber(
  str: string | null | undefined,
): { seq: number; year: number } | null {
  const m = /^(\d+)\s*\/\s*(\d{4})$/.exec((str ?? '').trim());
  if (!m) return null;
  return { seq: parseInt(m[1] as string, 10), year: parseInt(m[2] as string, 10) };
}

export function nextInvoiceNumber(
  invoices: Invoice[],
  lastManualNumber: string,
  issueDateIso: string,
): string {
  const year = new Date(issueDateIso + 'T00:00:00').getFullYear();
  let maxSeq = 0;
  invoices.forEach((inv) => {
    const parsed = parseInvoiceNumber(inv.number);
    if (parsed && parsed.year === year) maxSeq = Math.max(maxSeq, parsed.seq);
  });
  const manual = parseInvoiceNumber(lastManualNumber);
  if (manual && manual.year === year) maxSeq = Math.max(maxSeq, manual.seq);
  return `${String(maxSeq + 1).padStart(3, '0')}/${year}`;
}

/** NNN/YYYY -> sortable number. */
export function invoiceSortKey(inv: Invoice): number {
  const [seq, year] = inv.number.split('/');
  return (parseInt(year ?? '0', 10) || 0) * 1000 + (parseInt(seq ?? '0', 10) || 0);
}

/**
 * What a tracked entry should say about its billing: nothing while unbilled,
 * "invoiced" once it's on an invoice, and "paid" once that invoice is settled.
 */
export function sessionBillingLabel(
  session: Session,
  invoices: Invoice[],
): 'invoiced' | 'paid' | null {
  if (!session.invoiced) return null;
  const invoice = session.invoiceId
    ? invoices.find((i) => i.id === session.invoiceId)
    : undefined;
  return invoice?.status === 'paid' ? 'paid' : 'invoiced';
}

/** Which badge variant each invoice state uses. */
export const STATUS_BADGE: Record<InvoiceStatus, 'success' | 'warning' | 'error'> = {
  paid: 'success',
  unpaid: 'warning',
  overdue: 'error',
};
