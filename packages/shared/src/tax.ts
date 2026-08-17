/*
 * What a Slovenian s.p. owes, computed the way FURS computes it.
 *
 * Two obligations that behave nothing alike, so two engines that share no code:
 *
 *   • Prispevki — social security. Driven by the calendar and the registration
 *     date, owed whether or not a euro was earned.
 *   • Dohodnina — income tax. Driven entirely by revenue actually received,
 *     across bands, and for a normiranec it is a final (cedular) tax: no
 *     allowances, nothing folded into a general assessment. That is what makes
 *     it possible to compute the exact figure rather than an approximation.
 *
 * Everything here is a pure function over integer cents. Every rate, base and
 * threshold lives in the year-keyed config below, because all of them change
 * annually — a 2027 update should be an edit to that table, not to this code.
 *
 * Verified against two real PODO-OPSVZ filings (June and July 2026); both are
 * reproduced to the cent by `contributionsFor`, and are pinned as tests.
 */

export type NormiranecKind = 'full' | 'part';

/** A slice of revenue taxed at one effective rate. `upTo` is exclusive, in cents. */
export interface RevenueBand {
  upTo: number | null;
  /** Effective rate on revenue in this band, i.e. recognition and rate combined. */
  rate: number;
}

export interface TaxYearConfig {
  /** Full monthly insurance base (polna zavarovalna osnova), in cents. */
  contributionBaseCents: number;
  /**
   * Obvezni zdravstveni prispevek: a flat monthly amount on top of the
   * percentage contributions, not prorated for a partial month. It is
   * readjusted every 1 March rather than every 1 January, hence the dates.
   */
  healthFixed: { from: string; cents: number }[];
  /** Contribution rates, listed as the filing lists them — each rounded alone. */
  rates: {
    piz: number[];
    zzDo: number[];
    stv: number[];
    zap: number[];
  };
  /**
   * Relief on the PIZ contributions after a first-ever registration:
   * 50% for the first twelve months, 30% for the next twelve, then nothing.
   */
  reliefTiers: { months: number; relief: number }[];
  /** Effective rates on revenue, by kind of normiranec. */
  bands: Record<NormiranecKind, RevenueBand[]>;
  /** How much of revenue is recognised as flat-rate expense, for showing the base. */
  expenseRecognition: Record<NormiranecKind, RevenueBand[]>;
}

const YEAR_2026: TaxYearConfig = {
  contributionBaseCents: 152_162,
  healthFixed: [{ from: '2026-03-01', cents: 3936 }],
  rates: {
    // 15.50% insured + 8.85% employer
    piz: [0.155, 0.0885],
    // 6.36% + 6.56% health, 0.53% injury at work, 2.00% long-term care
    zzDo: [0.0636, 0.0656, 0.0053, 0.02],
    // 0.10% + 0.10% parental protection
    stv: [0.001, 0.001],
    // 0.14% + 0.06% unemployment
    zap: [0.0014, 0.0006],
  },
  reliefTiers: [
    { months: 12, relief: 0.5 },
    { months: 24, relief: 0.3 },
  ],
  bands: {
    // 80% recognised up to 60.000 → 20% base taxed at 20% → 4% of revenue.
    // Above that nothing is recognised, so the whole euro is base: 20%, then
    // 35% once the base passes 72.000 — which is revenue of 120.000.
    full: [
      { upTo: 6_000_000, rate: 0.04 },
      { upTo: 12_000_000, rate: 0.2 },
      { upTo: null, rate: 0.35 },
    ],
    part: [
      { upTo: 1_250_000, rate: 0.04 },
      { upTo: 3_000_000, rate: 0.12 },
      { upTo: 5_000_000, rate: 0.2 },
      { upTo: null, rate: 0.35 },
    ],
  },
  expenseRecognition: {
    full: [
      { upTo: 6_000_000, rate: 0.8 },
      { upTo: null, rate: 0 },
    ],
    part: [
      { upTo: 1_250_000, rate: 0.8 },
      { upTo: 3_000_000, rate: 0.4 },
      { upTo: null, rate: 0 },
    ],
  },
};

const TAX_YEARS: Record<number, TaxYearConfig> = { 2026: YEAR_2026 };

/** The most recent configured year at or before `year`. */
export function taxYearConfig(year: number): { year: number; config: TaxYearConfig } {
  const years = Object.keys(TAX_YEARS)
    .map(Number)
    .sort((a, b) => a - b);
  const match = [...years].reverse().find((y) => y <= year) ?? years[0]!;
  return { year: match, config: TAX_YEARS[match] as TaxYearConfig };
}

/** True when this year's figures are being applied to a year they weren't set for. */
export function isProjectedYear(year: number): boolean {
  return taxYearConfig(year).year !== year;
}

export const KNOWN_TAX_YEARS = Object.keys(TAX_YEARS).map(Number);

const round = (cents: number) => Math.round(cents);

// ── contributions ───────────────────────────────────────────────────────────

export interface ContributionBreakdown {
  piz: number;
  zzDo: number;
  stv: number;
  zap: number;
  total: number;
}

