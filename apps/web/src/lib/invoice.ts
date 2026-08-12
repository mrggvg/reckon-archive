import { todayIso } from './format';
import type { Invoice, InvoiceStatus } from './types';

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

export const STATUS_BADGE: Record<InvoiceStatus, string> = {
  paid: 'badge-success',
  unpaid: 'badge-warning',
  overdue: 'badge-error',
};
