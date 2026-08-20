import { fmtMoney } from './format';
import { toCents } from './money';
import type { Invoice } from './types';

/** The revenue this year already holds, plus where it is heading. */
export interface YearPosition {
  receivedCents: number;
  outstandingCents: number;
  projectedCents: number;
  workingLine: string;
}

/**
 * Reads the year off the invoices already in the store.
 *
 * Same basis the tax module uses — money received, plus invoices issued and
 * awaiting payment — extended by the average month for the months still to
 * come. A favour is not taxed at today's rate but at the rate on the last
 * euro of the year, so this is the position it has to be measured against.
 */
export function yearPositionFrom(
  invoices: Invoice[],
  todayIso: string,
  startIso: string | null,
  excludeId?: string,
): YearPosition {
  const year = todayIso.slice(0, 4);
  const month = Number(todayIso.slice(5, 7));
  const mine = invoices.filter((i) => i.id !== excludeId);

  const receivedCents = mine
    .filter((i) => i.paidDate !== null && i.paidDate.slice(0, 4) === year)
    .reduce((sum, i) => sum + toCents(i.total), 0);
  const outstandingCents = mine
    .filter((i) => i.paidDate === null && i.issueDate.slice(0, 4) === year)
    .reduce((sum, i) => sum + toCents(i.total), 0);

  const firstMonth =
    startIso && startIso.slice(0, 4) === year ? Number(startIso.slice(5, 7)) : 1;
  const monthsTraded = Math.max(0, month - firstMonth + 1);
  const monthsRemaining = 12 - month;
  const averageCents = monthsTraded > 0 ? Math.round(receivedCents / monthsTraded) : 0;

  return {
    receivedCents,
    outstandingCents,
    projectedCents:
      receivedCents + outstandingCents + averageCents * monthsRemaining,
    workingLine:
      `prejeto ${fmtMoney(receivedCents / 100)} + izdano ${fmtMoney(outstandingCents / 100)}` +
      (monthsRemaining > 0 && averageCents > 0
        ? ` + ${fmtMoney(averageCents / 100)}/mesec × ${monthsRemaining}`
        : ''),
  };
}
