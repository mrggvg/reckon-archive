import {
  forecastYear,
  fromCents,
  incomeTax,
  monthlyContributions,
  nextReliefChange,
  revenueThresholds,
  taxYearConfig,
  toCents,
  yearSpan,
  type NormiranecKind,
} from '@reckon/shared';
import { NotFoundError } from '../../lib/AppError.js';
import { profileRepo } from '../profile/profile.repo.js';
import { taxRepo, type ContributionRow, type RevenueRow } from './tax.repo.js';

/*
 * The two obligations, answered from the ledger.
 *
 * Contributions come off the calendar and the registration date; income tax
 * comes off money actually received. They are computed separately and only
 * added together once, in the header figure, because they behave differently
 * and a user who conflates them will pay the wrong thing at the wrong time.
 */

interface TaxProfile {
  startIso: string | null;
  accounts: Record<'piz' | 'zzDo' | 'stv' | 'zap', { iban: string; reference: string }>;
  baseCents: number;
  reliefOverride: number | null;
  kind: NormiranecKind;
  installmentCents: number | null;
  installmentFrequency: 'monthly' | 'quarterly' | null;
  dohodninaIban: string;
  dohodninaReference: string;
  taxNumber: string;
}

async function taxProfile(userId: string): Promise<TaxProfile> {
  const row = await profileRepo.findTax(userId);
  if (!row) throw new NotFoundError('Profil ni najden');
  return {
    startIso: row.business_start_date,
    accounts: {
      piz: { iban: row.piz_iban, reference: row.piz_reference },
      zzDo: { iban: row.zz_do_iban, reference: row.zz_do_reference },
      stv: { iban: row.stv_iban, reference: row.stv_reference },
      zap: { iban: row.zap_iban, reference: row.zap_reference },
    },
    baseCents: row.contribution_base_cents,
    reliefOverride:
      row.contribution_relief_override === null
        ? null
        : Number(row.contribution_relief_override),
    kind: row.normiranec_kind,
    installmentCents: row.official_installment_cents,
    installmentFrequency: row.official_installment_frequency,
    dohodninaIban: row.dohodnina_iban,
    // A reference FURS will recognise, offered rather than assumed: the suffix
    // is fixed but the number in the middle is the user's own.
    dohodninaReference:
      row.dohodnina_reference || (row.tax_number ? `SI19 ${row.tax_number}-40002` : ''),
    taxNumber: row.tax_number,
  };
}

const monthOf = (iso: string) => Number(iso.slice(5, 7));
const yearOf = (iso: string) => Number(iso.slice(0, 4));

/**
 * Whether a month falls before the business existed.
 *
 * Nothing is owed for a month the s.p. was not registered in — not a reduced
 * amount, not an amount without relief: nothing at all. The engine will
 * happily compute a figure for any month handed to it, so this is the guard
 * that decides which months to hand it.
 */
function beforeBusiness(startIso: string | null, year: number, month: number): boolean {
  if (!startIso) return false;
  const startYear = yearOf(startIso);
  const startMonth = monthOf(startIso);
  return year < startYear || (year === startYear && month < startMonth);
}

/**
 * A month that hasn't been filed yet still needs somewhere to pay.
 *
 * The amount is the engine's estimate; the accounts are the ones the user
 * confirmed on their profile or that a previous filing taught it. Where those
 * are still empty, no code is offered — better a blank than a guess.
 */
const estimatedPayment = (accounts: TaxProfile['accounts']) =>
  Object.values(accounts).some((a) => a.iban && a.reference) ? accounts : null;

/** Revenue counted when the money arrived, which is what decides the tax year. */
const receivedIn = (rows: RevenueRow[], year: number) =>
  rows.filter((r) => r.paid_on !== null && yearOf(r.paid_on) === year);