/**
 * Weekday hours in a month, at eight hours a day.
 *
 * Public holidays are deliberately *not* excluded: the June 2026 filing
 * prorated 160/176 hours, which counts 25 June (a state holiday falling on a
 * Thursday) as a working day. The register counts calendar weekdays, so so
 * does this.
 */
export function workingHoursInMonth(year: number, month: number, fromDay = 1): number {
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  let hours = 0;
  for (let day = fromDay; day <= days; day++) {
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    if (weekday !== 0 && weekday !== 6) hours += 8;
  }
  return hours;
}

/** Months completed between a start date and the first of a given month. */
function monthsSince(startIso: string, year: number, month: number): number {
  const startYear = Number(startIso.slice(0, 4));
  const startMonth = Number(startIso.slice(5, 7));
  return (year - startYear) * 12 + (month - startMonth);
}

/**
 * The PIZ relief that applies in a given month.
 *
 * Counted from the month of first registration, since the relief runs in whole
 * months of insurance rather than from the exact day.
 */
export function contributionRelief(
  startIso: string | null,
  year: number,
  month: number,
  config: TaxYearConfig,
): number {
  if (!startIso) return 0;
  const elapsed = monthsSince(startIso, year, month);
  if (elapsed < 0) return 0;
  for (const tier of config.reliefTiers) {
    if (elapsed < tier.months) return tier.relief;
  }
  return 0;
}

/** The flat health contribution in force in a given month. */
export function healthFixedCents(year: number, month: number, config: TaxYearConfig): number {
  const stamp = `${year}-${String(month).padStart(2, '0')}-01`;
  const applicable = config.healthFixed.filter((h) => h.from <= stamp);
  // Before the first known adjustment, the earliest known figure is the best
  // available answer — and it is the user's to correct on the filing anyway.
  return (applicable[applicable.length - 1] ?? config.healthFixed[0])?.cents ?? 0;
}

/**
 * The insurance base for a month, prorated across a partial first month.
 *
 * A business registered mid-month is insured for part of it, and the base is
 * reduced in proportion to the weekday hours covered.
 */
export function baseForMonth(
  fullBaseCents: number,
  year: number,
  month: number,
  startIso: string | null,
): number {
  if (!startIso) return fullBaseCents;
  const startYear = Number(startIso.slice(0, 4));
  const startMonth = Number(startIso.slice(5, 7));
  if (year !== startYear || month !== startMonth) return fullBaseCents;

  const startDay = Number(startIso.slice(8, 10));
  const covered = workingHoursInMonth(year, month, startDay);
  const whole = workingHoursInMonth(year, month);
  if (whole === 0) return fullBaseCents;
  return round((fullBaseCents * covered) / whole);
}

/**
 * One month of contributions.
 *
 * Each component is rounded to the cent on its own and then summed, which is
 * what the filings do — computing a group total and rounding once gives a
 * different answer, and the wrong one.
 */
export function contributionsFor({
  baseCents,
  relief,
  healthCents,
  config,
}: {
  baseCents: number;
  relief: number;
  healthCents: number;
  config: TaxYearConfig;
}): ContributionBreakdown {
  const group = (rates: number[], factor = 1) =>
    rates.reduce((sum, rate) => sum + round(baseCents * rate * factor), 0);

  const piz = group(config.rates.piz, 1 - relief);
  const zzDo = group(config.rates.zzDo) + healthCents;
  const stv = group(config.rates.stv);
  const zap = group(config.rates.zap);

  return { piz, zzDo, stv, zap, total: piz + zzDo + stv + zap };
}

/** Everything needed to state one month's contributions, from the profile. */
export function monthlyContributions({
  year,
  month,
  startIso,
  fullBaseCents,
  reliefOverride,
}: {
  year: number;
  month: number;
  startIso: string | null;
  fullBaseCents: number;
  reliefOverride?: number | null;
}): ContributionBreakdown & { baseCents: number; relief: number } {
  const { config } = taxYearConfig(year);
  const baseCents = baseForMonth(fullBaseCents, year, month, startIso);
  const relief =
    reliefOverride ?? contributionRelief(startIso, year, month, config);
  const healthCents = healthFixedCents(year, month, config);

  return {
    baseCents,
    relief,
    ...contributionsFor({ baseCents, relief, healthCents, config }),
  };
}

/** When the relief drops a tier, so the user isn't surprised by the step. */
export function nextReliefChange(
  startIso: string | null,
  config: TaxYearConfig,
): { onIso: string; relief: number } | null {
  if (!startIso) return null;
  const startYear = Number(startIso.slice(0, 4));
  const startMonth = Number(startIso.slice(5, 7));
  const today = new Date();
  const elapsed = monthsSince(startIso, today.getFullYear(), today.getMonth() + 1);

  for (const tier of config.reliefTiers) {
    if (elapsed < tier.months) {
      const at = startMonth - 1 + tier.months;
      const year = startYear + Math.floor(at / 12);
      const month = (at % 12) + 1;
      const nextTier = config.reliefTiers.find((t) => t.months > tier.months);
      return {
        onIso: `${year}-${String(month).padStart(2, '0')}-01`,
        relief: nextTier ? nextTier.relief : 0,
      };
    }
  }
  return null;
}

