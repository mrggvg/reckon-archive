import { dohodninaOnRevenue, isActiveOn, monthsActiveInYear } from '@reckon/shared';
import type { Business } from '@reckon/shared';
import { todayIso } from './format';

/** The registration that is open today, or the most recent one if all are closed. */
export function activeBusiness(businesses: Business[], on = todayIso()): Business | undefined {
  return (
    businesses.find((b) => isActiveOn(b, on)) ??
    [...businesses].sort((a, b) => b.startedOn.localeCompare(a.startedOn))[0]
  );
}

/** The registration in force on a given day — invoices are taxed under theirs. */
export function businessOn(businesses: Business[], iso: string): Business | undefined {
  return businesses.find((b) => isActiveOn(b, iso));
}

/**
 * Prispevki owed for a calendar year, summed across every registration that
 * overlapped it — a year with one s.p. closed and another opened is normal.
 */
export function contributionsForYear(
  businesses: Business[],
  year: number,
  upTo = todayIso(),
): number {
  return businesses.reduce(
    (sum, b) => sum + monthsActiveInYear(b, year, upTo) * b.monthlyContribution,
    0,
  );
}

/** Dohodnina on paid income, at the rate of whichever registration was in force. */
export function incomeTaxForYear(
  businesses: Business[],
  paidInvoices: { paidDate: string | null; total: number }[],
  fallbackRatePercent: number,
): number {
  // Revenue is pooled per registration first: the expense cap is an annual
  // figure, so taxing invoice by invoice would never reach it.
  const byBusiness = new Map<string, number>();
  let untied = 0;

  for (const inv of paidInvoices) {
    if (!inv.paidDate) continue;
    const b = businessOn(businesses, inv.paidDate);
    if (!b) untied += inv.total;
    else byBusiness.set(b.id, (byBusiness.get(b.id) ?? 0) + inv.total);
  }

  let tax = untied * (fallbackRatePercent / 100);
  for (const [id, revenue] of byBusiness) {
    const b = businesses.find((x) => x.id === id);
    if (b) tax += dohodninaOnRevenue(b, revenue);
  }
  return tax;
}