function contributionDto(row: ContributionRow) {
  return {
    id: row.id,
    year: row.period_year,
    month: row.period_month,
    base: fromCents(row.base_cents),
    total: fromCents(row.total_cents),
    source: row.source,
    breakdown: {
      piz: fromCents(row.piz_cents),
      zzDo: fromCents(row.zz_do_cents),
      stv: fromCents(row.stv_cents),
      zap: fromCents(row.zap_cents),
    },
    payment: {
      piz: { iban: row.piz_iban, reference: row.piz_reference },
      zzDo: { iban: row.zz_do_iban, reference: row.zz_do_reference },
      stv: { iban: row.stv_iban, reference: row.stv_reference },
      zap: { iban: row.zap_iban, reference: row.zap_reference },
    },
  };
}

/**
 * The gap between what was expected and what was actually paid.
 *
 * Only meaningful once a month has been settled — a partly paid month is
 * short, not wrong. A cent either way is rounding; anything more is worth
 * asking about.
 */
function mismatchFor(
  expected: number,
  state: { paid: number; groups: Record<string, boolean> },
): { expected: number; paid: number; difference: number } | null {
  const complete = Object.values(state.groups).every(Boolean);
  if (!complete || state.paid === 0) return null;
  const difference = Math.round((state.paid - expected) * 100) / 100;
  return Math.abs(difference) < 0.02 ? null : { expected, paid: state.paid, difference };
}