// ── income tax ──────────────────────────────────────────────────────────────

export interface IncomeTaxResult {
  /** Tax owed on that cumulative revenue, in cents. */
  taxCents: number;
  /** The tax base after flat-rate expenses, for showing the working. */
  baseCents: number;
  /** What the next euro of revenue would be taxed at. */
  marginalRate: number;
  /** Tax as a share of revenue so far. */
  effectiveRate: number;
}

function applyBands(amountCents: number, bands: RevenueBand[]): number {
  let remaining = amountCents;
  let from = 0;
  let total = 0;

  for (const band of bands) {
    if (remaining <= 0) break;
    const width = band.upTo === null ? remaining : Math.max(0, band.upTo - from);
    const slice = Math.min(remaining, width);
    total += slice * band.rate;
    remaining -= slice;
    from = band.upTo ?? from;
  }
  return total;
}

function marginalRateAt(amountCents: number, bands: RevenueBand[]): number {
  for (const band of bands) {
    if (band.upTo === null || amountCents < band.upTo) return band.rate;
  }
  return bands[bands.length - 1]?.rate ?? 0;
}

/**
 * Income tax on cumulative revenue for the year.
 *
 * Banded on revenue rather than on the base, which is the same arithmetic said
 * more directly: 4% of the first 60.000 is 20% of a base that is 20% of it.
 */
export function incomeTax(
  revenueCents: number,
  kind: NormiranecKind,
  year: number,
): IncomeTaxResult {
  const { config } = taxYearConfig(year);
  const bands = config.bands[kind];
  const revenue = Math.max(0, revenueCents);

  const taxCents = round(applyBands(revenue, bands));
  const recognised = round(applyBands(revenue, config.expenseRecognition[kind]));

  return {
    taxCents,
    baseCents: revenue - recognised,
    marginalRate: marginalRateAt(revenue, bands),
    effectiveRate: revenue === 0 ? 0 : taxCents / revenue,
  };
}

/**
 * Tax owed on money received now, given what the year has already brought in.
 *
 * A payment that straddles a threshold is split across the bands it spans —
 * the rate on new money follows the cumulative position, not the size of the
 * payment.
 */
export function incomeTaxOnAdditional(
  ytdBeforeCents: number,
  additionCents: number,
  kind: NormiranecKind,
  year: number,
): number {
  const before = incomeTax(ytdBeforeCents, kind, year).taxCents;
  const after = incomeTax(ytdBeforeCents + additionCents, kind, year).taxCents;
  return after - before;
}

/**
 * Where each contribution group is paid, as a suggestion to be confirmed.
 *
 * The four destination accounts are fixed, and the reference is the payer's
 * tax number with a FURS-assigned suffix per obligation — stable enough that
 * offering it saves retyping, and consequential enough that it must be shown
 * and confirmed rather than used silently. FURS credits a payment by its
 * reference: a wrong suffix pays the wrong obligation and nothing complains.
 *
 * Taken from real PODO-OPSVZ filings. Anything the user's own filing says
 * differently wins — that is why these are only ever a starting point.
 */
export const CONTRIBUTION_ACCOUNTS = {
  piz: { iban: 'SI56011008882000003', suffix: '44008' },
  zzDo: { iban: 'SI56011008883000073', suffix: '45004' },
  stv: { iban: 'SI56011008881000030', suffix: '43001' },
  zap: { iban: 'SI56011008881000030', suffix: '42005' },
} as const;

export type ContributionGroup = keyof typeof CONTRIBUTION_ACCOUNTS;

/** The reference FURS expects for a given obligation: SI19 [davčna]-[suffix]. */
export function suggestedContributionPayments(taxNumber: string): Record<
  ContributionGroup,
  { iban: string; reference: string }
> {
  const clean = (taxNumber ?? '').replace(/\D/g, '');
  const entries = Object.entries(CONTRIBUTION_ACCOUNTS) as [
    ContributionGroup,
    { iban: string; suffix: string },
  ][];
  return Object.fromEntries(
    entries.map(([group, account]) => [
      group,
      {
        iban: account.iban,
        reference: clean ? `SI19 ${clean}-${account.suffix}` : '',
      },
    ]),
  ) as Record<ContributionGroup, { iban: string; reference: string }>;
}

/** The revenue points worth marking on a chart, with why they matter. */
export function revenueThresholds(
  kind: NormiranecKind,
  year: number,
): { cents: number; label: string }[] {
  const { config } = taxYearConfig(year);
  const edges = config.bands[kind]
    .map((b) => b.upTo)
    .filter((c): c is number => c !== null);

  const labels: Record<number, string> = {
    6_000_000: 'Konec priznanih normiranih odhodkov · prag za DDV',
    12_000_000: 'Začetek 35 % stopnje · meja normiranca',
    1_250_000: 'Konec 80 % normiranih odhodkov',
    3_000_000: 'Konec 40 % normiranih odhodkov',
    5_000_000: 'Meja popoldanskega normiranca',
  };

  return edges.map((cents) => ({ cents, label: labels[cents] ?? '' }));
}
