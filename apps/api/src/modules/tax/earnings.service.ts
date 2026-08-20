import {
  fromCents,
  incomeTaxOnAdditional,
  minutesToHours,
  monthlyContributions,
  type NormiranecKind,
} from '@reckon/shared';
import { NotFoundError } from '../../lib/AppError.js';
import { profileRepo } from '../profile/profile.repo.js';
import { taxRepo, type RevenueRow } from './tax.repo.js';

/*
 * What an hour is actually worth once FURS has been paid.
 *
 * The number a rate negotiation should start from, and the one no invoicing
 * tool shows: gross revenue in a window, less the contributions that window
 * carries and the tax that revenue accrued, divided by the hours behind it.
 */

export type Basis = 'payment' | 'service';

export interface Window {
  key: string;
  label: string;
  fromIso: string;
  toIso: string;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

function monthsBack(todayIso: string, months: number): string {
  const [y, m, d] = todayIso.split('-').map(Number) as [number, number, number];
  const at = new Date(Date.UTC(y, m - 1 - months, d));
  return iso(at);
}

export function windowsFor(todayIso: string): Window[] {
  const year = todayIso.slice(0, 4);
  return [
    { key: '1m', label: '1 mesec', fromIso: monthsBack(todayIso, 1), toIso: todayIso },
    { key: '3m', label: '3 mesece', fromIso: monthsBack(todayIso, 3), toIso: todayIso },
    { key: '6m', label: '6 mesecev', fromIso: monthsBack(todayIso, 6), toIso: todayIso },
    { key: '12m', label: '12 mesecev', fromIso: monthsBack(todayIso, 12), toIso: todayIso },
    { key: 'ytd', label: 'Letos', fromIso: `${year}-01-01`, toIso: todayIso },
  ];
}

/** Whole and part months a window spans, for apportioning fixed contributions. */
function contributionsInWindow(
  from: string,
  to: string,
  profile: { startIso: string | null; baseCents: number; reliefOverride: number | null },
): number {
  let total = 0;
  const [fy, fm] = from.split('-').map(Number) as [number, number];
  const [ty, tm] = to.split('-').map(Number) as [number, number];

  for (let y = fy, m = fm; y < ty || (y === ty && m <= tm); m === 12 ? (m = 1, y++) : m++) {
    if (profile.startIso) {
      const sy = Number(profile.startIso.slice(0, 4));
      const sm = Number(profile.startIso.slice(5, 7));
      if (y < sy || (y === sy && m < sm)) continue;
    }
    const month = monthlyContributions({
      year: y,
      month: m,
      startIso: profile.startIso,
      fullBaseCents: profile.baseCents,
      reliefOverride: profile.reliefOverride,
    });

    // The first and last months of a window are usually partial; charge the
    // window the share of them it actually covers.
    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const firstDay = y === fy && m === fm ? Number(from.slice(8, 10)) : 1;
    const lastDay = y === ty && m === tm ? Number(to.slice(8, 10)) : daysInMonth;
    const share = (lastDay - firstDay + 1) / daysInMonth;

    total += Math.round(month.total * share);
  }
  return total;
}

export const earningsService = {
  /**
   * The effective rate over several windows at once, because the trend is the
   * actionable part: a rate falling window over window is the signal to
   * renegotiate.
   */
  async effectiveRate(userId: string, basis: Basis, todayIso: string) {
    const taxRow = await profileRepo.findTax(userId);
    if (!taxRow) throw new NotFoundError('Profil ni najden');
    const profile = {
      startIso: taxRow.business_start_date,
      baseCents: taxRow.contribution_base_cents,
      reliefOverride:
        taxRow.contribution_relief_override === null
          ? null
          : Number(taxRow.contribution_relief_override),
      kind: taxRow.normiranec_kind as NormiranecKind,
    };

    const revenue = await taxRepo.revenue(userId);

    /**
     * When an invoice counts as revenue.
     *
     * By payment date it is a cash view: what actually arrived, when. By
     * service period it is a work view: what the work was worth, aligned with
     * the hours that produced it — which is the honest basis for setting a
     * rate, since hours worked in July are often paid in September.
     *
     * Every window ends today, so a period that runs past today would fall
     * outside all of them and the invoice would vanish from the work view
     * entirely — which is what happens to an ordinary invoice for the month you
     * are standing in. Work still under way belongs to now, so the date is
     * capped at today.
     */
    const dateOf = (r: RevenueRow) =>
      basis === 'payment'
        ? r.paid_on
        : r.period_end > todayIso
          ? todayIso
          : r.period_end;

    /*
     * An invoice raised for somebody else counts twice over, differently.
     *
     * The tax follows the **whole** amount — a normiranec deducts nothing, so
     * carrying a thousand euros for a friend is taxed as a thousand euros of
     * revenue. But only the kept share was ever earned here, and it was earned
     * against no hours at all, so counting the whole amount as earnings would
     * inflate the hourly rate with money that was handed over in cash.
     */
    const taxableOf = (r: RevenueRow) => r.total_cents;
    const earnedOf = (r: RevenueRow) => r.passthrough_keep_cents ?? r.total_cents;

    /*
     * Only money with hours behind it can be divided by hours.
     *
     * A fixed fee, a call-out, an invoice raised for a friend: none of them
     * came from logged time. Counting them in the numerator while the
     * denominator holds only the hours actually worked inflates the rate — a
     * client billed 14 €/h looks like 34 €/h because a flat invoice landed in
     * the same window. So the two sides are taken from the same invoices: the
     * money an invoice brought in, and the hours that invoice charged for.
     */
    const hasHours = (r: RevenueRow) => r.total_minutes !== null && r.total_minutes > 0;
    const minutesOf = (r: RevenueRow) => (hasHours(r) ? (r.total_minutes as number) : 0);
    const hourlyOf = (r: RevenueRow) => (hasHours(r) ? earnedOf(r) : 0);

    const inWindow = (from: string, to: string) =>
      revenue.filter((r) => {
        const at = dateOf(r);
        return at !== null && at >= from && at <= to;
      });

    const windows = windowsFor(todayIso).map((w) => {
      const rows = inWindow(w.fromIso, w.toIso);
      const taxableCents = rows.reduce((sum, r) => sum + taxableOf(r), 0);
      const earnedCents = rows.reduce((sum, r) => sum + earnedOf(r), 0);
      const hourlyCents = rows.reduce((sum, r) => sum + hourlyOf(r), 0);
      const workedMinutes = rows.reduce((sum, r) => sum + minutesOf(r), 0);

      // Tax on this window's revenue is marginal: what it added on top of what
      // the year had already brought in before the window opened.
      const priorCents = revenue
        .filter((r) => {
          const at = dateOf(r);
          return (
            at !== null && at < w.fromIso && at.slice(0, 4) === w.toIso.slice(0, 4)
          );
        })
        .reduce((sum, r) => sum + taxableOf(r), 0);

      // The bracket follows everything invoiced, carried money included.
      const taxCents = incomeTaxOnAdditional(
        priorCents,
        taxableCents,
        profile.kind,
        Number(w.toIso.slice(0, 4)),
      );
      const contributionCents = contributionsInWindow(w.fromIso, w.toIso, profile);

      const hours = minutesToHours(workedMinutes);
      const netCents = earnedCents - taxCents - contributionCents;

      // The burden falls on everything that came in, so the hourly part carries
      // its share of it and no more.
      const burdenCents = taxCents + contributionCents;
      const hourlyShare = earnedCents > 0 ? hourlyCents / earnedCents : 0;
      const hourlyNetCents = hourlyCents - Math.round(burdenCents * hourlyShare);

      return {
        ...w,
        gross: fromCents(earnedCents),
        /** Invoiced for others and handed on — taxed here, not earned here. */
        carried: fromCents(taxableCents - earnedCents),
        /** Earned here with no hours behind it, so no rate can be read off it. */
        flat: fromCents(earnedCents - hourlyCents),
        contributions: fromCents(contributionCents),
        dohodnina: fromCents(taxCents),
        net: fromCents(netCents),
        hours,
        effectiveRate: hours > 0 ? fromCents(Math.round(hourlyNetCents / hours)) : null,
        // A quiet month carries the same fixed contributions as a busy one, so
        // a short window can look alarming for no real reason.
        thin: hours > 0 && hours < 40,
      };
    });

    // ── per client, over the longest window, which is the stable one ────────
    const year = todayIso.slice(0, 4);
    const yearFrom = `${year}-01-01`;
    const clientRows = revenue.filter((r) => {
      const at = dateOf(r);
      return at !== null && at >= yearFrom && at <= todayIso;
    });

    const byClient = new Map<
      string,
      { name: string; grossCents: number; hourlyCents: number; minutes: number }
    >();
    for (const r of clientRows) {
      const key = r.client_id ?? r.client_name;
      const entry = byClient.get(key) ?? {
        name: r.client_name,
        grossCents: 0,
        hourlyCents: 0,
        minutes: 0,
      };
      // Per client, only what was actually earned: the company paid the whole
      // invoice, but the difference went straight out again.
      entry.grossCents += earnedOf(r);
      // The hours come off the invoices, not off the diary, so a client's rate
      // is read from the money that was charged by the hour and nothing else.
      entry.hourlyCents += hourlyOf(r);
      entry.minutes += minutesOf(r);
      byClient.set(key, entry);
    }

    const yearWindow = windows.find((w) => w.key === 'ytd');
    const yearGross = yearWindow ? yearWindow.gross : 0;
    const yearBurden = yearWindow
      ? yearWindow.contributions + yearWindow.dohodnina
      : 0;

    const clients = [...byClient.entries()]
      .map(([id, c]) => {
        const hours = minutesToHours(c.minutes);
        // The year's burden shared out in proportion to what each client paid:
        // contributions aren't attributable to a client any other way. Only the
        // hourly part of it belongs above the division.
        const share = yearGross > 0 ? c.hourlyCents / (yearGross * 100) : 0;
        const netCents = c.hourlyCents - Math.round(yearBurden * 100 * share);
        return {
          clientId: id,
          name: c.name,
          gross: fromCents(c.grossCents),
          /** The part of it that was not charged by the hour. */
          flat: fromCents(c.grossCents - c.hourlyCents),
          hours,
          effectiveRate: hours > 0 ? fromCents(Math.round(netCents / hours)) : null,
        };
      })
      .sort((a, b) => b.gross - a.gross);

    return { basis, today: todayIso, windows, clients };
  },
};