export const taxService = {
  /**
   * A month of contributions: the filed figures if they exist, otherwise what
   * the engine says they will be.
   */
  async monthFor(userId: string, year: number, month: number) {
    const profile = await taxProfile(userId);
    const filed = (await taxRepo.contributions(userId, year)).find(
      (c) => c.period_month === month,
    );
    if (filed) return { ...contributionDto(filed), estimated: false };

    // Before the business existed there is no obligation to estimate.
    if (beforeBusiness(profile.startIso, year, month)) return null;

    /*
     * A popoldanski s.p. pays a flat monthly pavšal — a little over a hundred
     * euros — not a percentage of the insurance base. Running it through the
     * full-time engine would overstate it several times over, so it is refused
     * rather than guessed. Real filings can still be recorded by hand, and
     * those are used exactly as entered.
     */
    if (profile.kind === 'part') return null;

    const computed = monthlyContributions({
      year,
      month,
      startIso: profile.startIso,
      fullBaseCents: profile.baseCents,
      reliefOverride: profile.reliefOverride,
    });
    return {
      id: null,
      year,
      month,
      base: fromCents(computed.baseCents),
      total: fromCents(computed.total),
      source: 'estimated' as const,
      estimated: true,
      breakdown: {
        piz: fromCents(computed.piz),
        zzDo: fromCents(computed.zzDo),
        stv: fromCents(computed.stv),
        zap: fromCents(computed.zap),
      },
      payment: estimatedPayment(profile.accounts),
    };
  },

  /**
   * Every month of a year, filed where filed and estimated where not.
   *
   * Empty until the business start date is known. Contributions depend on when
   * the s.p. was registered — that decides both the relief and which months
   * exist at all — so without it there is nothing to say, and inventing a
   * twelve-month schedule from a default base would be inventing a debt.
   */
  async contributionSchedule(userId: string, year: number) {
    const profile = await taxProfile(userId);
    if (!profile.startIso) return [];

    const [rows, payments] = await Promise.all([
      taxRepo.contributions(userId, year),
      taxRepo.payments(userId, year),
    ]);
    const filed = new Map(rows.map((c) => [c.period_month, c]));

    /**
     * Which groups of a month have been paid.
     *
     * A month is four transfers, so "paid" is per group; a payment recorded
     * for the month without naming a group settles the lot, which is what a
     * single lump transfer means.
     */
    const settled = (month: number) => {
      const forMonth = payments.filter(
        (p) =>
          p.kind === 'contributions' &&
          p.period_year === year &&
          p.period_month === month,
      );
      const groups = new Set(forMonth.map((p) => p.group_key));
      const whole = groups.has(null);
      const paidCents = forMonth.reduce((sum, p) => sum + p.amount_cents, 0);
      return {
        paid: fromCents(paidCents),
        groups: {
          piz: whole || groups.has('piz'),
          zzDo: whole || groups.has('zz_do'),
          stv: whole || groups.has('stv'),
          zap: whole || groups.has('zap'),
        },
      };
    };

    const startYear = yearOf(profile.startIso);
    const startMonth = monthOf(profile.startIso);
    const firstMonth = year === startYear ? startMonth : 1;
    // A business that didn't exist yet owes nothing for those months.
    if (year < startYear) return [];

    const months = [];
    for (let month = firstMonth; month <= 12; month++) {
      const row = filed.get(month);
      if (row) {
        const state = settled(month);
        months.push({
          ...contributionDto(row),
          estimated: false,
          settled: state,
          mismatch: mismatchFor(fromCents(row.total_cents), state),
        });
        continue;
      }
      // Only a filed month can be shown for a popoldanski s.p.; the estimate
      // would be the wrong model entirely.
      if (profile.kind === 'part') continue;

      const computed = monthlyContributions({
        year,
        month,
        startIso: profile.startIso,
        fullBaseCents: profile.baseCents,
        reliefOverride: profile.reliefOverride,
      });
      months.push({
        id: null,
        year,
        month,
        base: fromCents(computed.baseCents),
        total: fromCents(computed.total),
        source: 'estimated' as const,
        estimated: true,
        breakdown: {
          piz: fromCents(computed.piz),
          zzDo: fromCents(computed.zzDo),
          stv: fromCents(computed.stv),
          zap: fromCents(computed.zap),
        },
        payment: estimatedPayment(profile.accounts),
        settled: settled(month),
        /*
         * Paying something other than the estimate is the app finding out it
         * was wrong. The real figure comes from FURS, and the difference is
         * the signal to correct the inputs the estimate was built on.
         */
        mismatch: mismatchFor(fromCents(computed.total), settled(month)),
      });
    }
    return months;
  },

  /**
   * The one screen's worth of answer: what is owed now, and where the year
   * stands on each obligation separately.
   */
  async summary(userId: string, year: number) {
    const profile = await taxProfile(userId);
    const { config, year: configYear } = taxYearConfig(year);

    const [revenue, payments, schedule] = await Promise.all([
      taxRepo.revenue(userId),
      taxRepo.payments(userId, year),
      this.contributionSchedule(userId, year),
    ]);

    const now = new Date();
    /**
     * The month whose contributions are actually owed.
     *
     * A month's contributions fall due once the month is over — the filing
     * appears and the payment is made in the month that follows. So during
     * August what is owed is July; August becomes owed on 1 September. Showing
     * the running month as a debt would be asking for money that isn't due.
     */
    const lastEnded =
      year < now.getFullYear() ? 12 : year > now.getFullYear() ? 0 : now.getMonth();

    // A month before the s.p. was registered is not a debt, so it is not the
    // month being asked about either.
    const dueMonth =
      lastEnded > 0 && !beforeBusiness(profile.startIso, year, lastEnded) ? lastEnded : 0;

    // Everything about contributions hangs off the registration date. Without
    // it the honest answer is "not yet", not a plausible-looking number.
    const configured = profile.startIso !== null && dueMonth > 0;
    const thisMonth = configured
      ? await this.monthFor(userId, year, dueMonth)
      : null;

    // ── income tax: driven by money received ────────────────────────────────
    const received = receivedIn(revenue, year);
    const ytdCents = received.reduce((sum, r) => sum + r.total_cents, 0);
    const owed = incomeTax(ytdCents, profile.kind, year);

    // Issued this year, still unpaid: the tax these will add when they land.
    const outstandingInvoices = revenue.filter(
      (r) => r.paid_on === null && yearOf(r.issue_date) === year,
    );
    const outstandingCents = outstandingInvoices.reduce(
      (sum, r) => sum + r.total_cents,
      0,
    );

    const paidIncomeTax = payments
      .filter((p) => p.kind === 'income_tax')
      .reduce((sum, p) => sum + p.amount_cents, 0);
    const paidContributions = payments
      .filter((p) => p.kind === 'contributions')
      .reduce((sum, p) => sum + p.amount_cents, 0);

    // What to send now to be square with the year so far. Not the official
    // installment: that is a fixed schedule and a different thing entirely.
    const recommendedCents = Math.max(0, owed.taxCents - paidIncomeTax);

    // ── contributions: driven by the calendar ───────────────────────────────
    const dueThisYearCents = schedule.reduce((sum, m) => sum + toCents(m.total), 0);
    const monthlyCents = thisMonth ? toCents(thisMonth.total) : 0;

    /*
     * What is still owed for that month, rather than what it cost.
     *
     * Once a month has been paid it stops being a demand — the schedule
     * already knows this, which is why it drops out of the list, and the
     * headline figure has to agree or the screen contradicts itself.
     */
    const dueRow = schedule.find((m) => m.month === dueMonth);
    const settledCents = dueRow ? toCents(dueRow.settled.paid) : 0;
    const outstandingContributionsCents = Math.max(0, monthlyCents - settledCents);
    const contributionsSettled = monthlyCents > 0 && outstandingContributionsCents === 0;
    const relief =
      configured && thisMonth?.estimated === true
        ? monthlyContributions({
            year,
            month: dueMonth,
            startIso: profile.startIso,
            fullBaseCents: profile.baseCents,
            reliefOverride: profile.reliefOverride,
          }).relief
        : (profile.reliefOverride ?? 0);
    const nextChange = nextReliefChange(profile.startIso, config);

    return {
      year,
      // Says plainly when a year is being computed with another year's figures.
      figuresFromYear: configYear,
      /**
       * What the s.p.'s own details still have to supply before contributions
       * can be worked out. Income tax needs none of it — it follows the
       * invoices that have actually been paid.
       */
      needs: profile.startIso ? [] : ['businessStartDate'],
      thisMonth: {
        month: dueMonth,
        /** What is left to pay for that month, not what the month cost. */
        contributions: thisMonth ? fromCents(outstandingContributionsCents) : null,
        contributionsSettled,
        recommendedDohodnina: fromCents(recommendedCents),
        total: fromCents(outstandingContributionsCents + recommendedCents),
      },
      contributions: {
        configured: profile.startIso !== null,
        /** Nothing is owed yet when the first month of the year is still running. */
        dueMonth: dueMonth > 0 ? dueMonth : null,
        /** The whole year predates the business, so there is nothing to owe. */
        beforeBusiness:
          profile.startIso !== null && beforeBusiness(profile.startIso, year, 12),
        businessStartDate: profile.startIso,
        /**
         * True for a popoldanski s.p., whose contributions are a flat pavšal
         * this engine does not model. Amounts must be entered from the filing.
         */
        estimateUnavailable: profile.kind === 'part',
        monthlyAmount: thisMonth?.total ?? null,
        /** True when the month being asked about has already been settled. */
        dueSettled: contributionsSettled,
        breakdown: thisMonth?.breakdown ?? null,
        relief,
        nextReliefChange: nextChange,
        paidThisYear: fromCents(paidContributions),
        dueThisYear: fromCents(dueThisYearCents),
        estimated: thisMonth?.estimated ?? true,
      },
      dohodnina: {
        ytdRevenue: fromCents(ytdCents),
        /**
         * Invoices issued and not yet paid.
         *
         * The recommendation is only ever square with the money that has
         * arrived. Every later payment adds tax on top, so paying the
         * recommendation while invoices are still outstanding means paying
         * again — and again — rather than once.
         */
        outstanding: {
          count: outstandingInvoices.length,
          amount: fromCents(outstandingCents),
          taxIfPaid: fromCents(
            incomeTax(ytdCents + outstandingCents, profile.kind, year).taxCents -
              owed.taxCents,
          ),
        },
        base: fromCents(owed.baseCents),
        marginalRate: owed.marginalRate,
        effectiveRate: owed.effectiveRate,
        owedToDate: fromCents(owed.taxCents),
        paidToDate: fromCents(paidIncomeTax),
        recommendedNow: fromCents(recommendedCents),
        iban: profile.dohodninaIban,
        reference: profile.dohodninaReference,
      },
      officialInstallment:
        profile.installmentCents === null
          ? null
          : {
              amount: fromCents(profile.installmentCents),
              frequency: profile.installmentFrequency,
            },
      partialYear:
        profile.startIso && yearOf(profile.startIso) === year
          ? {
              businessStartDate: profile.startIso,
              monthsCovered: 13 - monthOf(profile.startIso),
            }
          : null,
      /**
       * Where the year lands if the average month repeats.
       *
       * The floor — received plus issued — assumes no further work, which is
       * only true in December. Anything decided against that floor (what a
       * favour costs, how close 60.000 is) is decided against a number that is
       * too low, so the projection is what those questions are asked with.
       */
      projection: (() => {
        const span = yearSpan({
          year,
          todayIso: new Date().toISOString().slice(0, 10),
          startIso: profile.startIso,
        });
        const f = forecastYear({
          receivedCents: ytdCents,
          outstandingCents,
          monthsTraded: span.monthsTraded,
          monthsRemaining: span.monthsRemaining,
        });
        return {
          received: fromCents(f.receivedCents),
          outstanding: fromCents(f.outstandingCents),
          committed: fromCents(f.committedCents),
          monthlyAverage: fromCents(f.monthlyAverageCents),
          monthsTraded: f.monthsTraded,
          monthsRemaining: f.monthsRemaining,
          projected: fromCents(f.projectedCents),
          /** Tax the year would owe if it lands there. */
          projectedTax: fromCents(incomeTax(f.projectedCents, profile.kind, year).taxCents),
        };
      })(),
      assessment: await taxRepo.assessment(userId, year).then((a) =>
        a
          ? {
              assessed: fromCents(a.assessed_cents),
              receivedOn: a.received_on,
              note: a.note,
              paid: fromCents(paidIncomeTax),
              balance: fromCents(a.assessed_cents - paidIncomeTax),
            }
          : null,
      ),
    };
  },

  /**
   * Two cumulative revenue lines through the year: money received, and the
   * same continued through invoices still outstanding.
   *
   * The gap between them is the tax exposure sitting in somebody else's bank
   * account, which is worth seeing rather than inferring.
   */
  async trajectory(userId: string, year: number) {
    const profile = await taxProfile(userId);
    const revenue = await taxRepo.revenue(userId);

    const point = (dateIso: string, cumulativeCents: number) => ({
      date: dateIso,
      cumulativeRevenue: fromCents(cumulativeCents),
      taxOwed: fromCents(incomeTax(cumulativeCents, profile.kind, year).taxCents),
    });

    const paid = receivedIn(revenue, year).sort((a, b) =>
      (a.paid_on as string).localeCompare(b.paid_on as string),
    );
    let running = 0;
    const paidSeries = paid.map((r) => {
      running += r.total_cents;
      return { ...point(r.paid_on as string, running), number: r.number };
    });

    // The optimistic line starts where the real one ends and continues through
    // what has been issued but not yet received.
    const outstanding = revenue
      .filter((r) => r.paid_on === null && yearOf(r.issue_date) === year)
      .sort((a, b) => a.issue_date.localeCompare(b.issue_date));
    let projected = running;
    const invoicedSeries = outstanding.map((r) => {
      projected += r.total_cents;
      return { ...point(r.issue_date, projected), number: r.number };
    });

    const thresholds = revenueThresholds(profile.kind, year).map((t) => {
      const crossing = paidSeries.find((p) => toCents(p.cumulativeRevenue) >= t.cents);
      return {
        amount: fromCents(t.cents),
        label: t.label,
        crossedOn: crossing?.date ?? null,
      };
    });

    return {
      year,
      yearStart: profile.startIso && yearOf(profile.startIso) === year
        ? profile.startIso
        : `${year}-01-01`,
      yearEnd: `${year}-12-31`,
      paidSeries,
      invoicedSeries,
      outstanding: fromCents(projected - running),
      thresholds,
    };
  },
};
