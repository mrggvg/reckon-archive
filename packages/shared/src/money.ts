/**
 * Money crosses the wire and lives in the database as whole cents.
 *
 * The database column is `integer` cents rather than `numeric`, and the browser
 * works in euros as ordinary numbers, so exactly one place is allowed to
 * convert between them — here. A euro amount is only ever a display of an
 * integer number of cents; arithmetic that matters (invoice totals, line sums)
 * happens in cents, where 0.1 + 0.2 is 30 and not 30.000000000000004.
 */

/** Euros to whole cents, rounded half away from zero. */
export function toCents(euros: number): number {
  if (!Number.isFinite(euros)) return 0;
  return Math.round(euros * 100);
}

/** Whole cents back to euros, for display and for the browser's model. */
export function fromCents(cents: number): number {
  return Math.round(cents) / 100;
}

/** Minutes to hours, to two decimals — the unit an invoice is priced in. */
export function minutesToHours(minutes: number): number {
  return Math.round((minutes / 60) * 100) / 100;
}

/**
 * What a stretch of work costs, computed in cents throughout.
 *
 * Rounding once at the end, on the total, is deliberate: rounding per hour and
 * summing would drift by a cent or two across a month of odd durations, and the
 * figure on the invoice has to be the figure the arithmetic produces.
 */
export function lineTotalCents(minutes: number, rateCents: number): number {
  return Math.round((minutes / 60) * rateCents);
}
