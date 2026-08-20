import { incomeTaxOnAdditional, type NormiranecKind } from './tax.js';

/**
 * What an invoice raised on someone else's behalf is actually worth.
 *
 * The shape of the favour: a friend does work for a company, has no way to
 * invoice it, so the invoice goes out through this s.p., the friend is handed
 * cash, and a cut is kept.
 *
 * Two things make the answer unobvious.
 *
 * A normiranec deducts nothing — the flat-rate expense *is* the deduction — so
 * the cash handed over is invisible to the tax system and the **whole** amount
 * is taxed. Keep 10 % of a thousand and the tax on the thousand comes out of
 * that hundred.
 *
 * And the rate that applies is the one at the *top* of the year, not today's:
 * a favour done in January still lifts the year's last slice. So the position
 * this is measured against is the projected year end, which is why it is a
 * parameter rather than a running total.
 */

export interface PassthroughOutcome {
  keepCents: number;
  handOverCents: number;
  /** Tax the whole amount causes, at the margin of the projected year. */
  taxCents: number;
  /** What is left of the cut once that tax is paid. */
  netCents: number;
  /** The agreed cut, as a share of the invoice. */
  cutRate: number;
  /** What the cut is really worth, as a share of the invoice. */
  netRate: number;
  /** The cut at which the favour breaks even — the marginal tax rate. */
  breakEvenRate: number;
  losesMoney: boolean;
}

export function passthroughOutcome({
  totalCents,
  keepCents,
  yearBaseCents,
  kind,
  year,
}: {
  totalCents: number;
  keepCents: number;
  /** Revenue the year is expected to reach *without* this invoice. */
  yearBaseCents: number;
  kind: NormiranecKind;
  year: number;
}): PassthroughOutcome {
  const taxCents = incomeTaxOnAdditional(yearBaseCents, totalCents, kind, year);
  const netCents = keepCents - taxCents;

  return {
    keepCents,
    handOverCents: totalCents - keepCents,
    taxCents,
    netCents,
    cutRate: totalCents > 0 ? keepCents / totalCents : 0,
    netRate: totalCents > 0 ? netCents / totalCents : 0,
    // Below this share of the invoice the favour costs money to do.
    breakEvenRate: totalCents > 0 ? taxCents / totalCents : 0,
    losesMoney: netCents < 0,
  };
}

/** The percentage → amount direction, so a cut can be typed either way. */
export function keepFromRate(totalCents: number, rate: number): number {
  return Math.round(totalCents * rate);
}
