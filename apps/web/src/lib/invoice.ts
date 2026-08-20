import { nextInvoiceNumber as sharedNextNumber } from '@reckon/shared';
import { fmtDMY, fmtMoney, todayIso } from './format';
import type { Invoice, InvoiceStatus, Session } from './types';

export function invoiceStatusComputed(inv: Invoice): InvoiceStatus {
  if (inv.status === 'paid') return 'paid';
  if (inv.dueDate && inv.dueDate < todayIso()) return 'overdue';
  return 'unpaid';
}

export { parseInvoiceNumber } from '@reckon/shared';

/**
 * The number a new invoice would get, for anything that wants to say so before
 * asking the server.
 *
 * The rule itself lives in @reckon/shared, and this only unwraps the ledger:
 * two copies of it would sooner or later disagree about the same invoice.
 */
export function nextInvoiceNumber(
  invoices: Invoice[],
  declaredNext: string,
  issueDateIso: string,
): string {
  return sharedNextNumber(
    invoices.map((inv) => inv.number),
    declaredNext,
    issueDateIso,
  );
}


/**
 * The number the next invoice would get once this one is deleted.
 *
 * Asked of the same rule that issues numbers, against the ledger this invoice
 * has been taken out of — so it is what will actually happen, not a guess about
 * it. When the answer is this invoice's own number, deleting hands it back.
 */
export function numberAfterDelete(
  invoices: Invoice[],
  inv: Invoice,
  declaredNext: string,
): string {
  return nextInvoiceNumber(
    invoices.filter((i) => i.id !== inv.id),
    declaredNext,
    inv.issueDate,
  );
}


/**
 * What someone is agreeing to when they take a payment back.
 *
 * Marking an invoice paid is one tap, and so is undoing it — but undoing it is
 * not symmetric. The payment date is what the tax module counts revenue on, so
 * withdrawing it moves money out of a month that may already have been paid
 * contributions and dohodnina against, and the sum reappears among the
 * outstanding ones. Worth a sentence and a deliberate second tap.
 */
export function unpaidWarning(inv: Invoice, clientName: string): string {
  const paidOn = inv.paidDate ? ` (plačano ${fmtDMY(inv.paidDate)})` : '';
  return (
    `Prekličem plačilo računa ${inv.number}${paidOn}?\n\n` +
    `${fmtMoney(inv.total)} za ${clientName} se vrne med neplačane. ` +
    'Davki in zaslužek tega zneska ne bodo več šteli na dan plačila, ' +
    'zato preverite, ali se izračun za tisti mesec še ujema.'
  );
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

export const STATUS_LABEL: Record<InvoiceStatus, string> = {
  paid: 'Plačano',
  unpaid: 'Neplačano',
  overdue: 'Zapadlo',
};

/** Where a tracked hour sits in the billing cycle. */
export const BILLING_LABEL: Record<'invoiced' | 'paid', string> = {
  invoiced: 'zaračunano',
  paid: 'plačano',
};
